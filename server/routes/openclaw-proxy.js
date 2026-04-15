// ── OpenClaw WebSocket Proxy ─────────────────────────────────────────────────
// Conecta la pestaña OpenClaw del chat web con functiongemma vía Ollama
//
// Anteriormente intentaba usar el gateway RPC de OpenClaw, pero functiongemma
// no soporta tools y el system prompt del gateway excede su contexto (16K).
// Ahora habla directamente con Ollama HTTP API (/api/chat) para máxima
// fiabilidad. Mantiene historial de conversación por sesión de WebSocket.
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11435';
const MODEL = process.env.OPENCLAW_MODEL || 'functiongemma:latest';
const SYSTEM_PROMPT = `Eres SynK-IA OpenClaw, asistente inteligente de Chicken Palace Ibiza.
Responde siempre en español, de forma directa y concisa.
No uses razonamiento interno. Ve directo a la respuesta.
Eres amable, profesional y eficiente.`;

// Máximo de mensajes en historial para no exceder contexto
const MAX_HISTORY = 20;

export function setupOpenClawProxy(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.handleUpgradeRequest = (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, req);
    });
  };

  wss.on('connection', (clientWs) => {
    console.log('[OPENCLAW-PROXY] Cliente conectado');

    const sessionId = randomUUID();
    const history = []; // Array of {role, content}

    // Notificar al frontend que estamos conectados
    send(clientWs, {
      type: 'connected',
      sessionId,
    });

    clientWs.on('message', async (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        send(clientWs, { type: 'error', error: 'Mensaje inválido' });
        return;
      }

      // El frontend envía {type:'ask', task:'...'}
      const userMessage = parsed.task || parsed.message || parsed.text;
      if (!userMessage) {
        send(clientWs, { type: 'error', error: 'Sin mensaje' });
        return;
      }

      console.log('[OPENCLAW-PROXY] → Ollama:', userMessage.slice(0, 80));

      // Añadir al historial
      history.push({ role: 'user', content: userMessage });

      // Trim history si excede máximo
      while (history.length > MAX_HISTORY) {
        history.shift();
      }

      // Indicar que estamos procesando
      send(clientWs, { type: 'processing', task: 'Pensando...' });

      try {
        const response = await callOllama(history);
        
        // Añadir respuesta al historial
        history.push({ role: 'assistant', content: response });

        // Enviar respuesta al frontend
        send(clientWs, { type: 'response', response });
        console.log('[OPENCLAW-PROXY] ← Ollama:', response.slice(0, 80));
      } catch (err) {
        console.error('[OPENCLAW-PROXY] Error Ollama:', err.message);
        send(clientWs, {
          type: 'error',
          error: `Error: ${err.message}`,
        });
      }
    });

    clientWs.on('close', () => {
      console.log('[OPENCLAW-PROXY] Cliente desconectado');
    });

    clientWs.on('error', (err) => {
      console.error('[OPENCLAW-PROXY] Error cliente:', err.message);
    });
  });

  console.log(`[SERVER] ✓ OpenClaw Proxy: /ws/openclaw → ${OLLAMA_BASE} (${MODEL})`);
  return wss;
}

/**
 * Llama a Ollama /api/chat con el historial de mensajes.
 * No usa streaming para simplificar — devuelve la respuesta completa.
 */
async function callOllama(history) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
    ],
    stream: false,
    options: {
      num_predict: 2048,
      temperature: 0.7,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.message?.content || data.response || '';
    
    if (!content) {
      throw new Error('Respuesta vacía de Ollama');
    }

    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function send(ws, obj) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  } catch {}
}
