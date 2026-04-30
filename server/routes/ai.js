/**
 * ai.js — AI endpoints via Ollama HTTP API
 * API surface IDÉNTICA a la versión anterior (node-llama-cpp).
 * El frontend no necesita ningún cambio.
 *
 * Backend: Ollama (localhost:11434) — configurable via .env
 */

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));

const OLLAMA_URL = process.env.OLLAMA_URL   || 'http://localhost:11434';
const MODEL      = process.env.OLLAMA_MODEL || 'qwen3.5';


// ─── V3 Proxy helpers ────────────────────────────────────────────────────────
// V3_PROXY_EXTRACT_V1 (marker)
const V3_API = process.env.V3_API_URL || 'https://api-v3.sinkialabs.com';

async function v3Ingest(buf, filename, mime) {
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime || 'application/octet-stream' }), filename);
  const res = await fetch(V3_API + '/api/ingest', { method: 'POST', body: form });
  if (!res.ok) throw new Error('V3 ingest HTTP ' + res.status);
  return await res.json();
}

async function v3WaitDone(id, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const r = await fetch(V3_API + '/api/documents/' + id);
    if (r.ok) {
      const d = await r.json();
      if (d.status === 'done') return d;
      if (d.status === 'error') throw new Error(d.error_message || 'V3 error');
    }
    await new Promise(s => setTimeout(s, 2000));
  }
  return null;
}

async function v3Children(parentId, maxMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      const r = await fetch(V3_API + '/api/documents?parent_id=' + parentId + '&limit=200');
      if (r.ok) {
        const data = await r.json();
        const all = Array.isArray(data) ? data : (data.items || data.documents || []);
        const kids = all.filter(d => String(d.parent_id) === String(parentId));
        if (kids.length > 0 && kids.every(k => k.status === 'done' || k.status === 'error')) {
          const full = await Promise.all(
            kids.filter(k => k.status === 'done').map(async k => {
              try {
                const rr = await fetch(V3_API + '/api/documents/' + k.id);
                return rr.ok ? await rr.json() : k;
              } catch { return k; }
            })
          );
          return full;
        }
      }
    } catch {}
    await new Promise(s => setTimeout(s, 3000));
  }
  return [];
}

// Mapea el extracted_fields de V3 al schema genérico que espera el frontend
function v3FieldsToFrontendSchema(v3Doc, childrenDocs = []) {
  const f = v3Doc.extracted_fields || {};
  const tipo = f.tipo || v3Doc.doc_type || 'otro';

  const typeMap = {
    factura_recibida: 'Factura',
    factura_emitida:  'Factura',
    nomina:           'Nómina',
    recibo:           'Recibo',
    contrato:         'Contrato',
    escritura:        'Escritura',
    albaran:          'Albarán',
    ticket:           'Ticket',
    pdf_multi_factura:'Nómina',
  };

  const document_type = typeMap[tipo] || (tipo.charAt(0).toUpperCase() + tipo.slice(1));

  // Si es un PDF multi-factura con hijos → has_multiple_records=true
  if (childrenDocs.length > 0) {
    const records = childrenDocs.map(k => {
      const kf = k.extracted_fields || {};
      const isNomina = kf.tipo === 'nomina';
      const w = kf.trabajador || {};
      const rec = kf.receptor || {};
      const em = kf.emisor || {};
      return {
        employee_name:  w.nombre_completo || rec.nombre || null,
        employee_dni:   w.dni || rec.cif_nif || null,
        amount:         kf.total ?? null,
        gross_salary:   kf.base_imponible ?? null,
        social_security: null,
        irpf: null,
        document_date:  kf.fecha || null,
        period:         kf.fecha ? kf.fecha.slice(0, 7) : null,
        provider_name:  em.nombre || null,
        provider_cif:   em.cif_nif || null,
        invoice_number: kf.numero_documento || null,
        document_type:  typeMap[kf.tipo] || 'Nómina',
      };
    });
    return {
      document_type,
      has_multiple_records: true,
      records,
      summary: f.resumen || v3Doc.filename,
    };
  }

  // Documento simple — mapeo directo
  const emisor = f.emisor || {};
  const receptor = f.receptor || {};
  const trabajador = f.trabajador || {};

  return {
    document_type,
    has_multiple_records: false,
    provider_name:   emisor.nombre || null,
    provider_cif:    emisor.cif_nif || null,
    employee_name:   trabajador.nombre_completo || (tipo === 'nomina' ? receptor.nombre : null),
    employee_dni:    trabajador.dni || null,
    amount:          f.total ?? null,
    gross_salary:    f.base_imponible ?? null,
    social_security: null,
    irpf:            null,
    subtotal:        f.base_imponible ?? null,
    iva:             f.iva_total ?? null,
    document_date:   f.fecha || null,
    due_date:        f.fecha_vencimiento || null,
    period:          f.fecha ? f.fecha.slice(0, 7) : null,
    invoice_number:  f.numero_documento || null,
    summary:         f.resumen || '',
    _v3_id:          v3Doc.id,
    _v3_confidence:  v3Doc.confidence ? parseFloat(v3Doc.confidence) : null,
  };
}

export const aiRouter = Router();

// ─── Helper: llamar a Ollama ─────────────────────────────────────────────────
async function ollamaGenerate({ prompt, system, format, temperature = 0.1, maxTokens = 1024 }) {
  const body = {
    model:   MODEL,
    prompt,
    stream:  false,
    options: { temperature, num_predict: maxTokens },
  };
  if (system) body.system = system;
  if (format === 'json') body.format = 'json';

  const t0  = Date.now();
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
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
    model:          data.model || MODEL,
  };
}

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
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Ollama ${r.status}`);
    const data = await r.json();
    const models = (data.models || []).map(m => ({
      name: m.name, size: m.size, modified: m.modified_at, family: m.details?.family,
    }));
    res.json({ success: true, models, count: models.length, engine: 'ollama', active_model: MODEL });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ─── GET /api/ai/models ──────────────────────────────────────────────────────
aiRouter.get('/models', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Ollama ${r.status}`);
    const data = await r.json();
    res.json({ success: true, models: data.models || [], count: (data.models || []).length, engine: 'ollama' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/ai/generate ───────────────────────────────────────────────────
// Compatible con /api/ollama/generate
aiRouter.post('/generate', async (req, res) => {
  const { prompt, system, temperature = 0.1, format, maxTokens = 1024 } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'prompt requerido' });
  }

  try {
    const result = await ollamaGenerate({ prompt, system, format, temperature, maxTokens });
    res.json({
      success: true,
      response:       result.response,
      model:          result.model,
      eval_duration:  result.eval_duration,
      total_duration: result.total_duration,
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

    const result = await ollamaGenerate({
      prompt,
      system:     SYSTEM_CLASSIFY,
      format:     'json',
      temperature: 0.1,
      maxTokens:  512,
    });

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
// Compatible con /api/ollama/classify-email
aiRouter.post('/classify-email', async (req, res) => {
  const { subject, body: emailBody, from } = req.body;

  try {
    const prompt = `De: ${from || '?'}\nAsunto: ${subject || '?'}\nContenido: ${(emailBody || '').substring(0, 2000)}`;

    const result = await ollamaGenerate({
      prompt,
      system:     SYSTEM_CLASSIFY_EMAIL,
      format:     'json',
      temperature: 0.1,
      maxTokens:  256,
    });

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
// Endpoint extra: estado detallado del motor
aiRouter.get('/status', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Ollama ${r.status}`);
    const data = await r.json();
    const models = (data.models || []).map(m => m.name);
    res.json({
      success: true,
      engine:  'ollama',
      url:     OLLAMA_URL,
      active_model: MODEL,
      available_models: models,
      online:  true,
    });
  } catch (err) {
    res.json({ success: false, engine: 'ollama', url: OLLAMA_URL, online: false, error: err.message });
  }
});


// ─── POST /api/ai/extract-document ───────────────────────────────────────────
// Extrae datos estructurados de texto de documento según un JSON Schema dinámico.
// A diferencia de /classify (schema fijo), aquí el schema viene del cliente.
// Usado por integrationsService.ExtractDataFromUploadedFile.
aiRouter.post('/extract-document', async (req, res) => {
  const { text, json_schema, filename, file_url } = req.body;

  // ─── V3 PATH: si viene file_url, usa el motor V3 ──────────────────────
  if (file_url) {
    try {
      const path = await import('path');
      const { readFile } = await import('fs/promises');
      const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
      // file_url suele ser /api/files/serve/<nombre>
      const name = file_url.split('/').pop();
      const absPath = path.join(UPLOADS_DIR, name);
      const buf = await readFile(absPath);
      const ingested = await v3Ingest(buf, filename || name, req.body.mimetype);
      console.log('[V3-PROXY] ingested id=' + ingested.id + ' for ' + (filename || name));
      const done = await v3WaitDone(ingested.id, 120000);
      if (!done) {
        return res.json({ status: 'error', output: null, details: 'V3 timeout' });
      }
      let kids = [];
      if (done.child_count && done.child_count > 0) {
        kids = await v3Children(done.id, 180000);
        console.log('[V3-PROXY] ' + kids.length + ' hijos recuperados');
      }
      const output = v3FieldsToFrontendSchema(done, kids);
      return res.json({
        status: 'success',
        output,
        engine: 'v3',
        model: (done.extracted_fields || {})._model || 'v3',
        duration: done.processing_ms || null,
      });
    } catch (e) {
      console.error('[V3-PROXY] Error:', e.message);
      // cae al flujo antiguo si V3 falla
    }
  }

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
    const result = await ollamaGenerate({
      prompt,
      system: `Eres un extractor preciso de datos de documentos empresariales españoles (facturas, nóminas, contratos).
Devuelves ÚNICAMENTE JSON válido sin texto adicional ni bloques markdown.`,
      format:     'json',
      temperature: 0.1,
      maxTokens:  2048,
    });

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
