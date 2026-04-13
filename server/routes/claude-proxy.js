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
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, extname } from 'path';

const router = Router();
const LOCAL_BASE  = process.env.LOCAL_LLM_URL   || 'http://localhost:11434';
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2.5-coder:14b';
const LOCAL_CTX   = parseInt(process.env.LOCAL_LLM_CTX || '16384', 10);

// ── System prompt compacto (reemplaza el de Claude Code que pesa ~23K tokens) ──
const COMPACT_SYSTEM = `You are an expert coding assistant running locally via Ollama (qwen2.5-coder:14b).
You help the user edit code, fix bugs, refactor, and answer technical questions.

Rules:
- Be concise and direct. No filler.
- When editing files, show only the changed lines with enough context to locate them.
- Use the tools provided when needed (Bash, file read/write, etc.).
- If a task is ambiguous, ask for clarification.
- Respond in the same language the user writes in.
- You are working in the project directory. Use relative paths.
- For shell commands, prefer one-liners when possible.
- Never fabricate file contents — read first, then edit.`;

// Umbral: si el system prompt supera este tamaño (en chars), lo reemplazamos
const SYSTEM_REPLACE_THRESHOLD = 5000;

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

      // Si el system prompt es gigante (Claude Code mete ~23K tokens),
      // lo reemplazamos por uno compacto optimizado para el modelo local
      if (systemText.length > SYSTEM_REPLACE_THRESHOLD) {
        console.log(`[PROXY] System prompt original: ${systemText.length} chars → reemplazado por compacto (${COMPACT_SYSTEM.length} chars)`);
        ollamaMessages.push({ role: 'system', content: COMPACT_SYSTEM });
      } else {
        ollamaMessages.push({ role: 'system', content: systemText });
      }
    }
    ollamaMessages.push(...toOllamaMessages(messages || []));

    // NO pasar tools a Ollama — Claude Code envía decenas de tools con schemas
    // enormes que saturan el contexto y confunden a qwen2.5-coder.
    // El modelo responde mejor en texto plano sin tool calling formal.
    const toolCount = tools?.length || 0;

    const body = {
      model:    LOCAL_MODEL,
      messages: ollamaMessages,
      stream:   false,
      options: {
        num_ctx:     LOCAL_CTX,
        num_predict: max_tokens,
        temperature,
      },
    };

    // Calcular tamaño total de mensajes para logging
    const totalChars = ollamaMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    console.log(`[PROXY] → Ollama /api/chat | model=${LOCAL_MODEL} ctx=${LOCAL_CTX} msgs=${ollamaMessages.length} chars=${totalChars} tools_dropped=${toolCount}`);

    const t0 = Date.now();
    const resp = await fetch(`${LOCAL_BASE}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[PROXY] Ollama error (${elapsed}s):`, resp.status, err);
      return res.status(resp.status).json({ error: err });
    }

    const ollResp = await resp.json();
    console.log(`[PROXY] ← Ollama (${elapsed}s) | eval=${ollResp.eval_count || 0} tokens | content=${(ollResp.message?.content || '').length} chars`);

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

// ── Directorio del proyecto (configurable) ──────────────────────────────────
const PROJECT_DIR = process.env.SINKIA_PROJECT_DIR || '/Users/davidnows/sinkia';
const MAX_FILE_SIZE = 100_000; // 100KB max per file
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.nuxt', 'coverage', '.cache', '__pycache__', '.DS_Store']);
const CODE_EXTS = new Set(['.js','.ts','.jsx','.tsx','.vue','.svelte','.py','.go','.rs','.rb','.java','.c','.cpp','.h','.css','.scss','.html','.json','.yaml','.yml','.toml','.md','.sh','.sql','.env','.mjs','.cjs']);

// ── GET /claude/files — árbol de archivos del proyecto ───────────────────────
async function walkDir(dir, base, depth = 0) {
  if (depth > 5) return [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('._')) continue;
    const full = join(dir, e.name);
    const rel = relative(base, full);
    if (e.isDirectory()) {
      results.push({ name: e.name, path: rel, type: 'dir', children: await walkDir(full, base, depth + 1) });
    } else if (CODE_EXTS.has(extname(e.name).toLowerCase())) {
      const s = await stat(full).catch(() => null);
      if (s && s.size <= MAX_FILE_SIZE) {
        results.push({ name: e.name, path: rel, type: 'file', size: s.size });
      }
    }
  }
  return results.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

router.get('/files', async (_req, res) => {
  try {
    const tree = await walkDir(PROJECT_DIR, PROJECT_DIR);
    res.json({ ok: true, root: PROJECT_DIR, tree });
  } catch (e) {
    res.json({ ok: false, error: e.message, tree: [] });
  }
});

// ── POST /claude/files/read — leer contenido de archivos seleccionados ───────
router.post('/files/read', async (req, res) => {
  const { paths = [] } = req.body;
  if (!paths.length) return res.json({ ok: true, files: [] });
  const files = [];
  for (const p of paths.slice(0, 20)) { // max 20 files
    const full = join(PROJECT_DIR, p);
    // Seguridad: no permitir path traversal
    if (!full.startsWith(PROJECT_DIR)) continue;
    try {
      const content = await readFile(full, 'utf-8');
      if (content.length <= MAX_FILE_SIZE) {
        files.push({ path: p, content });
      } else {
        files.push({ path: p, content: content.slice(0, MAX_FILE_SIZE) + '\n... [truncado]' });
      }
    } catch (e) {
      files.push({ path: p, content: `[Error: ${e.message}]` });
    }
  }
  res.json({ ok: true, files });
});

// ── GET /claude/chat/status — estado del proxy para la pestaña web ────────────
router.get('/chat/status', async (_req, res) => {
  try {
    const r = await fetch(`${LOCAL_BASE}/api/tags`);
    const d = await r.json();
    const found = d.models?.some(m => m.name === LOCAL_MODEL || m.name === LOCAL_MODEL.split(':')[0]);
    res.json({ ok: true, ollama: r.ok, model: LOCAL_MODEL, available: !!found });
  } catch (e) {
    res.json({ ok: false, ollama: false, model: LOCAL_MODEL, available: false, error: e.message });
  }
});

// ── POST /claude/chat — chat SSE para la pestaña web ─────────────────────────
// Acepta { messages, contextFiles?: string[], stream }
// Si contextFiles tiene rutas, lee los archivos y los inyecta en el system prompt
router.post('/chat', async (req, res) => {
  const { messages = [], contextFiles = [], stream = true } = req.body;

  // Headers SSE
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // Leer archivos de contexto si los hay
    let contextBlock = '';
    if (contextFiles.length > 0) {
      const fileContents = [];
      for (const p of contextFiles.slice(0, 15)) {
        const full = join(PROJECT_DIR, p);
        if (!full.startsWith(PROJECT_DIR)) continue;
        try {
          let content = await readFile(full, 'utf-8');
          if (content.length > MAX_FILE_SIZE) content = content.slice(0, MAX_FILE_SIZE) + '\n... [truncado]';
          fileContents.push(`── ${p} ──\n${content}`);
        } catch {}
      }
      if (fileContents.length) {
        contextBlock = `\n\nThe user has loaded these project files as context:\n\n${fileContents.join('\n\n')}`;
      }
      console.log(`[PROXY-WEB] Context files: ${contextFiles.length} → ${contextBlock.length} chars`);
    }

    // Construir mensajes para Ollama
    const ollamaMsgs = [
      { role: 'system', content: COMPACT_SYSTEM + contextBlock },
      ...messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
    ];

    const body = {
      model:    LOCAL_MODEL,
      messages: ollamaMsgs,
      stream:   true,
      options: {
        num_ctx:     LOCAL_CTX,
        num_predict: 4096,
        temperature: 0.1,
      },
    };

    const totalChars = ollamaMsgs.reduce((s, m) => s + (m.content?.length || 0), 0);
    console.log(`[PROXY-WEB] → Ollama /api/chat | model=${LOCAL_MODEL} msgs=${ollamaMsgs.length} chars=${totalChars}`);
    const t0 = Date.now();

    const resp = await fetch(`${LOCAL_BASE}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      send({ type: 'error', text: `Ollama error: ${resp.status} — ${err}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Leer streaming NDJSON de Ollama
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.message?.content) {
            fullText += chunk.message.content;
            send({ type: 'text', text: chunk.message.content });
          }
          if (chunk.done) {
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            console.log(`[PROXY-WEB] ← Ollama (${elapsed}s) | eval=${chunk.eval_count || 0} tokens | total=${fullText.length} chars`);
          }
        } catch {}
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (e) {
    console.error('[PROXY-WEB] Exception:', e.message);
    send({ type: 'error', text: e.message });
    res.write('data: [DONE]\n\n');
    res.end();
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
