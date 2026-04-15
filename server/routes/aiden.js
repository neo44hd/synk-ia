/**
 * aiden.js — Endpoint para controlar agentes OpenClaw desde la UI
 *
 * POST /api/aiden        → enviar comando a OpenClaw via WebSocket
 * GET  /api/aiden/status → estado de la conexión con OpenClaw
 *
 * Incluye handshake connect.challenge y reconexión con backoff exponencial.
 */
import { Router } from 'express';
import WebSocket  from 'ws';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const router = Router();
const OPENCLAW_URL  = process.env.OPENCLAW_WS_URL  || 'ws://localhost:18789';
const OPENCLAW_HTTP = process.env.OPENCLAW_HTTP_URL || 'http://localhost:18789';

// ── Leer token del gateway ──────────────────────────────────────────────────
let OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';
if (!OPENCLAW_TOKEN) {
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    OPENCLAW_TOKEN = config?.gateway?.auth?.token || '';
    if (OPENCLAW_TOKEN) {
      console.log('[AIDEN] Token leído de ~/.openclaw/openclaw.json');
    }
  } catch {}
}

// ── Backoff config ──────────────────────────────────────────────────────────
const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS     = 30000;
const BACKOFF_FACTOR     = 2;

// ── Estado persistente de la conexión ───────────────────────────────────────
let ws = null;
let connected = false;       // true después del handshake completo
let handshakeDone = false;
let connectReqId = null;
let lastResponse = null;
let responseResolvers = [];
let backoffMs = BACKOFF_INITIAL_MS;
let reconnectTimer = null;

/**
 * Construye el frame de request "connect" para el handshake.
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
      auth: { token: OPENCLAW_TOKEN },
      role: 'operator',
      scopes: ['*'],
    },
  };
}

function connectToOpenClaw() {
  if (ws && ws.readyState <= 1) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  handshakeDone = false;
  connectReqId = null;

  try {
    ws = new WebSocket(OPENCLAW_URL);

    ws.on('open', () => {
      console.log('[AIDEN] ✓ WebSocket abierto, esperando challenge...');
      backoffMs = BACKOFF_INITIAL_MS;
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 1. Interceptar connect.challenge
        if (!handshakeDone && msg.type === 'event' && msg.event === 'connect.challenge') {
          const frame = buildConnectFrame();
          connectReqId = frame.id;
          ws.send(JSON.stringify(frame));
          handshakeDone = true;
          return;
        }

        // 2. Interceptar respuesta al connect
        if (msg.type === 'res' && !connected && connectReqId && msg.id === connectReqId) {
          if (msg.error) {
            console.error('[AIDEN] ✗ Handshake rechazado:', msg.error.message || msg.error.code);
            ws.close();
            return;
          }
          connected = true;
          backoffMs = BACKOFF_INITIAL_MS;
          console.log('[AIDEN] ✓ Conectado a OpenClaw (handshake OK)');
          return;
        }

        // 3. Mensajes normales
        lastResponse = msg;
        if (responseResolvers.length > 0) {
          const resolve = responseResolvers.shift();
          resolve(msg);
        }
      } catch {}
    });

    ws.on('close', () => {
      const wasConnected = connected;
      connected = false;
      handshakeDone = false;
      if (wasConnected) {
        console.log('[AIDEN] Desconectado de OpenClaw');
      }
      // Rechazar promesas pendientes
      for (const resolve of responseResolvers) {
        resolve({ type: 'error', error: 'Conexión cerrada' });
      }
      responseResolvers = [];
      // Reconexión con backoff
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.error('[AIDEN] Error:', err.message);
      connected = false;
    });
  } catch (e) {
    console.error('[AIDEN] No se pudo conectar:', e.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const jitter = Math.random() * 500;
  const delay = Math.min(backoffMs + jitter, BACKOFF_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    backoffMs = Math.min(backoffMs * BACKOFF_FACTOR, BACKOFF_MAX_MS);
    connectToOpenClaw();
  }, delay);
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
    ws.send(JSON.stringify({ type, task: command }));
    console.log(`[AIDEN] → OpenClaw (${type}): ${command.slice(0, 100)}`);

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

  const handler = (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // No reenviar mensajes internos del handshake
      if (msg.type === 'event' && msg.event === 'connect.challenge') return;
      if (msg.type === 'res' && msg.id === connectReqId) return;
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
  setTimeout(cleanup, 60000);

  ws.send(JSON.stringify({ type, task: command }));
  send({ type: 'status', text: `Enviando a OpenClaw: ${command.slice(0, 80)}...` });
});

export const aidenRouter = router;
