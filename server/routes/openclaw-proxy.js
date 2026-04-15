// ── OpenClaw WebSocket Proxy ─────────────────────────────────────────────────
// Conecta la pestaña OpenClaw del chat web con qwen3.5 vía Ollama
//
// Usa qwen3.5 vía Ollama /api/chat para respuestas coherentes.
// functiongemma (268M) es demasiado pequeño para chat conversacional.
// Mantiene historial por sesión WebSocket.
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11435';
const MODEL = process.env.OPENCLAW_MODEL || 'qwen3.5:latest';

const SYSTEM_CONTEXT = `/no_think
Eres SynK-IA OpenClaw, asistente inteligente de Chicken Palace Ibiza.
Responde siempre en español, de forma directa y concisa.
No uses razonamiento interno ni bloques <think>. Ve directo a la respuesta.`;

// Máximo de turnos de historial (pares user/assistant)
const MAX_TURNS = 8;

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
    const history = []; // Array of {role:'user'|'assistant', text:string}

    // Notificar al frontend que estamos conectados
    send(clientWs, { type: 'connected', sessionId });

    clientWs.on('message', async (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        send(clientWs, { type: 'error', error: 'Mensaje inválido' });
        return;
      }

      const userMessage = parsed.task || parsed.message || parsed.text;
      if (!userMessage) {
        send(clientWs, { type: 'error', error: 'Sin mensaje' });
        return;
      }

      console.log('[OPENCLAW-PROXY] → Ollama:', userMessage.slice(0, 80));

      // Añadir al historial
      history.push({ role: 'user', text: userMessage });

      // Trim historial
      while (history.length > MAX_TURNS * 2) {
        history.shift();
      }

      // Indicar procesamiento
      send(clientWs, { type: 'processing', task: 'Pensando...' });

      try {
        const response = await callOllamaChat(history);
        history.push({ role: 'assistant', text: response });
        send(clientWs, { type: 'response', response });
        console.log('[OPENCLAW-PROXY] ← Ollama:', response.slice(0, 80));
      } catch (err) {
        console.error('[OPENCLAW-PROXY] Error Ollama:', err.message);
        send(clientWs, { type: 'error', error: `Error: ${err.message}` });
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
 * Llama a Ollama /api/chat con historial de mensajes.
 */
async function callOllamaChat(history) {
  const messages = [
    { role: 'system', content: SYSTEM_CONTEXT },
    ...history.map(m => ({ role: m.role, content: m.text })),
  ];

  const body = {
    model: MODEL,
    messages,
    stream: false,
    options: {
      num_predict: 512,
      temperature: 0.7,
      repeat_penalty: 1.2,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

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
    let content = (data.message?.content || data.response || '').trim();

    // Quitar bloques <think>...</think> si el modelo los genera
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    if (!content) {
      throw new Error('Respuesta vacía de Ollama');
    }

    // Truncar si hay repetición excesiva (safety net)
    content = deduplicateLoops(content);

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Detecta y corta patrones repetitivos en la respuesta.
 * Si una frase se repite 3+ veces seguidas, la corta a 1 aparición.
 */
function deduplicateLoops(text) {
  // Detectar repeticiones de frases de 10+ chars
  const match = text.match(/(.{10,}?)\1{2,}/);
  if (match) {
    const idx = text.indexOf(match[0]);
    return text.slice(0, idx + match[1].length).trim() + '...';
  }
  // Si el texto excede 2000 chars, truncar
  if (text.length > 2000) {
    const cutoff = text.lastIndexOf('.', 1500);
    return text.slice(0, cutoff > 0 ? cutoff + 1 : 1500).trim();
  }
  return text;
}

function send(ws, obj) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  } catch {}
}
