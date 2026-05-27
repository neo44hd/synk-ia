/**
 * ai.js — AI endpoints via Ollama + LM Studio (dual provider)
 * ============================================================
 * API surface IDÉNTICA a la versión anterior (node-llama-cpp).
 * El frontend no necesita ningún cambio.
 *
 * Soporte triple:
 *   - Ollama (localhost:11434)     → modelos rápidos/ligeros
 *   - LM Studio (localhost:1234)  → modelos con soporte tools
 *   - OpenRouter (api.openrouter.ai) → modelos free y premium
 *
 * NOTA: Se eliminaron los helpers V3 (v3Ingest, v3WaitDone, v3Children,
 *       v3FieldsToFrontendSchema) y el proxy a api-v3.sinkialabs.com.
 *       Todo el procesamiento es ahora local.
 */

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));

const OLLAMA_URL    = () => process?.env?.OLLAMA_URL       || 'http://localhost:11434';
const LMSTUDIO_URL  = () => process?.env?.LMSTUDIO_URL     || 'http://localhost:1234/v1';
const LMSTUDIO_KEY  = process?.env?.LMSTUDIO_API_KEY || '';
const OPENROUTER_URL = () => process?.env?.OPENROUTER_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_KEY = process?.env?.OPENROUTER_API_KEY || '';

// ── Modelos por path con OpenRouter ──────────────────────────────────────────
const aiRouter = Router();
const LMSTUDIO_MODELS = new Set([
  'negentropy-claude-opus-4.7-9b',
  'deepseek/deepseek-r1-0528-qwen3-8b',
  'qwen/qwen3.5-32b-instruct',
]);

const OPENROUTER_MODELS = new Set([
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-4-turbo',
  'google/gemini-2.0-flash',
  'google/gemini-2.0-flash-lite',
  'google/gemini-2.0-pro',
  'google/gemini-1.5-flash',
  'google/gemini-1.5-pro',
  'google/gemma-2-9b-it',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3-opus',
  'mistralai/mistral-7b-instruct',
  'mistralai/mistral-large-2411',
  'mistralai/mistral-nemo-12b-instruct',
  'mistralai/mixtral-8x7b-instruct',
  'mistralai/mixtral-8x22b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  'meta-llama/llama-3.1-70b-instruct',
  'meta-llama/llama-3.1-405b-instruct',
  'meta-llama/llama-3.2-1b-instruct',
  'meta-llama/llama-3.2-3b-instruct',
  'nvidia/llama-3.1-nemotron-mini-4b',
  'microsoft/phi-4',
  'microsoft/phi-3-mini-128k-instruct',
  'qwen/qwen2.5-coder-7b-instruct',
  'qwen/qwen-2.5-72b-instruct',
  'deepseek/deepseek-r1-0528-qwen3-8b',
  'deepseek/deepseek-ring-2.5-mini-16k',
  'deepseek/deepseek-v3',
  'nousresearch/hermes-3-mixtral-8x7b',
  'nousresearch/hermes-3-llama-3.1-8b',
  'openrouter/free',
]);

function getProvider(model) {
  if (!model) return 'ollama';
  if (model.includes('/')) return 'openrouter';
  if (model.includes(':')) return 'ollama';
  return 'lmstudio';
}
function getClassifyProvider() {
  return process?.env?.CLASSIFY_PROVIDER || 'ollama';
}
function getClassifyModel() {
  return process?.env?.CLASSIFY_MODEL || 'negentropy-claude-opus-4.7-9b';
}
function getChatModel() {
  return process?.env?.CHAT_MODEL || 'negentropy-claude-opus-4.7-9b';
}
function getDefaultModel() {
  return process?.env?.OLLAMA_MODEL || 'harmonic-hermes-9b:latest';
}
function getDeepModel() {
  return process?.env?.DEEP_MODEL || 'negentropy-claude-opus-4.7-9b';
}
function getExtractModel() {
  return process?.env?.EXTRACT_MODEL || 'negentropy-claude-opus-4.7-9b';
}

// ─── Llamar a Ollama ─────────────────────────────────────────────────────────
async function ollamaGenerate({ prompt, system, format, temperature = 0.1, maxTokens = 1024, model }) {
  const body = {
    model:   model || getDefaultModel(),
    prompt,
    stream:  false,
    options: { temperature, num_predict: maxTokens, num_ctx: parseInt(process.env.NUM_CTX || '8192', 10) },
  };
  if (system) body.system = system;
  if (format === 'json') body.format = 'json';

  const t0  = Date.now();
  const res = await fetch(`${OLLAMA_URL()}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return {
    response:       data.response,
    durationMs:     Date.now() - t0,
    eval_duration:  data.eval_duration  || 0,
    total_duration: data.total_duration || 0,
    model:          data.model || model || getDefaultModel(),
  };
}

// ─── Llamar a LM Studio ──────────────────────────────────────────────────────
async function lmstudioGenerate({ prompt, system, format, temperature = 0.1, maxTokens = 1024, model }) {
  const lmModel = model || getClassifyModel();

  const body = {
    model:     lmModel,
    messages:  [{ role: 'user', content: prompt }],
    stream:    false,
    max_tokens: maxTokens || 4096,
    num_ctx:   parseInt(process.env.NUM_CTX || '8192', 10),
    temperature,
  };
  if (system) {
    body.messages.unshift({ role: 'system', content: system });
  }
  if (format === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const t0  = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (LMSTUDIO_KEY) headers['Authorization'] = `Bearer ${LMSTUDIO_KEY}`;

  const res = await fetch(`${LMSTUDIO_URL()}/chat/completions`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LM Studio ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    response:       content,
    durationMs:     Date.now() - t0,
    eval_duration:  0,
    total_duration: Date.now() - t0,
    model:          lmModel,
  };
}

// ─── Llamar a OpenRouter ─────────────────────────────────────────────────────
async function openrouterGenerate({ prompt, system, format, temperature = 0.1, maxTokens = 1024, model }) {
  const body = {
    model: model || getDefaultModel(),
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    max_tokens: maxTokens || 4096,
    temperature,
    top_p: 0.9,
  };
  if (system) {
    body.messages.unshift({ role: 'system', content: system });
  }
  if (format === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const t0  = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (OPENROUTER_KEY) headers['Authorization'] = `Bearer ${OPENROUTER_KEY}`;

  const res = await fetch(`${OPENROUTER_URL()}/chat/completions`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    response:       content,
    durationMs:     Date.now() - t0,
    eval_duration:  0,
    total_duration: Date.now() - t0,
    model:          data.model || body.model,
  };
}

// ─── Dispatcher unificado con fallback automático ──────────────────────────────
async function generate(prompt, system, format, temperature, maxTokens, model) {
  // Si temperature se pasa como object (format=object con model, etc)
  if (typeof format === 'object' && format !== null) {
    model       = format.model;
    temperature = format.temperature;
    maxTokens   = format.maxTokens;
    format      = format.format;
  }

  const m = model || getDefaultModel();
  let provider = getProvider(m);
  const effectiveFormat = format === 'json' ? 'json' : null;

  try {
    if (provider === 'openrouter') {
      return openrouterGenerate({ prompt, system, format: effectiveFormat, temperature, maxTokens, model: m });
    }
    if (provider === 'lmstudio') {
      return lmstudioGenerate({ prompt, system, format: effectiveFormat, temperature, maxTokens, model: m });
    }
    return ollamaGenerate({ prompt, system, format: effectiveFormat, temperature, maxTokens, model: m });
  } catch (err) {
    // Fallback automático a Ollama ligero
    if (provider !== 'ollama') {
      console.warn(`[FALLBACK] ${provider} falló (${err.message}), reintentando con Ollama/${FALLBACK_MODEL}`);
      return ollamaGenerate({ prompt, system, format: effectiveFormat, temperature, maxTokens, model: FALLBACK_MODEL });
    }
    throw err;
  }
}

// ── Log helpers ─────────────────────────────────────────────────────────────
const FALLBACK_MODEL = 'qwen2.5-coder:0.5b-instruct';

function safeParseJSON(raw) {
  if (!raw) return { raw: '' };
  try {
    return JSON.parse(raw);
  } catch {
const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* noop */ }
    }
    return { raw };
  }
}

// ─── Schemas JSON para structured output ────────────────────────────────────

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    type:         { type: 'string', enum: ['factura', 'nomina', 'albaran', 'contrato', 'recibo', 'presupuesto', 'fiscal', 'otro'] },
    confidence:   { type: 'number', minimum: 0, maximum: 100 },
    provider:     { type: 'string' },
    provider_cif: { type: 'string' },
    invoice_number: { type: 'string' },
    date:         { type: 'string' },
    total:        { type: 'number' },
    summary:      { type: 'string' },
  },
  required: ['type', 'confidence', 'summary'],
};

const CLASSIFY_EMAIL_SCHEMA = {
  type: 'object',
  properties: {
    category:    { type: 'string', enum: ['factura', 'proveedor', 'cliente', 'rrhh', 'gestoria', 'marketing', 'interno', 'otro'] },
    priority:    { type: 'string', enum: ['alta', 'media', 'baja'] },
    confidence:  { type: 'number', minimum: 0, maximum: 100 },
    summary:     { type: 'string' },
    action:      { type: 'string' },
    has_invoice: { type: 'boolean' },
  },
  required: ['category', 'priority', 'confidence', 'summary'],
};

// ── System prompts ───────────────────────────────────────────────────────────

const SYSTEM_CLASSIFY = `Eres el clasificador universal de SynK-IA, el sistema de gestión de Chicken Palace Ibiza S.L.

TU MISIÓN: Analizar el input recibido y clasificarlo con precisión.

REGLAS:
1. Analiza TODO el texto antes de clasificar
2. Devuelve ÚNICAMENTE JSON válido, sin texto adicional
3. Sé conservador con la confianza — si dudas, baja la confianza
4. El campo "targetAgent" determina qué agente especializado procesará el input
5. Para emails, prioriza la acción sugerida sobre la clasificación

FORMATO DE RESPUESTA (JSON estricto):
{
  "docType": "invoice|payroll|receipt|delivery_note|contract|bank_extract|legal|fiscal|ticket|quote|email|spam|other",
  "subType": "food_supplier|utility|delivery_platform|... o null si no aplica",
  "priority": "urgent|high|normal|low",
  "confidence": 0.0-1.0,
  "targetAgent": "document|email|accounting|legal|analytics|review",
  "requiresHumanReview": true|false,
  "summary": "Una frase describiendo el contenido",
  "reasoning": "Breve explicación de por qué se asigna esta clasificación"
}

REGLAS DE PRIORIDAD:
- "urgent": multas, notificaciones hacienda, embargos, plazos inminentes (< 7 días)
- "high": facturas vencidas, nóminas con error, contratos próximos a expirar
- "normal": documentos rutinarios sin acción inmediata
- "low": informativos, newsletters, confirmaciones sin acción

REGLAS DE AGENTE DESTINO:
- invoice, receipt, delivery_note, quote → "document"
- payroll, bank_extract, fiscal → "accounting"
- contract, legal docs, notifications → "legal"
- email → "email"
- ticket → "document"
- Si confidence < 0.60 → "review"

REGLAS DE CONFIANZA:
- 0.9+ = Seguro
- 0.7-0.89 = Razonable
- 0.5-0.69 = Dudoso
- < 0.5 = Inseguro`;

const SYSTEM_CLASSIFY_EMAIL = `Eres un clasificador de emails empresariales de SynK-IA.

Clasifica el email y devuelve ÚNICAMENTE JSON válido:
{
  "category": "factura|proveedor|cliente|rrhh|gestoria|marketing|interno|otro",
  "priority": "alta|media|baja",
  "confidence": 0.0-1.0,
  "summary": "resumen en 1 linea",
  "action": "accion sugerida o null",
  "has_invoice": true|false
}`;

// ─── GET /api/ai/test ────────────────────────────────────────────────────────
aiRouter.get('/test', async (req, res) => {
  try {
    const [ollamaRes, lmstudioRes, openrouterRes] = await Promise.allSettled([
      fetch(`${OLLAMA_URL()}/api/tags`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${LMSTUDIO_URL()}/models`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${OPENROUTER_URL()}/models`, { signal: AbortSignal.timeout(8000) }),
    ]);

    const ollamaModels  = ollamaRes.status === 'fulfilled' && ollamaRes.value?.ok
      ? (await ollamaRes.value.json()).models?.map(m => m.name) || []
      : [];
    const lmstudioModels = lmstudioRes.status === 'fulfilled' && lmstudioRes.value?.ok
      ? (await lmstudioRes.value.json()).data?.map(m => m.id || m.model) || []
      : [];
    const openrouterModels = openrouterRes.status === 'fulfilled' && openrouterRes.value?.ok
      ? (await openrouterRes.value.json()).data?.map(m => m.id || m.model) || []
      : [];

    res.json({
      success: true,
      models: [...ollamaModels, ...lmstudioModels, ...openrouterModels],
      count: ollamaModels.length + lmstudioModels.length + openrouterModels.length,
      engine: 'triple',
      providers: {
        ollama:    ollamaModels,
        lmstudio:  lmstudioModels,
        openrouter: openrouterModels,
      },
      active_model: getDefaultModel(),
      dual_path: {
        classify:  getClassifyModel(),
        extract:   getExtractModel(),
        deep:      getDeepModel(),
        chat:      getChatModel(),
      },
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ─── GET /api/ai/models ──────────────────────────────────────────────────────
aiRouter.get('/models', async (req, res) => {
  try {
    const [ollamaRes, lmstudioRes, openrouterRes] = await Promise.allSettled([
      fetch(`${OLLAMA_URL()}/api/tags`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${LMSTUDIO_URL()}/models`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${OPENROUTER_URL()}/models`, { signal: AbortSignal.timeout(8000) }),
    ]);

    const ollamaModels = ollamaRes.status === 'fulfilled' && ollamaRes.value?.ok
      ? (await ollamaRes.value.json()).models?.map(m => ({ name: m.name, provider: 'ollama' })) || []
      : [];
    const lmstudioModels = lmstudioRes.status === 'fulfilled' && lmstudioRes.value?.ok
      ? (await lmstudioRes.value.json()).data?.map(m => ({ name: m.id || m.model, provider: 'lmstudio' })) || []
      : [];
    const openrouterModels = openrouterRes.status === 'fulfilled' && openrouterRes.value?.ok
      ? (await openrouterRes.value.json()).data?.map(m => ({ name: m.id || m.model, provider: 'openrouter' })) || []
      : [];

    res.json({
      success: true,
      models: [...ollamaModels, ...lmstudioModels, ...openrouterModels],
      count: ollamaModels.length + lmstudioModels.length + openrouterModels.length,
      engine: 'triple',
      providers: {
        ollama:    ollamaModels.map(m => m.name),
        lmstudio:  lmstudioModels.map(m => m.name),
        openrouter: openrouterModels.map(m => m.name),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/ai/tags ────────────────────────────────────────────────────────
aiRouter.get('/tags', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL()}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Ollama ${r.status}`);
    const data = await r.json();
    res.json({ success: true, models: data.models || [], count: (data.models || []).length, engine: 'ollama' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/ai/generate ───────────────────────────────────────────────────
aiRouter.post('/generate', async (req, res) => {
  const { prompt, system, temperature = 0.1, format, maxTokens = 1024, model } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'prompt requerido' });
  }

  try {
    const effectiveModel = model || getDeepModel();
    const result = await generate(prompt, system, format, temperature, maxTokens, effectiveModel);
    res.json({
      success:        true,
      response:       result.response,
      model:          result.model,
      provider:       getProvider(result.model),
      eval_duration:  result.eval_duration,
      total_duration: result.total_duration,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/ai/classify ───────────────────────────────────────────────────
aiRouter.post('/classify', async (req, res) => {
  const { text, filename } = req.body;

  if (!text && !filename) {
    return res.status(400).json({ success: false, error: 'text o filename requerido' });
  }

  try {
    const prompt = `Clasifica este documento (archivo: ${filename || 'desconocido'}):\n\n${(text || '').substring(0, 4000)}`;

    const result = await generate(prompt, SYSTEM_CLASSIFY, 'json', 0.1, 512, getClassifyModel());

    const parsed = safeParseJSON(result.response);

    res.json({
      success:        true,
      classification: parsed,
      model:          result.model,
      duration:       result.total_duration,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/ai/classify-email ─────────────────────────────────────────────
aiRouter.post('/classify-email', async (req, res) => {
  const { subject, body: emailBody, from } = req.body;

  try {
    const prompt = `De: ${from || '?'}\nAsunto: ${subject || '?'}\nContenido: ${(emailBody || '').substring(0, 2000)}`;

    const result = await generate(prompt, SYSTEM_CLASSIFY_EMAIL, 'json', 0.1, 256, getClassifyModel());

    const parsed = safeParseJSON(result.response);

    res.json({
      success:        true,
      classification: parsed,
      model:          result.model,
      duration:       result.total_duration,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/ai/status ──────────────────────────────────────────────────────
aiRouter.get('/status', async (req, res) => {
  try {
    const [ollamaRes, lmstudioRes, openrouterRes] = await Promise.allSettled([
      fetch(`${OLLAMA_URL()}/api/tags`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${LMSTUDIO_URL()}/models`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${OPENROUTER_URL()}/models`, { signal: AbortSignal.timeout(8000) }),
    ]);

    const ollamaOk    = ollamaRes.status === 'fulfilled' && ollamaRes.value?.ok;
    const lmstudioOk  = lmstudioRes.status === 'fulfilled' && lmstudioRes.value?.ok;
    const openrouterOk = openrouterRes.status === 'fulfilled' && openrouterRes.value?.ok;

    const ollamaModels  = ollamaOk  ? (await ollamaRes.value.json()).models?.map(m => ({ name: m.name, provider: 'ollama' })) || [] : [];
    const lmstudioModels = lmstudioOk ? (await lmstudioRes.value.json()).data?.map(m => ({ name: m.id || m.model, provider: 'lmstudio' })) || [] : [];
    const openrouterModels = openrouterOk ? (await openrouterRes.value.json()).data?.map(m => ({ name: m.id || m.model, provider: 'openrouter' })) || [] : [];

    const allModels = [...ollamaModels, ...lmstudioModels, ...openrouterModels];

    res.json({
      success: true,
      engine:  'triple',
      online:  true,
      models: {
        default:  getDefaultModel(),
        classify: getClassifyModel(),
        extract:  getExtractModel(),
        deep:     getDeepModel(),
        chat:     getChatModel(),
      },
      providers: {
        ollama:    ollamaModels.map(m => m.name),
        lmstudio:  lmstudioModels.map(m => m.name),
        openrouter: openrouterModels.map(m => m.name),
      },
      all_models: allModels,
      count: allModels.length,
      ollama_online: ollamaOk,
      lmstudio_online: lmstudioOk,
      openrouter_online: openrouterOk,
    });
  } catch (err) {
    res.json({ success: false, engine: 'triple', online: false, error: err.message });
  }
});

// ─── POST /api/ai/extract-document ───────────────────────────────────────────
aiRouter.post('/extract-document', async (req, res) => {
  const { text, json_schema, filename } = req.body;

  if (!text || text.trim().length < 10) {
    return res.json({ status: 'error', output: null, details: 'Texto insuficiente para extracción' });
  }

  const schemaStr = JSON.stringify(json_schema || {}, null, 2);
  const prompt =
`Extrae los datos de este documento empresarial y devuelve un JSON que siga EXACTAMENTE el esquema indicado.

ESQUEMA REQUERIDO:
${schemaStr}

DOCUMENTO (${filename || 'desconocido'}):
${text.substring(0, 8000)}

REGLAS IMPORTANTES:
- Devuelve SOLO JSON válido, sin explicaciones ni markdown
- Usa null para campos que no encuentres en el documento
- Si el esquema tiene "invoices" (array), incluye TODOS los registros de facturas detectados
- Fechas en formato YYYY-MM-DD
- Importes como números (sin símbolo €)`;

  try {
    const result = await generate(prompt,
      `Eres un extractor preciso de datos de documentos empresariales españoles (facturas, nóminas, contratos). Devuelves ÚNICAMENTE JSON válido sin texto adicional ni bloques markdown.`,
      'json', 0.1, 2048, getExtractModel());

    const parsed = safeParseJSON(result.response);

    if (parsed && typeof parsed === 'object' && !parsed.raw) {
      return res.json({
        status:   'success',
        output:   parsed,
        model:    result.model,
        duration: result.durationMs,
      });
    }

    return res.json({
      status:  'error',
      output:  null,
      details: 'El LLM no devolvió JSON válido',
      raw:     result.response?.substring(0, 200),
    });
  } catch (err) {
    console.error('[extract-document]', err.message);
    return res.json({ status: 'error', output: null, details: err.message });
  }
});

// ─── POST /api/ai/ocr ────────────────────────────────────────────────────────
aiRouter.post('/ocr', async (req, res) => {
  const { file_url } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url requerida' });

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const os = await import('os');
  const fsMod = await import('fs');

  const filename = path.basename(file_url.split('?')[0]);
  const UPLOADS_DIR = process?.env?.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fsMod.existsSync(filePath)) {
    return res.status(404).json({ error: `Archivo no encontrado: ${filename}` });
  }

  const tmpDir = fsMod.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
  console.log(`[OCR] Procesando ${filename} → tmpDir=${tmpDir}`);

  try {
    await execAsync(
      `pdftoppm -r 200 -png -l 20 "${filePath}" "${path.join(tmpDir, 'page')}"`,
      { timeout: 60000 }
    );

    const pageFiles = fsMod.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    console.log(`[OCR] ${pageFiles.length} páginas detectadas`);

    const pageTexts = [];
    for (const page of pageFiles) {
      const pagePath = path.join(tmpDir, page);
      try {
        const { stdout } = await execAsync(
          `tesseract "${pagePath}" stdout -l spa+eng quiet 2>/dev/null`,
          { timeout: 30000 }
        );
        pageTexts.push(stdout.trim());
      } catch (pageErr) {
        console.warn(`[OCR] Error en página ${page}:`, pageErr.message);
        pageTexts.push('');
      }
    }

    fsMod.rmSync(tmpDir, { recursive: true, force: true });

    const text = pageTexts.join('\n\n---PAGINA---\n\n').trim();
    console.log(`[OCR] Texto total: ${text.length} chars en ${pageTexts.length} páginas`);

    res.json({
      success: true,
      text,
      pages: pageTexts.length,
      pageTexts,
    });
  } catch (err) {
    fsMod.rmSync(tmpDir, { recursive: true, force: true });
    console.error('[OCR] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export { aiRouter };