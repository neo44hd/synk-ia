/**
 * claude-proxy.js — Proxy Anthropic API → Ollama nativo (/api/chat)
 *
 * Permite usar Claude Code con un modelo local gratuito:
 *   export ANTHROPIC_BASE_URL=http://localhost:3001/claude
 *   export ANTHROPIC_API_KEY=local-free
 *
 * Requiere Ollama corriendo en http://localhost:11434
 * Usa la API nativa /api/chat (soporta num_ctx para ventana de contexto)
 *
 * Variables de entorno:
 *   LOCAL_LLM_URL   = http://localhost:11434  (Ollama)
 *   LOCAL_LLM_MODEL = qwen2.5-coder:14b       (modelo a usar)
 *   LOCAL_LLM_CTX   = 16384                   (ventana de contexto en tokens)
 */

import { Router } from 'express';

const router = Router();
const LOCAL_BASE = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2.5-coder:14b';
const LOCAL_CTX   = parseInt(process.env.LOCAL_LLM_CTX || '16384', 10);

// ── Conversión de mensajes Anthropic → OpenAI ────────────────────────────────
function toOpenAIMessages(messages) {
  const result = [];
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }
    if (!Array.isArray(msg.content)) continue;

    // Separar tool_result en mensajes independientes de role:tool
    const toolResults = msg.content.filter(b => b.type === 'tool_result');
    const textBlocks  = msg.content.filter(b => b.type === 'text');
    const toolUse     = msg.content.filter(b => b.type === 'tool_use');

    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        const content = Array.isArray(tr.content)
          ? tr.content.map(c => c.text || JSON.stringify(c)).join('\n')
          : (tr.content || '');
        result.push({ role: 'tool', tool_call_id: tr.tool_use_id, content });
      }
    } else {
      const text = textBlocks.map(b => b.text).join('\n');
      const tool_calls = toolUse.map(tu => ({
        id:       tu.id,
        type:     'function',
        function: { name: tu.name, arguments: JSON.stringify(tu.input || {}) },
      }));
      const oaiMsg = { role: msg.role };
      if (text)              oaiMsg.content = text;
      if (tool_calls.length) oaiMsg.tool_calls = tool_calls;
      result.push(oaiMsg);
    }
  }
  return result;
}

// ── Conversión de tools Anthropic → OpenAI ───────────────────────────────────
function toOpenAITools(tools) {
  if (!tools?.length) return undefined;
  return tools.map(t => ({
    type: 'function',
    function: {
      name:        t.name,
      description: t.description || '',
      parameters:  t.input_schema || { type: 'object', properties: {} },
    },
  }));
}

// ── POST /claude/v1/messages ──────────────────────────────────────────────────
router.post('/v1/messages', async (req, res) => {
  try {
    const { model, messages, system, tools, max_tokens = 4096, temperature = 0.1, stream } = req.body;

    // Construir mensajes OpenAI
    const oaiMessages = [];
    if (system) oaiMessages.push({ role: 'system', content: system });
    oaiMessages.push(...toOpenAIMessages(messages || []));

    const oaiTools = toOpenAITools(tools);

    // Usar API nativa Ollama /api/chat (soporta options.num_ctx)
    const ollamaMessages = oaiMessages.map(m => {
      // Convertir role:tool → role:assistant (Ollama nativo no soporta role:tool)
      if (m.role === 'tool') return { role: 'assistant', content: m.content || '' };
      return { role: m.role, content: m.content || '' };
    });

    const body = {
      model:   LOCAL_MODEL,
      messages: ollamaMessages,
      stream:  false,
      options: {
        num_ctx:     LOCAL_CTX,
        temperature,
      },
      ...(oaiTools ? { tools: oaiTools } : {}),
    };

    console.log(`[PROXY] → Ollama /api/chat | model=${LOCAL_MODEL} ctx=${LOCAL_CTX} msgs=${ollamaMessages.length}`);

    // Llamada a la API nativa de Ollama
    const resp = await fetch(`${LOCAL_BASE}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[PROXY] Error del servidor local:', err);
      return res.status(resp.status).json({ error: err });
    }

    const ollResp = await resp.json();

    // Convertir respuesta Ollama nativa → formato Anthropic
    const content = [];
    if (ollResp.message?.content) {
      content.push({ type: 'text', text: ollResp.message.content });
    }
    if (ollResp.message?.tool_calls?.length) {
      for (const tc of ollResp.message.tool_calls) {
        content.push({
          type:  'tool_use',
          id:    `toolu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name:  tc.function.name,
          input: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments || '{}')
            : (tc.function.arguments || {}),
        });
      }
    }

    const stop_reason = ollResp.message?.tool_calls?.length ? 'tool_use' : 'end_turn';

    res.json({
      id:            `msg_local_${Date.now()}`,
      type:          'message',
      role:          'assistant',
      content,
      model:         model || LOCAL_MODEL,
      stop_reason,
      stop_sequence: null,
      usage: {
        input_tokens:  ollResp.prompt_eval_count   || 0,
        output_tokens: ollResp.eval_count           || 0,
      },
    });

  } catch (e) {
    console.error('[PROXY]', e.message);
    res.status(500).json({ error: { type: 'api_error', message: e.message } });
  }
});

// ── GET /claude/v1/models (requerido por Claude Code) ─────────────────────────
router.get('/v1/models', (_req, res) => {
  res.json({
    data: [
      { id: LOCAL_MODEL, object: 'model', created: Date.now(), owned_by: 'local' },
      { id: 'claude-3-5-sonnet-20241022', object: 'model', created: Date.now(), owned_by: 'local' },
    ],
  });
});

export const claudeProxyRouter = router;
