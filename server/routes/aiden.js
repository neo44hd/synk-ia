/**
 * aiden.js — Endpoint para controlar agentes OpenClaw desde la UI
 *
 * POST /api/aiden        → enviar comando a OpenClaw via WebSocket
 * GET  /api/aiden/status → estado de la conexión con OpenClaw
 * GET  /api/aiden/agents → lista de agentes disponibles
 */
import { Router } from 'express';
import WebSocket  from 'ws';

const router = Router();
const OPENCLAW_URL = process.env.OPENCLAW_WS_URL || 'ws://localhost:18789';
const OPENCLAW_HTTP = process.env.OPENCLAW_HTTP_URL || 'http://localhost:18789';

// ── Estado persistente de la conexión ───────────────────────────────────────
let ws = null;
let connected = false;
let lastResponse = null;
let responseResolvers = []; // Cola de promesas esperando respuesta

function connectToOpenClaw() {
  if (ws && ws.readyState <= 1) return; // ya conectado o conectando
  try {
    ws = new WebSocket(OPENCLAW_URL);

    ws.on('open', () => {
      connected = true;
      console.log('[AIDEN] ✓ Conectado a OpenClaw');
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        lastResponse = msg;
        // Resolver la primera promesa en cola
        if (responseResolvers.length > 0) {
          const resolve = responseResolvers.shift();
          resolve(msg);
        }
      } catch {}
    });

    ws.on('close', () => {
      connected = false;
      console.log('[AIDEN] Desconectado de OpenClaw');
      // Rechazar promesas pendientes
      for (const resolve of responseResolvers) {
        resolve({ type: 'error', error: 'Conexión cerrada' });
      }
      responseResolvers = [];
      // Reconectar en 5s
      setTimeout(connectToOpenClaw, 5000);
    });

    ws.on('error', (err) => {
      console.error('[AIDEN] Error:', err.message);
      connected = false;
    });
  } catch (e) {
    console.error('[AIDEN] No se pudo conectar:', e.message);
  }
}

// Conectar al arrancar
connectToOpenClaw();

// Esperar respuesta con timeout
function waitForResponse(timeoutMs = 30000) {
  return new Promise((resolve) => {
    responseResolvers.push(resolve);
    setTimeout(() => {
      const idx = responseResolvers.indexOf(resolve);
      if (idx >= 0) {
        responseResolvers.splice(idx, 1);
        resolve({ type: 'timeout', error: 'Sin respuesta (timeout)' });
      }
    }, timeoutMs);
  });
}

// ── GET /api/aiden/status ───────────────────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({
    connected,
    wsUrl: OPENCLAW_URL,
    lastResponse: lastResponse ? { type: lastResponse.type, time: Date.now() } : null,
  });
});

// ── POST /api/aiden — enviar comando ────────────────────────────────────────
// Body: { command: string, type?: 'ask'|'action'|'shell', timeout?: number }
router.post('/', async (req, res) => {
  const { command, type = 'ask', timeout = 30000 } = req.body;

  if (!command) {
    return res.status(400).json({ ok: false, error: 'Falta el campo "command"' });
  }

  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
    connectToOpenClaw();
    return res.status(503).json({ ok: false, error: 'OpenClaw no conectado. Reintentando...' });
  }

  try {
    // Enviar al WebSocket
    ws.send(JSON.stringify({ type, task: command }));
    console.log(`[AIDEN] → OpenClaw (${type}): ${command.slice(0, 100)}`);

    // Esperar respuesta
    const response = await waitForResponse(timeout);
    console.log(`[AIDEN] ← OpenClaw: ${response.type}`);

    res.json({ ok: true, response });

  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/aiden/stream — enviar comando con SSE ─────────────────────────
router.post('/stream', async (req, res) => {
  const { command, type = 'ask' } = req.body;

  if (!command) {
    return res.status(400).json({ ok: false, error: 'Falta "command"' });
  }

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
    send({ type: 'error', text: 'OpenClaw no conectado' });
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  // Escuchar mensajes temporalmente
  const handler = (data) => {
    try {
      const msg = JSON.parse(data.toString());
      send(msg);
      if (msg.type === 'response' || msg.type === 'error') {
        cleanup();
      }
    } catch {}
  };

  const cleanup = () => {
    ws?.removeListener('message', handler);
    res.write('data: [DONE]\n\n');
    res.end();
  };

  ws.on('message', handler);
  setTimeout(cleanup, 60000); // Max 60s

  ws.send(JSON.stringify({ type, task: command }));
  send({ type: 'status', text: `Enviando a OpenClaw: ${command.slice(0, 80)}...` });
});

export const aidenRouter = router;
