// ── OpenClaw WebSocket Proxy ─────────────────────────────────────────────────
// Reenvía /ws/openclaw al WebSocket local de OpenClaw en localhost:18789
//
// El gateway envía connect.challenge a todas las conexiones WebSocket.
// Si no se responde, el gateway cierra la conexión tras un timeout.
//
// Estrategia: interceptar el challenge y responder con el handshake correcto,
// usando las credenciales del gateway (token de openclaw.json).
// Usamos client.id=cli, mode=cli (no requiere origin check ni device identity
// obligatoria según el source code).
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const OPENCLAW_URL = process.env.OPENCLAW_WS_URL || 'ws://localhost:18789';

// Leer el token directamente de openclaw.json (la fuente de verdad)
let OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';
if (!OPENCLAW_TOKEN) {
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    OPENCLAW_TOKEN = config?.gateway?.auth?.token || '';
    if (OPENCLAW_TOKEN) {
      console.log('[OPENCLAW-PROXY] Token leído de ~/.openclaw/openclaw.json');
    }
  } catch (err) {
    console.warn('[OPENCLAW-PROXY] No se pudo leer openclaw.json:', err.message);
  }
}

/**
 * Construye el frame de request "connect" para responder al challenge.
 * Usa cli/cli que no requiere origin check.
 */
function buildConnectFrame() {
  return {
    type: 'req',
    id: randomUUID(),
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'cli',
        version: '1.0.0',
        platform: process.platform,
        mode: 'cli',
      },
      caps: [],
      auth: {
        token: OPENCLAW_TOKEN,
      },
      role: 'operator',
      scopes: ['*'],
    },
  };
}

export function setupOpenClawProxy(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.handleUpgradeRequest = (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, req);
    });
  };

  wss.on('connection', (clientWs) => {
    console.log('[OPENCLAW-PROXY] Cliente conectado, abriendo conexión a', OPENCLAW_URL);

    let upstreamWs;
    try {
      upstreamWs = new WebSocket(OPENCLAW_URL);
    } catch (err) {
      console.error('[OPENCLAW-PROXY] Error al crear conexión upstream:', err.message);
      clientWs.send(JSON.stringify({ type: 'error', error: 'No se pudo conectar a OpenClaw' }));
      clientWs.close();
      return;
    }

    let upstreamReady = false;
    let handshakeDone = false;
    let connectReqId  = null;
    const pendingMessages = [];

    upstreamWs.on('open', () => {
      console.log('[OPENCLAW-PROXY] ✓ WebSocket abierto, esperando connect.challenge...');
    });

    // Upstream (OpenClaw) → lógica
    upstreamWs.on('message', (data) => {
      const raw = data.toString();
      let parsed;
      try { parsed = JSON.parse(raw); } catch {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(raw);
        return;
      }

      // 1. Interceptar connect.challenge
      if (!handshakeDone && parsed.type === 'event' && parsed.event === 'connect.challenge') {
        const nonce = parsed.payload?.nonce;
        console.log('[OPENCLAW-PROXY] ← connect.challenge (nonce:', nonce, ')');
        const frame = buildConnectFrame();
        connectReqId = frame.id;
        console.log('[OPENCLAW-PROXY] → connect request (cli/cli, operator)');
        upstreamWs.send(JSON.stringify(frame));
        handshakeDone = true;
        return;
      }

      // 2. Interceptar respuesta al connect
      if (parsed.type === 'res' && !upstreamReady && connectReqId && parsed.id === connectReqId) {
        if (parsed.error) {
          console.error('[OPENCLAW-PROXY] ✗ Connect rechazado:', JSON.stringify(parsed.error));
          clientWs.send(JSON.stringify({
            type: 'error',
            error: `OpenClaw: ${parsed.error.message || parsed.error.code || 'unknown'}`,
          }));
          // No cerrar — dejar que el gateway decida
          return;
        }
        console.log('[OPENCLAW-PROXY] ✓ Handshake completado');
        upstreamReady = true;
        const sessionId = parsed.result?.sessionId || parsed.result?.id || 'proxy';
        clientWs.send(JSON.stringify({ type: 'connected', sessionId }));

        for (const msg of pendingMessages) upstreamWs.send(msg);
        pendingMessages.length = 0;
        return;
      }

      // 3. Reenviar todo lo demás al browser
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(raw);
      }
    });

    upstreamWs.on('error', (err) => {
      console.error('[OPENCLAW-PROXY] Error upstream:', err.message);
      try {
        clientWs.send(JSON.stringify({ type: 'error', error: `OpenClaw: ${err.message}` }));
      } catch {}
    });

    upstreamWs.on('close', (code, reason) => {
      const reasonStr = reason?.toString() || 'sin motivo';
      console.log(`[OPENCLAW-PROXY] Upstream cerrado (code:${code}, reason:${reasonStr})`);
      try { clientWs.close(code, reason?.toString()); } catch {}
    });

    // Cliente (browser) → Upstream
    clientWs.on('message', (data) => {
      const msg = data.toString();
      if (upstreamReady && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(msg);
      } else {
        pendingMessages.push(msg);
      }
    });

    clientWs.on('close', () => {
      console.log('[OPENCLAW-PROXY] Cliente desconectado');
      try { upstreamWs.close(); } catch {}
    });

    clientWs.on('error', (err) => {
      console.error('[OPENCLAW-PROXY] Error cliente:', err.message);
      try { upstreamWs.close(); } catch {}
    });
  });

  console.log('[SERVER] ✓ OpenClaw Proxy: /ws/openclaw → ' + OPENCLAW_URL);
  return wss;
}
