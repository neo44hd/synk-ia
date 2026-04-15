// ── OpenClaw WebSocket Proxy ─────────────────────────────────────────────────
// Reenvía /ws/openclaw al WebSocket local de OpenClaw en localhost:18789
// Intercepta el handshake connect.challenge y responde con el frame "connect"
// para autenticarse automáticamente ante el gateway.
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const OPENCLAW_URL   = process.env.OPENCLAW_WS_URL  || 'ws://localhost:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN    || 'sinkia-openclaw-2026';

// Valores válidos sacados de openclaw/dist/message-channel-DXsjCySM.js
// GATEWAY_CLIENT_IDS: webchat-ui, openclaw-control-ui, openclaw-tui, webchat,
//   cli, gateway-client, openclaw-macos, node-host, test, probe...
// GATEWAY_CLIENT_MODES: webchat, cli, ui, backend, node, probe, test
// webchat-ui + webchat triggerea validación de origins (CONTROL_UI_ORIGIN_NOT_ALLOWED)
// gateway-client + backend es el default del SDK y no requiere origin config
const CLIENT_ID   = 'gateway-client';
const CLIENT_MODE = 'backend';

/**
 * Construye el frame de request "connect" que OpenClaw espera
 * después de enviar connect.challenge.
 *
 * Protocolo descubierto en client-CJI3Hi9b.js líneas 490-540:
 *  - type: "req" (no "request")
 *  - method: "connect"
 *  - params.client.id debe ser una de las constantes GATEWAY_CLIENT_IDS
 *  - params.client.mode debe ser una de las constantes GATEWAY_CLIENT_MODES
 *  - params.caps debe ser array (no objeto)
 *  - params.device es OPCIONAL (solo si hay deviceIdentity con keypair)
 */
function buildConnectFrame(nonce) {
  return {
    type: 'req',
    id:   randomUUID(),
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id:       CLIENT_ID,
        version:  '1.0.0',
        platform: process.platform,       // "darwin" en Mac Mini
        mode:     CLIENT_MODE,
      },
      caps: [],                            // debe ser array vacío
      auth: {
        token: OPENCLAW_TOKEN,
      },
      role:   'operator',
      scopes: ['*'],
      // device: OMITIDO — requiere keypair (publicKey, signature, signedAt, nonce)
      //         y es opcional según el source code de OpenClaw
    },
  };
}

export function setupOpenClawProxy(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  // El upgrade se maneja desde index.js (dispatcher centralizado)
  wss.handleUpgradeRequest = (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, req);
    });
  };

  wss.on('connection', (clientWs) => {
    console.log('[OPENCLAW-PROXY] Cliente conectado, abriendo conexión a', OPENCLAW_URL);

    let upstreamWs;
    try {
      upstreamWs = new WebSocket(OPENCLAW_URL, {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
          'X-Auth-Token': OPENCLAW_TOKEN,
        },
      });
    } catch (err) {
      console.error('[OPENCLAW-PROXY] Error al crear conexión upstream:', err.message);
      clientWs.send(JSON.stringify({ type: 'error', error: 'No se pudo conectar a OpenClaw' }));
      clientWs.close();
      return;
    }

    let upstreamReady   = false;   // true después del handshake completo
    let handshakeDone   = false;   // ya respondimos al challenge
    let connectReqId    = null;    // id del frame connect para matchear la respuesta
    const pendingMessages = [];

    upstreamWs.on('open', () => {
      console.log('[OPENCLAW-PROXY] ✓ WebSocket abierto a OpenClaw, esperando connect.challenge...');
    });

    // ── Upstream (OpenClaw) → lógica de handshake + reenvío al cliente ──
    upstreamWs.on('message', (data) => {
      const raw = data.toString();
      let parsed;

      try {
        parsed = JSON.parse(raw);
      } catch {
        // Si no es JSON, reenviar tal cual
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(raw);
        return;
      }

      // ── 1. Interceptar connect.challenge ──
      if (!handshakeDone && parsed.type === 'event' && parsed.event === 'connect.challenge') {
        const nonce = parsed.payload?.nonce;
        console.log('[OPENCLAW-PROXY] ← connect.challenge recibido (nonce:', nonce, ')');

        const connectFrame = buildConnectFrame(nonce);
        connectReqId = connectFrame.id;
        console.log('[OPENCLAW-PROXY] → Enviando connect request (client.id=%s, mode=%s)', CLIENT_ID, CLIENT_MODE);
        upstreamWs.send(JSON.stringify(connectFrame));
        handshakeDone = true;
        return; // No reenviar el challenge al browser
      }

      // ── 2. Interceptar respuesta al connect (res con mismo id) ──
      if (parsed.type === 'res' && !upstreamReady && parsed.id === connectReqId) {
        // Respuesta al request "connect" — puede ser ok o error
        if (parsed.error) {
          console.error('[OPENCLAW-PROXY] ✗ Connect rechazado:', JSON.stringify(parsed.error));
          clientWs.send(JSON.stringify({
            type: 'error',
            error: `OpenClaw rechazó la conexión: ${parsed.error.message || parsed.error.code || 'unknown'}`,
          }));
          upstreamWs.close();
          return;
        }

        console.log('[OPENCLAW-PROXY] ✓ Handshake completado — sesión activa');
        upstreamReady = true;

        // Notificar al browser que estamos conectados
        const sessionId = parsed.result?.sessionId || parsed.result?.id || randomUUID();
        clientWs.send(JSON.stringify({ type: 'connected', sessionId }));

        // Enviar mensajes que estaban en cola
        for (const msg of pendingMessages) {
          upstreamWs.send(msg);
        }
        pendingMessages.length = 0;
        return;
      }

      // ── 3. Reenviar todo lo demás al browser ──
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(raw);
      }
    });

    upstreamWs.on('error', (err) => {
      console.error('[OPENCLAW-PROXY] Error upstream:', err.message);
      try {
        clientWs.send(JSON.stringify({ type: 'error', error: `OpenClaw no disponible: ${err.message}` }));
      } catch {}
    });

    upstreamWs.on('close', (code, reason) => {
      const reasonStr = reason?.toString() || 'sin motivo';
      console.log(`[OPENCLAW-PROXY] Upstream cerrado (code:${code}, reason:${reasonStr})`);
      try { clientWs.close(code, reason?.toString()); } catch {}
    });

    // ── Cliente (browser) → Upstream (OpenClaw) ──
    clientWs.on('message', (data) => {
      const msg = data.toString();

      // Transformar mensajes del browser al formato que OpenClaw entiende
      let parsed;
      try { parsed = JSON.parse(msg); } catch { parsed = null; }

      if (parsed && parsed.type === 'ask') {
        // El browser envía {type:"ask", task:"..."} — convertir a request frame
        const reqFrame = {
          type: 'req',
          id:   randomUUID(),
          method: 'ask',
          params: {
            task:         parsed.task,
            contextFiles: parsed.contextFiles || [],
            autoContext:  parsed.autoContext || false,
          },
        };
        const frameStr = JSON.stringify(reqFrame);
        if (upstreamReady && upstreamWs.readyState === WebSocket.OPEN) {
          upstreamWs.send(frameStr);
        } else {
          pendingMessages.push(frameStr);
        }
        return;
      }

      // Cualquier otro mensaje, reenviar tal cual
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
