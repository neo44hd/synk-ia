// ── OpenClaw WebSocket Proxy ─────────────────────────────────────────────────
// Reenvía /ws/openclaw al WebSocket local de OpenClaw en localhost:18789
//
// Protocolo de handshake:
//   1. Gateway envía connect.challenge con nonce
//   2. Proxy responde con frame {type:"req", method:"connect"} (cli/cli/operator)
//   3. Gateway responde con {type:"res"} confirmando sesión
//
// Reconexión automática con backoff exponencial si upstream se cae.
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const OPENCLAW_URL = process.env.OPENCLAW_WS_URL || 'ws://localhost:18789';
const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

// Origins que el gateway debe permitir para conexiones webchat/control-ui
const REQUIRED_ORIGINS = [
  'https://sinkialabs.com',
  'http://localhost:3001',
  'http://127.0.0.1:18789',
];

// ── Leer token y parchear allowedOrigins ────────────────────────────────────
let OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';
try {
  const config = JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));

  // Leer token
  if (!OPENCLAW_TOKEN) {
    OPENCLAW_TOKEN = config?.gateway?.auth?.token || '';
    if (OPENCLAW_TOKEN) {
      console.log('[OPENCLAW-PROXY] Token leído de ~/.openclaw/openclaw.json');
    }
  }

  // Asegurar que allowedOrigins incluye los dominios necesarios
  const controlUi = config?.gateway?.controlUi;
  if (controlUi) {
    const origins = Array.isArray(controlUi.allowedOrigins) ? controlUi.allowedOrigins : [];
    const missing = REQUIRED_ORIGINS.filter(o => !origins.includes(o));
    if (missing.length > 0) {
      controlUi.allowedOrigins = [...origins, ...missing];
      writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      console.log('[OPENCLAW-PROXY] ✓ allowedOrigins actualizado:', controlUi.allowedOrigins.join(', '));
      console.log('[OPENCLAW-PROXY]   ⚠ Reinicia OpenClaw gateway para aplicar cambios');
    } else {
      console.log('[OPENCLAW-PROXY] ✓ allowedOrigins OK:', origins.join(', '));
    }
  }
} catch (err) {
  console.warn('[OPENCLAW-PROXY] No se pudo leer/actualizar openclaw.json:', err.message);
}

// ── Backoff config ──────────────────────────────────────────────────────────
const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS     = 30000;
const BACKOFF_FACTOR     = 2;

/**
 * Construye el frame de request "connect" para responder al challenge.
 * Usa cli/cli que no requiere origin check ni device identity.
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
    console.log('[OPENCLAW-PROXY] Cliente conectado');

    let upstreamWs    = null;
    let upstreamReady = false;
    let handshakeDone = false;
    let connectReqId  = null;
    let backoffMs     = BACKOFF_INITIAL_MS;
    let reconnectTimer = null;
    let clientClosed  = false;
    const pendingMessages = [];

    // ── Conectar al upstream con handshake ─────────────────────────────────
    function connectUpstream() {
      if (clientClosed) return;

      // Limpiar conexión anterior
      if (upstreamWs) {
        try { upstreamWs.removeAllListeners(); upstreamWs.close(); } catch {}
      }
      upstreamReady = false;
      handshakeDone = false;
      connectReqId  = null;

      try {
        upstreamWs = new WebSocket(OPENCLAW_URL);
      } catch (err) {
        console.error('[OPENCLAW-PROXY] Error al crear conexión:', err.message);
        scheduleReconnect();
        return;
      }

      upstreamWs.on('open', () => {
        console.log('[OPENCLAW-PROXY] ✓ WebSocket abierto, esperando challenge...');
        // Reset backoff on successful open
        backoffMs = BACKOFF_INITIAL_MS;
      });

      upstreamWs.on('message', (data) => {
        const raw = data.toString();
        let parsed;
        try { parsed = JSON.parse(raw); } catch {
          if (clientWs.readyState === WebSocket.OPEN) clientWs.send(raw);
          return;
        }

        // 1. Interceptar connect.challenge
        if (!handshakeDone && parsed.type === 'event' && parsed.event === 'connect.challenge') {
          console.log('[OPENCLAW-PROXY] ← challenge, respondiendo...');
          const frame = buildConnectFrame();
          connectReqId = frame.id;
          upstreamWs.send(JSON.stringify(frame));
          handshakeDone = true;
          return;
        }

        // 2. Interceptar respuesta al connect
        if (parsed.type === 'res' && !upstreamReady && connectReqId && parsed.id === connectReqId) {
          if (parsed.error) {
            console.error('[OPENCLAW-PROXY] ✗ Connect rechazado:', parsed.error.message || parsed.error.code);
            notifyClient({ type: 'error', error: `OpenClaw: ${parsed.error.message || 'unknown'}` });
            scheduleReconnect();
            return;
          }
          console.log('[OPENCLAW-PROXY] ✓ Handshake completado');
          upstreamReady = true;
          backoffMs = BACKOFF_INITIAL_MS; // Reset on success
          const sessionId = parsed.result?.sessionId || parsed.result?.id || 'proxy';
          notifyClient({ type: 'connected', sessionId });

          // Enviar mensajes en cola
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
        notifyClient({ type: 'error', error: `OpenClaw: ${err.message}` });
      });

      upstreamWs.on('close', (code, reason) => {
        const reasonStr = reason?.toString() || 'sin motivo';
        console.log(`[OPENCLAW-PROXY] Upstream cerrado (code:${code}, reason:${reasonStr})`);
        upstreamReady = false;

        if (!clientClosed) {
          notifyClient({ type: 'event', event: 'reconnecting', backoffMs });
          scheduleReconnect();
        }
      });
    }

    // ── Reconexión con backoff exponencial ─────────────────────────────────
    function scheduleReconnect() {
      if (clientClosed || reconnectTimer) return;
      const jitter = Math.random() * 500;
      const delay = Math.min(backoffMs + jitter, BACKOFF_MAX_MS);
      console.log(`[OPENCLAW-PROXY] Reconectando en ${Math.round(delay)}ms...`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        backoffMs = Math.min(backoffMs * BACKOFF_FACTOR, BACKOFF_MAX_MS);
        connectUpstream();
      }, delay);
    }

    // ── Helper para enviar al browser ─────────────────────────────────────
    function notifyClient(obj) {
      try {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(obj));
        }
      } catch {}
    }

    // ── Cliente (browser) → Upstream ──────────────────────────────────────
    clientWs.on('message', (data) => {
      const msg = data.toString();
      if (upstreamReady && upstreamWs?.readyState === WebSocket.OPEN) {
        upstreamWs.send(msg);
      } else {
        pendingMessages.push(msg);
      }
    });

    clientWs.on('close', () => {
      console.log('[OPENCLAW-PROXY] Cliente desconectado');
      clientClosed = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try { upstreamWs?.close(); } catch {}
    });

    clientWs.on('error', (err) => {
      console.error('[OPENCLAW-PROXY] Error cliente:', err.message);
      clientClosed = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try { upstreamWs?.close(); } catch {}
    });

    // ── Iniciar primera conexión ──────────────────────────────────────────
    connectUpstream();
  });

  console.log('[SERVER] ✓ OpenClaw Proxy: /ws/openclaw → ' + OPENCLAW_URL);
  return wss;
}
