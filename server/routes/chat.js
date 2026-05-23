/**
 * chat.js — Chat con soporte dual Ollama + LM Studio (OpenAI-compatible)
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

// ── Configuración dual de proveedores ──────────────────────────────────────

const OLLAMA_URL    = process.env.OLLAMA_URL    || 'http://localhost:11434';
const LMSTUDIO_URL  = process?.env?.LMSTUDIO_URL     || 'http://localhost:1234/v1';
const LMSTUDIO_KEY  = process?.env?.LMSTUDIO_API_KEY || '';
const LMSTUDIO_MODELS = new Set([
  'negentropy-claude-opus-4.7-9b',
  'deepseek/deepseek-r1-0528-qwen3-8b',
]);

function getChatProvider(model) {
  if (LMSTUDIO_MODELS.has(model)) return 'lmstudio';
  return 'ollama';
}

const router = Router();
const getModel = () => process.env.CHAT_PROVIDER === 'lmstudio'
  ? (process.env.CHAT_MODEL || 'harmonic-hermes-9b:latest')
  : (process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_MODEL || 'harmonic-hermes-9b:latest');

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
    if (this.buf && !this.inThink) this.onText(this.buf);
    this.buf = '';
  }

  _flush() {
    const OPEN  = '<think>';
    const CLOSE = '</think>';
    const SAFE  = 8;

    while (true) {
      if (this.inThink) {
        const end = this.buf.indexOf(CLOSE);
        if (end === -1) {
          if (this.buf.length > SAFE) {
            this.onThinking(this.buf.slice(0, this.buf.length - SAFE));
            this.buf = this.buf.slice(this.buf.length - SAFE);
          }
          break;
        } else {
          if (end > 0) this.onThinking(this.buf.slice(0, end));
          this.buf     = this.buf.slice(end + CLOSE.length);
          this.inThink = false;
          this.onThinking(null);
        }
      } else {
        const start = this.buf.indexOf(OPEN);
        if (start === -1) {
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

// ─── Llamar a Ollama (chat completions) ─────────────────────────────────────
async function ollamaChat({ messages, system, stream, maxTokens }) {
  const body = {
    model: getModel(),
    messages,
    stream,
    max_tokens: maxTokens || 2048,
    options: { num_ctx: parseInt(process.env.NUM_CTX || '8192', 10) },
  };
  if (system) {
    body.messages = [{ role: 'system', content: system }, ...messages];
  }

  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}`);
  return res;
}

// ─── Llamar a LM Studio (chat completions, OpenAI-compatible) ──────────────
async function lmstudioChat({ messages, system, stream, maxTokens }) {
  const model = getModel();
  const body = {
    model,
    messages: [...messages],
    stream,
    max_tokens: maxTokens || 2048,
    temperature: 0.7,
    num_ctx: parseInt(process.env.NUM_CTX || '8192', 10),
  };
  if (system) {
    body.messages = [{ role: 'system', content: system }, ...body.messages];
  }

  const headers = { 'Content-Type': 'application/json' };
  if (LMSTUDIO_KEY) headers['Authorization'] = `Bearer ${LMSTUDIO_KEY}`;

  const res = await fetch(`${LMSTUDIO_URL}/chat/completions`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LM Studio ${res.status}: ${errText}`);
  }
  return res;
}

// ─── Dispatcher de chat ────────────────────────────────────────────────────
async function chatCompletion({ messages, system, stream = false, maxTokens }) {
  const model = getModel();
  const provider = getChatProvider(model);

  if (provider === 'lmstudio') {
    return lmstudioChat({ messages, system, stream, maxTokens });
  }
  return ollamaChat({ messages, system, stream, maxTokens });
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

  // NOTA: el system se pasa en la llamada a chatCompletion, no aquí,
  // para que el dispatcher lo coloque correctamente según el provider

  if (!stream) {
    // ── Respuesta sin streaming ──────────────────────────────────────────
    try {
      const upstream = await chatCompletion({
        messages: [...allMessages, ...messages],
        system: systemContent,
        stream: false,
        maxTokens: 2048,
      });

      const d    = await upstream.json();
      const text = d.choices?.[0]?.message?.content || '';
      // Limpiar think tags para respuesta no-streaming
      const clean = text.replace(/<[\s\S]*?<\/think>/gi, '').trim();
      return res.json({ text: clean, model: getModel() });
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
    const upstream = await chatCompletion({
      messages: [...allMessages, ...messages],
      system: systemContent,
      stream: true,
      maxTokens: 2048,
    });

    if (!upstream.ok) {
      send({ type: 'error', text: `${upstream.status}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Detectar si la respuesta es SSE (LM Studio) o JSON (error)
    const contentType = upstream.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // ── Streaming SSE desde LM Studio u Ollama ──────────────────────
      const reader = upstream.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = '';

      const filter = new ThinkingFilter(
        (text) => { if (text) send({ type: 'text', text }); },
        (think) => {
          if (!thinking) return;
          if (think === null) send({ type: 'thinking_done' });
          else if (think) send({ type: 'thinking', text: think });
        },
      );

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

    } else {
      // ── Respuesta no-streaming inesperada (JSON directo) ────────────
      const text = await upstream.text();
      try {
        const d = JSON.parse(text);
        const content = d.choices?.[0]?.message?.content || d.message?.content || '';
        if (content) send({ type: 'text', text: content });
      } catch {
        send({ type: 'text', text });
      }
    }

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
    const [ollamaCheck, lmstudioCheck, searxng] = await Promise.allSettled([
      fetch(`${OLLAMA_URL}/v1/models`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${LMSTUDIO_URL}/models`, { signal: AbortSignal.timeout(3000) }),
      fetch('http://localhost:8888/healthz', { signal: AbortSignal.timeout(2000) }),
    ]);

    const ollamaOk  = ollamaCheck.status === 'fulfilled' && ollamaCheck.value?.ok;
    const lmstudioOk = lmstudioCheck.status === 'fulfilled' && lmstudioCheck.value?.ok;

    let models = [];
    if (ollamaOk) {
      try { models = [...models, ...((await ollamaCheck.value.json()).data?.map(m => m.id) || [])]; } catch {}
    }
    if (lmstudioOk) {
      try { models = [...models, ...((await lmstudioCheck.value.json()).data?.map(m => m.id || m.model) || [])]; } catch {}
    }

    const model = getModel();

    res.json({
      ollama:       ollamaOk,
      lmstudio:     lmstudioOk,
      searxng:      searxng.status === 'fulfilled' && searxng.value?.ok,
      models,
      active_model: model,
      provider:     getChatProvider(model),
    });
  } catch (e) {
    res.json({ ollama: false, lmstudio: false, searxng: false, models: [], error: e.message });
  }
});

export const chatRouter = router;