// ═══════════════════════════════════════════════════════════════════════════
//  OLLAMA PROXY — Traduce OpenAI API → Ollama local
//  Puerto: 11435 → Ollama en 11434
//  Usado por: Claude Code (via Aider), OpenClaw, Chat web
// ═══════════════════════════════════════════════════════════════════════════
import http from 'node:http';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const PORT = parseInt(process.env.OLLAMA_PROXY_PORT || '11435');
const THINK = process.env.OLLAMA_THINK === 'true';

// ── Modelo por defecto según cliente ────────────────────────────────────
const DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'harmonic-hermes-9b:latest';

// ── Mapeo de modelos (nombres OpenAI → modelos Ollama locales) ──────────
// Solo modelos instalados en Ollama: harmonic-hermes-9b, qwen2.5-coder, glm-ocr
const MODEL_MAP = {
  // Claude Code / Aider
  'claude-3-5-sonnet-20241022': process.env.OLLAMA_DEFAULT_MODEL || 'harmonic-hermes-9b:latest',
  'claude-3-5-sonnet':          process.env.OLLAMA_DEFAULT_MODEL || 'harmonic-hermes-9b:latest',

  // OpenAI compat
  'gpt-4':      process.env.OLLAMA_DEFAULT_MODEL || 'harmonic-hermes-9b:latest',
  'gpt-4o':     process.env.OLLAMA_DEFAULT_MODEL || 'harmonic-hermes-9b:latest',
  'gpt-4o-mini': process.env.OLLAMA_DEFAULT_MODEL || 'harmonic-hermes-9b:latest',
  'gpt-3.5-turbo': 'qwen2.5-coder:0.5b-instruct',

  // OpenClaw / function calling
  'functiongemma': 'functiongemma:latest',
  'codegemma':     'codegemma:7b',
  'qwen3.5':       'harmonic-hermes-9b:latest',

  // Directos (pass-through si el modelo existe en Ollama)
  'qwen36-tools:latest':            'harmonic-hermes-9b:latest',
  'harmonic-hermes-9b:latest':     'harmonic-hermes-9b:latest',
  'qwen2.5-coder:0.5b-instruct':   'qwen2.5-coder:0.5b-instruct',
  'glm-ocr:latest':                 'glm-ocr:latest',
  'codegemma:7b':                   'codegemma:7b',
};

function mapModel(requested) {
  if (!requested) return DEFAULT_MODEL;
  // Exacto
  if (MODEL_MAP[requested]) return MODEL_MAP[requested];
  // Parcial (buscar por prefijo)
  const lower = requested.toLowerCase();
  for (const [key, val] of Object.entries(MODEL_MAP)) {
    if (lower.startsWith(key.toLowerCase())) return val;
  }
  // Pass-through (dejar que Ollama resuelva)
  return requested;
}

// ── Helper: proxy request a Ollama ──────────────────────────────────────
async function proxyToOllama(ollamaPath, body, res, stream = false) {
  const url = `${OLLAMA_HOST}${ollamaPath}`;
  
  try {
    const fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
    
    const ollamaRes = await fetch(url, fetchOpts);
    
    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      res.writeHead(ollamaRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: errText, type: 'ollama_error' } }));
      return;
    }
    
    if (stream && body.stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      
      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Ollama devuelve JSON lines, convertir a SSE format
        for (const line of chunk.split('\n').filter(l => l.trim())) {
          try {
            const data = JSON.parse(line);
            const sseData = formatStreamChunk(data, body._requestedModel || DEFAULT_MODEL);
            res.write(`data: ${JSON.stringify(sseData)}\n\n`);
            if (data.done) {
              res.write('data: [DONE]\n\n');
            }
          } catch {}
        }
      }
      res.end();
    } else {
      const data = await ollamaRes.json();
      const formatted = formatCompletion(data, body._requestedModel || DEFAULT_MODEL);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(formatted));
    }
  } catch (err) {
    console.error(`[PROXY] Error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Ollama connection failed: ${err.message}`, type: 'proxy_error' } }));
  }
}

// ── Formatear respuesta Ollama → formato OpenAI ─────────────────────────
function formatCompletion(ollamaData, requestedModel) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: ollamaData.message?.content || ollamaData.response || '',
      },
      finish_reason: ollamaData.done ? 'stop' : 'length',
    }],
    usage: {
      prompt_tokens: ollamaData.prompt_eval_count || 0,
      completion_tokens: ollamaData.eval_count || 0,
      total_tokens: (ollamaData.prompt_eval_count || 0) + (ollamaData.eval_count || 0),
    },
  };
}

function formatStreamChunk(ollamaData, requestedModel) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [{
      index: 0,
      delta: {
        role: ollamaData.message?.role || undefined,
        content: ollamaData.message?.content || '',
      },
      finish_reason: ollamaData.done ? 'stop' : null,
    }],
  };
}

// ── Leer body del request ───────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Server HTTP ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = req.url?.split('?')[0];

  // ── GET /v1/models ──────────────────────────────────────────────────
  if (url === '/v1/models' && req.method === 'GET') {
    try {
      const ollamaRes = await fetch(`${OLLAMA_HOST}/api/tags`);
      const data = await ollamaRes.json();
      const models = (data.models || []).map(m => ({
        id: m.name,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'ollama',
      }));
      // Añadir aliases OpenAI
      const aliases = Object.keys(MODEL_MAP).map(name => ({
        id: name,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'ollama-proxy',
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [...models, ...aliases] }));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: err.message } }));
    }
    return;
  }

  // ── POST /v1/chat/completions ─────────────────────────────────────
  if (url === '/v1/chat/completions' && req.method === 'POST') {
    const body = await readBody(req);
    const requestedModel = body.model || DEFAULT_MODEL;
    const ollamaModel = mapModel(requestedModel);
    
    console.log(`[PROXY] ${requestedModel} → ${ollamaModel} (${body.messages?.length || 0} msgs, stream: ${!!body.stream})`);
    
    const ollamaBody = {
      model: ollamaModel,
      messages: body.messages || [],
      stream: !!body.stream,
      options: {
        temperature: body.temperature ?? 0.7,
        top_p: body.top_p ?? 0.9,
        num_predict: body.max_tokens || body.max_completion_tokens || 2048,
      },
      _requestedModel: requestedModel,
    };
    
    if (THINK) ollamaBody.think = true;
    
    await proxyToOllama('/api/chat', ollamaBody, res, !!body.stream);
    return;
  }

  // ── POST /v1/completions (legacy) ─────────────────────────────────
  if (url === '/v1/completions' && req.method === 'POST') {
    const body = await readBody(req);
    const requestedModel = body.model || DEFAULT_MODEL;
    const ollamaModel = mapModel(requestedModel);
    
    const ollamaBody = {
      model: ollamaModel,
      prompt: body.prompt || '',
      stream: false,
      options: {
        temperature: body.temperature ?? 0.7,
        num_predict: body.max_tokens || 2048,
      },
      _requestedModel: requestedModel,
    };
    
    await proxyToOllama('/api/generate', ollamaBody, res, false);
    return;
  }

  // ── Health check ──────────────────────────────────────────────────
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ollama: OLLAMA_HOST, port: PORT, think: THINK }));
    return;
  }

  // ── Pass-through: rutas nativas de Ollama (/api/*) ────────────────
  // OpenClaw y otros clientes nativos llaman a /api/chat, /api/tags, etc.
  // Reenviamos directamente a Ollama sin transformar.
  if (url?.startsWith('/api/')) {
    try {
      const targetUrl = `${OLLAMA_HOST}${req.url}`;
      const fetchOpts = { method: req.method, headers: { 'Content-Type': 'application/json' } };

      if (req.method === 'POST' || req.method === 'PUT') {
        const body = await readBody(req);
        fetchOpts.body = JSON.stringify(body);
      }

      const ollamaRes = await fetch(targetUrl, fetchOpts);
      const contentType = ollamaRes.headers.get('content-type') || 'application/json';

      // Streaming (Ollama usa application/x-ndjson para streams)
      if (contentType.includes('ndjson') || contentType.includes('stream')) {
        res.writeHead(ollamaRes.status, {
          'Content-Type': contentType,
          'Transfer-Encoding': 'chunked',
        });
        const reader = ollamaRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const text = await ollamaRes.text();
        res.writeHead(ollamaRes.status, { 'Content-Type': contentType });
        res.end(text);
      }
    } catch (err) {
      console.error(`[PROXY] /api/* pass-through error: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Ollama unreachable: ${err.message}` } }));
    }
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found', path: url } }));
});

server.listen(PORT, () => {
  console.log(`Ollama proxy (think:${THINK}) en puerto ${PORT}`);
});
