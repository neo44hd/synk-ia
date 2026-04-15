// ── OpenClaw WebSocket Proxy ─────────────────────────────────────────────────
// Conecta la pestaña OpenClaw del chat web con functiongemma vía Ollama
//
// functiongemma es un modelo completion-only (268M params, gemma3 base).
// No soporta chat/tools, así que usamos /api/generate con formato de
// prompt conversacional. Mantiene historial por sesión WebSocket.
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11435';
const MODEL = process.env.OPENCLAW_MODEL || 'functiongemma:latest';

const SYSTEM_CONTEXT = `Eres SynK-IA OpenClaw, asistente de Chicken Palace Ibiza. Responde siempre en español, de forma directa y concisa.`;

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
        const response = await callOllamaGenerate(history);
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
 * Construye el prompt conversacional y llama a Ollama /api/generate.
 * functiongemma es completion-only, no soporta /api/chat.
 */
function buildPrompt(history) {
  let prompt = SYSTEM_CONTEXT + '\n\n';
  for (const msg of history) {
    if (msg.role === 'user') {
      prompt += `User: ${msg.text}\n`;
    } else {
      prompt += `Assistant: ${msg.text}\n`;
    }
  }
  prompt += 'Assistant:';
  return prompt;
}

async function callOllamaGenerate(history) {
  const prompt = buildPrompt(history);

  const body = {
    model: MODEL,
    prompt,
    stream: false,
    options: {
      num_predict: 512,
      temperature: 0.6,
      repeat_penalty: 1.3,
      top_p: 0.9,
      stop: ['User:', '\n\n\n'],
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
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
    let content = (data.response || '').trim();

    if (!content) {
      throw new Error('Respuesta vacía de Ollama');
    }

    // Limpiar prefijos residuales
    if (content.startsWith('Assistant:')) {
      content = content.slice('Assistant:'.length).trim();
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
  // Si el texto excede 1500 chars, truncar (functiongemma es 268M, no debe generar tanto)
  if (text.length > 1500) {
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
