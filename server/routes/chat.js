/**
 * chat.js — Chat con Qwen3 via Ollama (OpenAI-compatible format)
 *
 * Endpoints:
 *   POST /api/chat         → chat libre, SSE streaming con think tags separados
 *   POST /api/chat/brain   → chat con contexto de negocio (brain.js)
 *   GET  /api/chat/status  → estado del modelo
 *
 * Eventos SSE:
 *   data: {"type":"thinking","text":"..."}  → razonamiento interno (colapsable)
 *   data: {"type":"text","text":"..."}      → respuesta final
 *   data: [DONE]
 */

import { Router } from 'express';
import { askBrainStream, classifyIntent, searchWeb } from '../services/brain.js';
import { buildContextBlock } from '../services/fileContext.js';

const router     = Router();
const OLLAMA_URL = process.env.OLLAMA_URL            || 'http://localhost:11434';
const MODEL      = process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_MODEL || 'qwen3.5';

// ── ThinkingFilter: separa <think>...</think> del texto final ─────────────
// Funciona en streaming, acumula buffer para manejar tags partidos entre chunks
class ThinkingFilter {
  constructor(onText, onThinking) {
    this.onText      = onText;
    this.onThinking  = onThinking;
    this.buf         = '';
    this.inThink     = false;
  }

  push(chunk) {
    this.buf += chunk;
    this._flush();
  }

  end() {
    // Al final, volcar lo que quede como texto
    if (this.buf && !this.inThink) this.onText(this.buf);
    this.buf = '';
  }

  _flush() {
    const OPEN  = '<think>';
    const CLOSE = '</think>';
    const SAFE  = 8; // chars mínimos a retener por si el tag viene partido

    while (true) {
      if (this.inThink) {
        const end = this.buf.indexOf(CLOSE);
        if (end === -1) {
          // Seguimos en bloque think, volcar todo excepto los últimos SAFE chars
          if (this.buf.length > SAFE) {
            this.onThinking(this.buf.slice(0, this.buf.length - SAFE));
            this.buf = this.buf.slice(this.buf.length - SAFE);
          }
          break;
        } else {
          if (end > 0) this.onThinking(this.buf.slice(0, end));
          this.buf     = this.buf.slice(end + CLOSE.length);
          this.inThink = false;
          this.onThinking(null); // señal: fin de bloque think
        }
      } else {
        const start = this.buf.indexOf(OPEN);
        if (start === -1) {
          // No hay tag think, volcar excepto últimos SAFE chars
          if (this.buf.length > SAFE) {
            this.onText(this.buf.slice(0, this.buf.length - SAFE));
            this.buf = this.buf.slice(this.buf.length - SAFE);
          }
          break;
        } else {
          if (start > 0) this.onText(this.buf.slice(0, start));
          this.buf     = this.buf.slice(start + OPEN.length);
          this.inThink = true;
        }
      }
    }
  }
}

// ── POST /api/chat ─────────────────────────────────────────────────────────
// Body: { messages, system?, stream?, thinking? }
// thinking=true → envía eventos type:"thinking" además de type:"text"
router.post('/', async (req, res) => {
  const { messages = [], system, stream = true, thinking = true, contextFiles = [], autoContext = false } = req.body;

  // Construir contexto de archivos si se solicita
  let fileContext = '';
  try {
    const lastUserMsg = autoContext ? messages.filter(m => m.role === 'user').pop()?.content : null;
    fileContext = await buildContextBlock(contextFiles, lastUserMsg);
    if (fileContext) console.log(`[CHAT] Context injected: ${fileContext.length} chars`);
  } catch (e) { console.error('[CHAT] Error building context:', e.message); }

  const allMessages = [];
  const systemContent = (system || '') + fileContext;
  if (systemContent) allMessages.push({ role: 'system', content: systemContent });
  allMessages.push(...messages);

  if (!stream) {
    // ── Respuesta sin streaming ──────────────────────────────────────────
    try {
      const r = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: MODEL, messages: allMessages, stream: false, max_tokens: 8192 }),
      });
      const d    = await r.json();
      const text = d.choices?.[0]?.message?.content || '';
      // Limpiar think tags para respuesta no-streaming
      const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      return res.json({ text: clean, model: MODEL });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Respuesta streaming con SSE ──────────────────────────────────────────
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const upstream = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: MODEL, messages: allMessages, stream: true, max_tokens: 8192 }),
    });

    if (!upstream.ok) {
      send({ type: 'error', text: `Ollama ${upstream.status}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const filter = new ThinkingFilter(
      (text) => { if (text) send({ type: 'text', text }); },
      (think) => {
        if (!thinking) return; // si el cliente no quiere el thinking, descartarlo
        if (think === null) send({ type: 'thinking_done' });
        else if (think) send({ type: 'thinking', text: think });
      },
    );

    const reader = upstream.body.getReader();
    const dec    = new TextDecoder();
    let   buf    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') continue;
        try {
          const d     = JSON.parse(raw);
          const chunk = d.choices?.[0]?.delta?.content || '';
          if (chunk) filter.push(chunk);
        } catch {}
      }
    }

    filter.end();

  } catch (e) {
    console.error('[CHAT] Error streaming:', e.message);
    send({ type: 'error', text: e.message });
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// ── POST /api/chat/brain ─────────────────────────────────────────────────────
// Chat inteligente con contexto de negocio (brain.js)
// Body: { message }
// SSE: {type:"step",...} | {type:"thinking",...} | {type:"text",...} | [DONE]
router.post('/brain', async (req, res) => {
  const { message, contextFiles = [], autoContext = false } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Mensaje requerido' });

  // Construir contexto de archivos
  let fileContext = '';
  try {
    fileContext = await buildContextBlock(contextFiles, autoContext ? message : null);
    if (fileContext) console.log(`[BRAIN] Context injected: ${fileContext.length} chars`);
  } catch (e) { console.error('[BRAIN] Error building context:', e.message); }

  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    await askBrainStream(
      message,
      (step)  => send({ type: 'step', ...step }),
      (chunk) => {
        // El brain ya devuelve texto limpio (stripThinking en llm())
        // Solo para el stream final de generateAnswer, filtramos aquí también
        send({ type: 'text', text: chunk });
      },
      fileContext,
    );
  } catch (err) {
    send({ type: 'error', text: err.message });
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// ── POST /api/chat/search ────────────────────────────────────────────────────
// Búsqueda web directa via SearXNG
// Body: { query, n? }
router.post('/search', async (req, res) => {
  const { query, n = 5 } = req.body;
  if (!query) return res.status(400).json({ error: 'Query requerido' });
  const results = await searchWeb(query, n);
  res.json({ query, results: results || [], disponible: !!results });
});

// ── GET /api/chat/status ─────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  try {
    const [lm, searxng] = await Promise.allSettled([
      fetch(`${OLLAMA_URL}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      }),
      fetch('http://localhost:8888/healthz', { signal: AbortSignal.timeout(2000) }),
    ]);

    const lmOk = lm.status === 'fulfilled' && lm.value.ok;
    const models = lmOk
      ? ((await lm.value.json()).data?.map(m => m.id) || [])
      : [];

    res.json({
      ollama:     lmOk,
      searxng:    searxng.status === 'fulfilled' && searxng.value.ok,
      models,
      active_model: MODEL,
    });
  } catch (e) {
    res.json({ ollama: false, searxng: false, models: [], error: e.message });
  }
});

export const chatRouter = router;
