/**
 * ai.js — AI endpoints via gateway centralizado (LiteLLM :4000)
 * ============================================================
 * API surface IDÉNTICA a la versión anterior.
 * El frontend no necesita ningún cambio.
 *
 * Todos los proveedores (Ollama, LM Studio, OpenRouter, etc.) están
 * unificados detrás del gateway. Los alias de modelo se resuelven
 * en LiteLLM config.
 */

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { gatewayChat } from '../services/agentCore.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY_URL = process?.env?.LMSTUDIO_URL || 'http://127.0.0.1:4000/v1';

// ─── Helpers heredados ────────────────────────────────────────────────────
const FALLBACK_MODEL = 'llama3.2:3b';

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

const aiRouter = Router();

function getDefaultModel()  { return process?.env?.OLLAMA_MODEL  || 'local-fast'; }
function getClassifyModel() { return process?.env?.CLASSIFY_MODEL || 'local-fast'; }
function getChatModel()     { return process?.env?.CHAT_MODEL     || 'local-fast'; }
function getDeepModel()     { return process?.env?.DEEP_MODEL     || 'local-reason'; }
function getExtractModel()  { return process?.env?.EXTRACT_MODEL  || 'local-fast'; }

// ─── Generación unificada vía gateway ────────────────────────────────────────
async function generate(prompt, system, format, temperature, maxTokens, model) {
  // Soporte legacy: si temperature se pasa como object
  if (typeof format === 'object' && format !== null) {
    model       = format.model;
    temperature = format.temperature;
    maxTokens   = format.maxTokens;
    format      = format.format;
  }

  const m = model || getDefaultModel();
  const t0 = Date.now();
  const isJson = format === 'json';

  const { content, model: actualModel } = await gatewayChat({
    system,
    prompt,
    model: m,
    temperature: temperature || 0.1,
    maxTokens: maxTokens || 1024,
    json: isJson,
  });

  return {
    response:       content,
    durationMs:     Date.now() - t0,
    eval_duration:  0,
    total_duration: Date.now() - t0,
    model:          actualModel || m,
  };
}

// Usar safeParseJSON local definido arriba para compatibilidad con el frontend

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
    const r = await fetch(`${GATEWAY_URL}/models`, { signal: AbortSignal.timeout(5000) });
    const data = r.ok ? await r.json() : { data: [] };
    const models = (data.data || []).map(m => m.id || m);

    res.json({
      success: true,
      models,
      count: models.length,
      engine: 'gateway',
      providers: { gateway: models },
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
    const r = await fetch(`${GATEWAY_URL}/models`, { signal: AbortSignal.timeout(5000) });
    const data = r.ok ? await r.json() : { data: [] };
    const models = (data.data || []).map(m => ({ name: m.id || m, provider: 'gateway' }));

    res.json({
      success: true,
      models,
      count: models.length,
      engine: 'gateway',
      providers: { gateway: models.map(m => m.name) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/ai/tags ────────────────────────────────────────────────────────
aiRouter.get('/tags', async (req, res) => {
  try {
    const r = await fetch(`${GATEWAY_URL}/models`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Gateway ${r.status}`);
    const data = await r.json();
    const models = (data.data || []).map(m => m.id || m);
    res.json({ success: true, models, count: models.length, engine: 'gateway' });
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
      provider:       'gateway',
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
    const r = await fetch(`${GATEWAY_URL}/models`, { signal: AbortSignal.timeout(5000) });
    const data = r.ok ? await r.json() : { data: [] };
    const models = (data.data || []).map(m => ({ name: m.id || m, provider: 'gateway' }));

    res.json({
      success: true,
      engine:  'gateway',
      online:  true,
      models: {
        default:  getDefaultModel(),
        classify: getClassifyModel(),
        extract:  getExtractModel(),
        deep:     getDeepModel(),
        chat:     getChatModel(),
      },
      providers: { gateway: models.map(m => m.name) },
      all_models: models,
      count: models.length,
      gateway_online: r.ok,
    });
  } catch (err) {
    res.json({ success: false, engine: 'gateway', online: false, error: err.message });
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