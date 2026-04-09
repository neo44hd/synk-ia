/**
 * chat.js — Proxy de chat al modelo local (LiteLLM / LM Studio)
 * POST /api/chat  → streaming SSE al navegador
 */

import { Router } from 'express';

const router = Router();
const LLM_BASE = process.env.LOCAL_LLM_URL || 'http://localhost:12345';
const LLM_PORT = process.env.LITELLM_PORT   || '8082';
const PROXY    = `http://localhost:${LLM_PORT}`;
const MODEL    = process.env.LOCAL_LLM_MODEL || 'medina-qwen3-14b-openclaw';

// ── POST /api/chat ─────────────────────────────────────────────────────────────
// Body: { messages: [{role, content}], stream?: true, system?: string }
router.post('/', async (req, res) => {
  const { messages = [], system, stream = true } = req.body;

  const allMessages = [];
  if (system) allMessages.push({ role: 'system', content: system });
  allMessages.push(...messages);

  try {
    // Intentar vía LiteLLM proxy primero (Anthropic format)
    const endpoint = `${PROXY}/v1/messages`;
    const payload  = {
      model:      MODEL,
      messages:   allMessages,
      max_tokens: 8192,
      stream:     !!stream,
    };

    const upstream = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     'local',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      // Fallback: intentar OpenAI format directo con LM Studio
      return await openaiChat(req, res, allMessages, stream);
    }

    if (!stream) {
      const data = await upstream.json();
      const text = data.content?.find(c => c.type === 'text')?.text || '';
      return res.json({ text, model: data.model || MODEL });
    }

    // ── Streaming SSE ───────────────────────────────────────────────────────────
    res.setHeader('Content-Type',      'text/event-stream');
    res.setHeader('Cache-Control',     'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

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
        if (raw === '[DONE]') { res.write('data: [DONE]\n\n'); continue; }
        try {
          const evt = JSON.parse(raw);
          // Anthropic SSE: content_block_delta con text delta
          const delta = evt.delta?.text || evt.delta?.thinking || '';
          if (delta) res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        } catch {}
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (e) {
    // Fallback completo
    console.error('[CHAT] Error LiteLLM:', e.message, '— intentando LM Studio directo');
    return await openaiChat(req, res, allMessages, stream);
  }
});

// ── Fallback OpenAI directo ────────────────────────────────────────────────────
async function openaiChat(req, res, messages, stream) {
  try {
    const upstream = await fetch(`${LLM_BASE}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
      body: JSON.stringify({ model: MODEL, messages, stream: !!stream, max_tokens: 8192 }),
    });

    if (!stream) {
      const d = await upstream.json();
      return res.json({ text: d.choices?.[0]?.message?.content || '', model: MODEL });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

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
        if (raw === '[DONE]') { res.write('data: [DONE]\n\n'); continue; }
        try {
          const d    = JSON.parse(raw);
          const text = d.choices?.[0]?.delta?.content || '';
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch {}
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── GET /api/chat/status ──────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  try {
    const r = await fetch(`${PROXY}/health`, { signal: AbortSignal.timeout(2000) });
    const litellm_ok = r.ok;
    const lm_r = await fetch(`${LLM_BASE}/v1/models`, {
      headers: { Authorization: 'Bearer local' },
      signal: AbortSignal.timeout(2000),
    });
    const models = lm_r.ok ? (await lm_r.json()).data?.map(m => m.id) || [] : [];
    res.json({ litellm: litellm_ok, lm_studio: lm_r.ok, models, active_model: MODEL });
  } catch (e) {
    res.json({ litellm: false, lm_studio: false, models: [], error: e.message });
  }
});

export const chatRouter = router;
