// ═══════════════════════════════════════════════════════════════════════════════
//  LM STUDIO PROXY — Traduce OpenAI API → LM Studio local
//  Uso:   import { lmstudioProxyRouter } from './lmstudio-proxy.mjs'
//         app.use('/lmstudio', lmstudioProxyRouter)
//  Conecta a: LM Studio en LMSTUDIO_BASE_URL (default: http://127.0.0.1:1234/v1)
// ═══════════════════════════════════════════════════════════════════════════════
import { Router } from 'express';

const LMSTUDIO_HOST = process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';
const API_KEY = process.env.LMSTUDIO_API_KEY || '';
const DEFAULT_MODEL = process.env.LMSTUDIO_MODEL || 'negentropy-claude-opus-4.7-9b';

const MODEL_MAP = {
  'claude-3-5-sonnet-20241022': 'negentropy-claude-opus-4.7-9b',
  'claude-3-5-sonnet':          'negentropy-claude-opus-4.7-9b',
  'claude-3-5-sonnet-net':      'negentropy-claude-opus-4.7-9b',
  'gpt-4':                      'negentropy-claude-opus-4.7-9b',
  'gpt-4o':                     'negentropy-claude-opus-4.7-9b',
  'gpt-4o-mini':                'negentropy-claude-opus-4.7-9b',
  'gpt-3.5-turbo':              'negentropy-claude-opus-4.7-9b',
  'deepseek-r1':                'deepseek/deepseek-r1-0528-qwen3-8b',
  'qwen3.6':                    'negentropy-claude-opus-4.7-9b',
  'deepseek/deepseek-r1-0528-qwen3-8b': 'deepseek/deepseek-r1-0528-qwen3-8b',
};

function mapModel(requested) {
  if (!requested) return DEFAULT_MODEL;
  if (MODEL_MAP[requested]) return MODEL_MAP[requested];
  const lower = requested.toLowerCase();
  for (const [key, val] of Object.entries(MODEL_MAP)) {
    if (lower.startsWith(key.toLowerCase())) return val;
  }
  return requested;
}

async function proxyToLmStudio(url, body, res, stream = false) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

    const lmRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!lmRes.ok) {
      const errText = await lmRes.text();
      res.status(lmRes.status).json({ error: { message: errText, type: 'lmstudio_error' } });
      return;
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const reader = lmRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n').filter(l => l.trim())) {
          try {
            const data = JSON.parse(line);
            const sseData = formatStreamChunk(data, body._requestedModel || DEFAULT_MODEL);
            res.write(`data: ${JSON.stringify(sseData)}\n\n`);
            if (data.choices?.[0]?.finish_reason === 'stop') {
              res.write('data: [DONE]\n\n');
            }
          } catch {}
        }
      }
      res.end();
    } else {
      const data = await lmRes.json();
      res.json(formatCompletion(data, body._requestedModel || DEFAULT_MODEL));
    }
  } catch (err) {
    console.error(`[LM-STUDIO-PROXY] Error: ${err.message}`);
    res.status(502).json({
      error: {
        message: `LM Studio connection failed: ${err.message}. ¿Está habilitado el servidor API en LM Studio?`,
        type: 'proxy_error',
        hint: 'Abre LM Studio → Settings → General → "Enable local server" → Puerto 1234 → "Listen on all interfaces"',
      },
    });
  }
}

function formatCompletion(lmData, requestedModel) {
  const msg = lmData.choices?.[0]?.message || {};
  const content = msg.content || '';
  const reasoning = msg.reasoning_content || '';
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: reasoning || content,
      },
      finish_reason: lmData.choices?.[0]?.finish_reason || 'stop',
    }],
    usage: lmData.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

function formatStreamChunk(lmData, requestedModel) {
  const delta = lmData.choices?.[0]?.delta || {};
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [{
      index: 0,
      delta: {
        role: delta.role || undefined,
        content: delta.content || delta.reasoning_content || '',
      },
      finish_reason: lmData.choices?.[0]?.finish_reason || null,
    }],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Router Express
// ═══════════════════════════════════════════════════════════════════════════════
const lmstudioProxyRouter = Router();

// GET /lmstudio/models → lista de modelos de LM Studio
lmstudioProxyRouter.get('/models', async (req, res) => {
  try {
    const headers = {};
    if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
    const lmRes = await fetch(`${LMSTUDIO_HOST}/models`, { headers });
    const data = await lmRes.json();

    const models = (data.data || []).map(m => ({
      id: m.id || m.model || m.name,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'lmstudio',
    }));

    const aliases = Object.keys(MODEL_MAP).map(name => ({
      id: name,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'lmstudio-proxy',
    }));

    res.json({ object: 'list', data: [...models, ...aliases] });
  } catch (err) {
    res.status(502).json({
      error: { message: `LM Studio no responde en ${LMSTUDIO_HOST}: ${err.message}` },
    });
  }
});

// POST /lmstudio/chat/completions
lmstudioProxyRouter.post('/chat/completions', async (req, res) => {
  const body = req.body;
  const requestedModel = body.model || DEFAULT_MODEL;
  const lmModel = mapModel(requestedModel);

  console.log(`[LM-STUDIO-PROXY] ${requestedModel} → ${lmModel} (${body.messages?.length || 0} msgs, stream: ${!!body.stream})`);

  const lmBody = {
    model: lmModel,
    messages: (body.messages || []).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    stream: !!body.stream,
    temperature: body.temperature ?? 0.7,
    max_tokens: body.max_tokens || body.max_completion_tokens || 4096,
    num_ctx: parseInt(process.env.NUM_CTX || '8192', 10),
    _requestedModel: requestedModel,
  };

  await proxyToLmStudio(`${LMSTUDIO_HOST}/chat/completions`, lmBody, res, !!body.stream);
});

// POST /lmstudio/completions (legacy)
lmstudioProxyRouter.post('/completions', async (req, res) => {
  const body = req.body;
  const requestedModel = body.model || DEFAULT_MODEL;
  const lmModel = mapModel(requestedModel);

  const lmBody = {
    model: lmModel,
    prompt: body.prompt || '',
    stream: false,
    temperature: body.temperature ?? 0.7,
    max_tokens: body.max_tokens || 4096,
    num_ctx: parseInt(process.env.NUM_CTX || '8192', 10),
    _requestedModel: requestedModel,
  };

  await proxyToLmStudio(`${LMSTUDIO_HOST}/completions`, lmBody, res, false);
});

// Health check
lmstudioProxyRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    target: LMSTUDIO_HOST,
    model: DEFAULT_MODEL,
  });
});

export { lmstudioProxyRouter };