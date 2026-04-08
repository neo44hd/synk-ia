/**
 * ai.js — Drop-in replacement de ollama.js
 * API surface IDÉNTICA: mismos endpoints, mismos campos de respuesta.
 * El frontend no necesita ningún cambio.
 *
 * Antes: fetch('http://127.0.0.1:11434/api/generate', ...)
 * Ahora: node-llama-cpp en proceso, sin servidor externo
 */

import { Router } from 'express';
import { llamaService } from '../services/llamaService.js';
import path from 'path';
import { readdirSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '../../models');

export const aiRouter = Router();

// ─── Schemas JSON para structured output ────────────────────────────────────

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    type:         { type: 'string', enum: ['factura', 'nomina', 'albaran', 'contrato', 'recibo', 'presupuesto', 'fiscal', 'otro'] },
    confidence:   { type: 'number', minimum: 0, maximum: 100 },
    provider:     { type: 'string' },
    provider_cif: { type: 'string' },
    invoice_number:{ type: 'string' },
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

// ─── System prompts (idénticos a los de ollama.js) ───────────────────────────

const SYSTEM_CLASSIFY = `Eres un asistente de clasificacion de documentos empresariales.
Analiza el texto y devuelve SOLO un JSON con:
{
  "type": "factura|nomina|albaran|contrato|recibo|presupuesto|fiscal|otro",
  "confidence": 0-100,
  "provider": "nombre del proveedor/emisor",
  "provider_cif": "CIF/NIF si aparece",
  "invoice_number": "numero de factura/documento",
  "date": "YYYY-MM-DD",
  "total": numero_total,
  "summary": "resumen breve en 1 linea"
}`;

const SYSTEM_CLASSIFY_EMAIL = `Eres un asistente de clasificacion de emails empresariales.
Clasifica el email y devuelve SOLO un JSON con:
{
  "category": "factura|proveedor|cliente|rrhh|gestoria|marketing|interno|otro",
  "priority": "alta|media|baja",
  "confidence": 0-100,
  "summary": "resumen en 1 linea",
  "action": "accion sugerida o null",
  "has_invoice": true/false
}`;

// ─── Helper: parsear JSON de la respuesta LLM ────────────────────────────────
function safeParseJSON(raw) {
  if (!raw) return { raw: '' };
  try {
    return JSON.parse(raw);
  } catch {
    // Intenta extraer el primer bloque JSON del texto
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* noop */ }
    }
    return { raw };
  }
}

// ─── GET /api/ai/test ────────────────────────────────────────────────────────
// Compatible con /api/ollama/test — devuelve la misma estructura
aiRouter.get('/test', async (req, res) => {
  const info = llamaService.getInfo();
  if (!info.exists) {
    return res.json({
      success: false,
      error: `Modelo no encontrado: ${info.name}. Ejecuta: node scripts/download-model.js`,
      info,
    });
  }

  // Si no está cargado, cargarlo ahora
  if (!llamaService.isReady()) {
    try {
      await llamaService.init();
    } catch (err) {
      return res.json({ success: false, error: err.message, info });
    }
  }

  // Devuelve formato compatible con /api/ollama/test
  res.json({
    success: true,
    models: [{
      name:     info.name,
      size:     info.sizeMB * 1024 * 1024,
      modified: info.loadedAt,
      family:   info.name.split('-')[0], // 'qwen2.5' | 'phi' | 'llama'
    }],
    count: 1,
    engine: 'node-llama-cpp',
    gpu: info.gpu,
  });
});

// ─── GET /api/ai/models ──────────────────────────────────────────────────────
aiRouter.get('/models', (req, res) => {
  const models = [];

  if (existsSync(MODELS_DIR)) {
    try {
      const files = readdirSync(MODELS_DIR).filter(f => f.endsWith('.gguf'));
      files.forEach(f => {
        const fp   = path.join(MODELS_DIR, f);
        const size = statSync(fp).size;
        models.push({ name: f, size, modified: statSync(fp).mtime, family: f.split('-')[0] });
      });
    } catch { /* noop */ }
  }

  res.json({ success: true, models, count: models.length, engine: 'node-llama-cpp' });
});

// ─── POST /api/ai/generate ───────────────────────────────────────────────────
// Compatible con /api/ollama/generate
aiRouter.post('/generate', async (req, res) => {
  const { prompt, system, temperature = 0.1, format, maxTokens = 1024 } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'prompt requerido' });
  }

  try {
    const { response, durationMs } = await llamaService.generate({
      prompt, system, format, temperature, maxTokens,
    });

    res.json({
      success: true,
      response,
      model:          llamaService.getInfo().name,
      eval_duration:  durationMs * 1_000_000, // nanoseconds (compatible con Ollama)
      total_duration: durationMs * 1_000_000,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/ai/classify ───────────────────────────────────────────────────
// Compatible con /api/ollama/classify
aiRouter.post('/classify', async (req, res) => {
  const { text, filename } = req.body;

  if (!text && !filename) {
    return res.status(400).json({ success: false, error: 'text o filename requerido' });
  }

  try {
    const prompt = `Clasifica este documento (archivo: ${filename || 'desconocido'}):\n\n${(text || '').substring(0, 4000)}`;

    const { response, durationMs } = await llamaService.generate({
      prompt,
      system:     SYSTEM_CLASSIFY,
      format:     'json',
      jsonSchema: CLASSIFY_SCHEMA,
      temperature: 0.1,
      maxTokens:  512,
    });

    const parsed = safeParseJSON(response);

    res.json({
      success:        true,
      classification: parsed,
      model:          llamaService.getInfo().name,
      duration:       durationMs * 1_000_000,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/ai/classify-email ─────────────────────────────────────────────
// Compatible con /api/ollama/classify-email
aiRouter.post('/classify-email', async (req, res) => {
  const { subject, body: emailBody, from } = req.body;

  try {
    const prompt = `De: ${from || '?'}\nAsunto: ${subject || '?'}\nContenido: ${(emailBody || '').substring(0, 2000)}`;

    const { response, durationMs } = await llamaService.generate({
      prompt,
      system:     SYSTEM_CLASSIFY_EMAIL,
      format:     'json',
      jsonSchema: CLASSIFY_EMAIL_SCHEMA,
      temperature: 0.1,
      maxTokens:  256,
    });

    const parsed = safeParseJSON(response);

    res.json({
      success:        true,
      classification: parsed,
      model:          llamaService.getInfo().name,
      duration:       durationMs * 1_000_000,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/ai/status ──────────────────────────────────────────────────────
// Endpoint extra: estado detallado del motor
aiRouter.get('/status', (req, res) => {
  res.json({ success: true, engine: 'node-llama-cpp', ...llamaService.getInfo() });
});


// ─── POST /api/ai/extract-document ───────────────────────────────────────────
// Extrae datos estructurados de texto de documento según un JSON Schema dinámico.
// A diferencia de /classify (schema fijo), aquí el schema viene del cliente.
// Usado por integrationsService.ExtractDataFromUploadedFile.
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
    const { response, durationMs } = await llamaService.generate({
      prompt,
      system: `Eres un extractor preciso de datos de documentos empresariales españoles (facturas, nóminas, contratos).
Devuelves ÚNICAMENTE JSON válido sin texto adicional ni bloques markdown.`,
      format:     'json',
      jsonSchema: json_schema || { type: 'object' },
      temperature: 0.1,
      maxTokens:  2048,
    });

    const parsed = safeParseJSON(response);

    if (parsed && typeof parsed === 'object' && !parsed.raw) {
      return res.json({
        status:   'success',
        output:   parsed,
        model:    llamaService.getInfo().name,
        duration: durationMs,
      });
    }

    return res.json({
      status:  'error',
      output:  null,
      details: 'El LLM no devolvió JSON válido',
      raw:     response?.substring(0, 200),
    });
  } catch (err) {
    console.error('[extract-document]', err.message);
    return res.json({ status: 'error', output: null, details: err.message });
  }
});

// ─── POST /api/ai/ocr ────────────────────────────────────────────────────────
// Extrae texto de un PDF escaneado usando Tesseract + pdftoppm
// Body: { file_url: '/api/files/serve/xxx.pdf' }
// Returns: { success, text, pages, pageTexts[] }
aiRouter.post('/ocr', async (req, res) => {
  const { file_url } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url requerida' });

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const os = await import('os');
  const fsMod = await import('fs');

  const filename = path.basename(file_url.split('?')[0]);
  const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fsMod.existsSync(filePath)) {
    return res.status(404).json({ error: `Archivo no encontrado: ${filename}` });
  }

  const tmpDir = fsMod.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
  console.log(`[OCR] Procesando ${filename} → tmpDir=${tmpDir}`);

  try {
    // Convertir PDF a imágenes PNG (máximo 20 páginas, 200 DPI)
    await execAsync(
      `pdftoppm -r 200 -png -l 20 "${filePath}" "${path.join(tmpDir, 'page')}"`,
      { timeout: 60000 }
    );

    const pageFiles = fsMod.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    console.log(`[OCR] ${pageFiles.length} páginas detectadas`);

    // Extraer texto por página individualmente
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
      text,          // texto completo (retrocompatible)
      pages: pageTexts.length,
      pageTexts,     // NUEVO: texto separado por página para extraccion individual
    });
  } catch (err) {
    fsMod.rmSync(tmpDir, { recursive: true, force: true });
    console.error('[OCR] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
