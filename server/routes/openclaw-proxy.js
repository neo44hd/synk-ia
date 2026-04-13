// ── OpenClaw WebSocket Proxy ─────────────────────────────────────────────────
// Reenvía /ws/openclaw al WebSocket local de OpenClaw en localhost:18790
// para que el tráfico pase por el túnel de Cloudflare (puerto 3001).
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocketServer, WebSocket } from 'ws';

const OPENCLAW_URL = process.env.OPENCLAW_WS_URL || 'ws://localhost:18789';

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
      upstreamWs = new WebSocket(OPENCLAW_URL);
    } catch (err) {
      console.error('[OPENCLAW-PROXY] Error al crear conexión upstream:', err.message);
      clientWs.send(JSON.stringify({ type: 'error', error: 'No se pudo conectar a OpenClaw' }));
      clientWs.close();
      return;
    }

    let upstreamReady = false;
    const pendingMessages = [];

    upstreamWs.on('open', () => {
      console.log('[OPENCLAW-PROXY] ✓ Conectado a OpenClaw upstream');
      upstreamReady = true;
      // Enviar mensajes pendientes
      for (const msg of pendingMessages) {
        upstreamWs.send(msg);
      }
      pendingMessages.length = 0;
    });

    // Upstream (OpenClaw) → Cliente (browser)
    upstreamWs.on('message', (data) => {
      try {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data.toString());
        }
      } catch (err) {
        console.error('[OPENCLAW-PROXY] Error reenviando a cliente:', err.message);
      }
    });

    upstreamWs.on('error', (err) => {
      console.error('[OPENCLAW-PROXY] Error upstream:', err.message);
      try {
        clientWs.send(JSON.stringify({ type: 'error', error: `OpenClaw no disponible: ${err.message}` }));
      } catch {}
    });

    upstreamWs.on('close', (code, reason) => {
      console.log(`[OPENCLAW-PROXY] Upstream cerrado (${code})`);
      try { clientWs.close(code, reason?.toString()); } catch {}
    });

    // Cliente (browser) → Upstream (OpenClaw)
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
