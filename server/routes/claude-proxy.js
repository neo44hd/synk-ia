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
const LOCAL_BASE  = process.env.LOCAL_LLM_URL   || 'http://localhost:11434';
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2.5-coder:14b';
const LOCAL_CTX   = parseInt(process.env.LOCAL_LLM_CTX || '16384', 10);

// ── Conversión Anthropic messages → Ollama native messages ──────────────────
// Ollama /api/chat espera: { role: string, content: string }
// Anthropic envía content como string O array de bloques (text, tool_use, tool_result)
function toOllamaMessages(anthropicMessages) {
  const result = [];

  for (const msg of anthropicMessages) {
    // Caso simple: content ya es string
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    // content es undefined/null → string vacío
    if (!msg.content) {
      result.push({ role: msg.role, content: '' });
      continue;
    }

    // content es array de bloques
    if (Array.isArray(msg.content)) {
      const parts = [];

      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          parts.push(block.text);
        } else if (block.type === 'tool_use') {
          // Assistant pidió usar una tool → serializar como texto
          parts.push(`[Tool call: ${block.name}(${JSON.stringify(block.input || {})})]`);
        } else if (block.type === 'tool_result') {
          // Resultado de tool → serializar como texto
          const resultText = Array.isArray(block.content)
            ? block.content.map(c => c.text || JSON.stringify(c)).join('\n')
            : (typeof block.content === 'string' ? block.content : JSON.stringify(block.content || ''));
          parts.push(`[Tool result for ${block.tool_use_id || 'unknown'}]: ${resultText}`);
        } else if (block.type === 'image') {
          parts.push('[Image content omitted]');
        } else {
          // Cualquier otro tipo → serializar
          parts.push(JSON.stringify(block));
        }
      }

      result.push({ role: msg.role, content: parts.join('\n') || '' });
      continue;
    }

    // Fallback: convertir a string lo que sea
    result.push({ role: msg.role, content: String(msg.content) });
  }

  return result;
}

// ── Conversión de tools Anthropic → Ollama native ───────────────────────────
function toOllamaTools(tools) {
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
    const { model, messages, system, tools, max_tokens = 4096, temperature = 0.1 } = req.body;

    // Construir mensajes para Ollama
    const ollamaMessages = [];
    if (system) {
      const systemText = typeof system === 'string'
        ? system
        : Array.isArray(system)
          ? system.map(s => s.text || JSON.stringify(s)).join('\n')
          : JSON.stringify(system);
      ollamaMessages.push({ role: 'system', content: systemText });
    }
    ollamaMessages.push(...toOllamaMessages(messages || []));

    const ollamaTools = toOllamaTools(tools);

    const body = {
      model:    LOCAL_MODEL,
      messages: ollamaMessages,
      stream:   false,
      options: {
        num_ctx:     LOCAL_CTX,
        num_predict: max_tokens,
        temperature,
      },
      ...(ollamaTools ? { tools: ollamaTools } : {}),
    };

    console.log(`[PROXY] → Ollama /api/chat | model=${LOCAL_MODEL} ctx=${LOCAL_CTX} msgs=${ollamaMessages.length} tools=${ollamaTools?.length || 0}`);

    const resp = await fetch(`${LOCAL_BASE}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[PROXY] Ollama error:', resp.status, err);
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

    // Si no hay contenido alguno, devolver texto vacío para evitar error en Claude Code
    if (content.length === 0) {
      content.push({ type: 'text', text: '(sin respuesta del modelo)' });
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
        input_tokens:  ollResp.prompt_eval_count || 0,
        output_tokens: ollResp.eval_count        || 0,
      },
    });

  } catch (e) {
    console.error('[PROXY] Exception:', e.message);
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
