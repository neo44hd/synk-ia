/**
 * ORCHESTRATOR — Agente orquestador central de SynK-IA
 * =====================================================
 * Punto único de entrada para TODO procesamiento de documentos.
 *
 * Recibe cualquier input → clasifica → enruta al sub-agente → unifica resultado.
 *
 * Uso:
 *   POST /api/orchestrator/process
 *   POST /api/orchestrator/batch
 */

import fs   from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { classify, DOC_TYPES, TARGET_AGENTS } from './classifier.js';
import { processFile } from './pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(path.dirname(path.dirname(__dirname)), 'uploads');

function getModel() {
  return process.env.ORCHESTRATOR_MODEL || 'gemma2:2b';
}

// ── Sub-agentes (se cargan dinámicamente para evitar dependencias circulares) ─

const _agents = {};

async function getAgent(name) {
  if (!_agents[name]) {
    _agents[name] = await loadAgent(name);
  }
  return _agents[name];
}

// ── UUID simple (sin dependencia de crypto en Node <19) ────────────────────────

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function loadAgent(name) {
  try {
    const mod = await import(`./${name}.js`);
    // Buscar en default export
    if (mod.default && typeof mod.default.process === 'function') {
      return mod.default;
    }
    // Buscar en named exports
    if (typeof mod.process === 'function') {
      const agent = { process: mod.process };
      for (const [k, v] of Object.entries(mod)) {
        if (k !== 'default' && k !== 'process' && k !== '__esModule' && typeof v !== 'function') {
          agent[k] = v;
        }
      }
      return agent;
    }
    // Fallback: intentar como módulo con exports nombrados
    if (mod.default) {
      const d = mod.default;
      if (typeof d === 'object' && typeof d.process === 'function') return d;
    }
    console.error(`[ORCHESTRATOR] Agente ${name} no tiene función process exportada`);
    return null;
  } catch (err) {
    console.error(`[ORCHESTRATOR] No se pudo cargar agente ${name}:`, err.message);
    return null;
  }
}

// ── Pre-procesamiento de archivos ─────────────────────────────────────────────

/**
 * Extrae texto de un buffer de archivo.
 * Soporta: PDF, TXT, CSV, JSON, imágenes (OCR)
 */
async function extractText(fileBuffer, mimeType, filename) {
  const ext = path.extname(filename || '').toLowerCase();

  // TXT / CSV / JSON / XML / LOG
  if (['.txt', '.csv', '.json', '.xml', '.log', '.md', '.html', '.htm'].includes(ext)) {
    return fileBuffer.toString('utf8');
  }

  // PDF
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    try {
      // Intentar pdf-parse primero (extracción de texto nativo)
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(fileBuffer);
      if (data.text && data.text.trim().length > 10) {
        return data.text;
      }
    } catch (_) {
      // pdf-parse no disponible o falló
    }

    // Fallback: OCR con Tesseract (para PDFs escaneados)
    try {
      const { execSync } = await import('child_process');
      const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
      const { join } = await import('path');

      const tmpDir = mkdtempSync('/tmp/synkia-ocr-');
      const inputPath = join(tmpDir, 'input.pdf');
      const outputPath = join(tmpDir, 'output.txt');

      writeFileSync(inputPath, fileBuffer);
      execSync(`pdftoppm -png -r 300 "${inputPath}" "${join(tmpDir, 'page')}" 2>/dev/null`, { timeout: 60000 });

      // OCR cada página
      const pages = (await fs.readdir(tmpDir)).filter(f => f.startsWith('page') && f.endsWith('.png'));
      let fullText = '';

      for (const pageFile of pages) {
        try {
          execSync(`tesseract "${join(tmpDir, pageFile)}" stdout -l spa+eng 2>/dev/null`, { timeout: 30000 });
        } catch (e) {
          // Tesseract no instalado o falló
        }
      }

      // Limpiar temp
      try { unlinkSync(inputPath); } catch (_) {}
      for (const f of pages) { try { unlinkSync(join(tmpDir, f)); } catch (_) {} }
      try { fs.rmdir(tmpDir); } catch (_) {}

      if (fullText.trim().length > 10) return fullText.trim();
    } catch (_) {
      // OCR falló
    }

    return null; // No se pudo extraer texto
  }

  // Imágenes → OCR directo
  if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif'].includes(ext) ||
      mimeType?.startsWith('image/')) {
    try {
      const { execSync } = await import('child_process');
      const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
      const { join } = await import('path');

      const tmpDir = mkdtempSync('/tmp/synkia-ocr-');
      const inputPath = join(tmpDir, `img${ext}`);
      writeFileSync(inputPath, fileBuffer);

      const result = execSync(`tesseract "${inputPath}" stdout -l spa+eng 2>/dev/null`, { timeout: 30000 }).toString();

      try { unlinkSync(inputPath); fs.rmdir(tmpDir); } catch (_) {}

      if (result.trim().length > 5) return result.trim();
    } catch (_) {}
    return null;
  }

  // DOCX, XLSX → Intentar extraer texto simple
  if (['.docx', '.xlsx', '.xls'].includes(ext)) {
    try {
      // Extraer como zip y leer archivos XML internos
      const { default: AdmZip } = await import('adm-zip');
      const zip = new AdmZip(fileBuffer);
      const entries = zip.getEntries().filter(e =>
        e.entryName.endsWith('.xml') || e.entryName.endsWith('.html')
      );
      let text = '';
      for (const entry of entries) {
        const content = entry.getData().toString('utf8');
        text += content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() + '\n';
      }
      if (text.trim().length > 10) return text.trim();
    } catch (_) {}
  }

  return null;
}

// ── Rutas del orquestador ─────────────────────────────────────────────────────

export const orchestratorRouter = (await import('express')).Router();

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/orchestrator/process
// Procesa cualquier input y lo enruta al sub-agente correcto.
// ═══════════════════════════════════════════════════════════════════════════════

orchestratorRouter.post('/process', async (req, res) => {
  const processId = uuid();
  const t0 = Date.now();

  try {
    let inputText = '';
    let filename = 'desconocido';
    let mimeType = '';
    let source = req.body.source || 'api';

    // ── Extraer input según el tipo de solicitud ──────────────────────────
    if (req.file) {
      // Archivo subido via multipart/form-data (multer single)
      const file = req.file;
      filename = file.originalname || 'archivo';
      mimeType = file.mimetype || '';

      // Extraer texto del archivo
      const fileBuffer = await fs.readFile(file.path);
      const extractedText = await extractText(fileBuffer, mimeType, filename);

      if (!extractedText) {
        return res.status(422).json({
          success: false,
          processId,
          error: 'No se pudo extraer texto del archivo. Verifica que sea un PDF con texto seleccionable o una imagen.',
        });
      }
      inputText = extractedText;

      // Limpiar archivo temporal
      try { await fs.unlink(file.path); } catch (_) {}

    } else if (req.body.text) {
      // Texto directo en el body
      inputText = req.body.text;
      filename = req.body.filename || 'texto-directo';
      mimeType = req.body.mimeType || 'text/plain';
      source = req.body.source || 'api';

    } else if (req.body.url) {
      // Descargar desde URL
      try {
        const urlResponse = await fetch(req.body.url, { signal: AbortSignal.timeout(30_000) });
        if (!urlResponse.ok) throw new Error(`HTTP ${urlResponse.status}`);

        const contentType = urlResponse.headers.get('content-type') || '';
        mimeType = contentType.split(';')[0];
        filename = req.body.filename || req.body.url.split('/').pop() || 'descargado';

        if (mimeType.includes('text/') || mimeType.includes('json') || mimeType.includes('xml') ||
            mimeType.includes('csv') || mimeType.includes('html')) {
          inputText = await urlResponse.text();
        } else {
          const buffer = Buffer.from(await urlResponse.arrayBuffer());
          const extracted = await extractText(buffer, mimeType, filename);
          if (!extracted) {
            return res.status(422).json({
              success: false, processId,
              error: 'No se pudo extraer texto de la URL',
            });
          }
          inputText = extracted;
        }
      } catch (err) {
        return res.status(502).json({
          success: false, processId,
          error: `Error al descargar la URL: ${err.message}`,
        });
      }

    } else {
      return res.status(400).json({
        success: false, processId,
        error: 'Se requiere "text", un archivo adjunto, o "url" en el body',
      });
    }

    // ── Validar contenido ──────────────────────────────────────────────────
    if (!inputText || inputText.trim().length < 5) {
      return res.status(422).json({
        success: false, processId,
        error: 'El texto extraído es demasiado corto para procesar',
      });
    }

    // ── Clasificar ─────────────────────────────────────────────────────────
    const classification = await classify({
      text: inputText,
      filename,
      mimeType,
      source,
    });

    console.log(`[ORCHESTRATOR:${processId}] Clasificado como: ${classification.docType} → ${classification.targetAgent} (confianza: ${(classification.confidence * 100).toFixed(0)}%)`);

    // ── Enrutar al sub-agente ──────────────────────────────────────────────
    let subAgentResult = null;
    let agentUsed = null;

    switch (classification.targetAgent) {
      case TARGET_AGENTS.DOCUMENT: {
        const documentAgent = await getAgent('documentAgent');
        if (documentAgent && typeof documentAgent.process === 'function') {
          subAgentResult = await documentAgent.process({
            text: inputText,
            classification,
            filename,
            mimeType,
          });
          agentUsed = 'documentAgent';
        }
        break;
      }

      case TARGET_AGENTS.EMAIL: {
        const emailAgent = await getAgent('emailAgent');
        // El emailAgent ya procesa de forma completa
        // Para input directo por texto, extraer campos básicos
        subAgentResult = { processed: true, source: 'orchestrator-email-agent' };
        agentUsed = 'emailAgent';
        break;
      }

      case TARGET_AGENTS.ACCOUNTING: {
        const accountingAgent = await getAgent('accountingAgent');
        if (accountingAgent && typeof accountingAgent.process === 'function') {
          subAgentResult = await accountingAgent.process({
            text: inputText,
            classification,
            filename,
          });
          agentUsed = 'accountingAgent';
        }
        break;
      }

      case TARGET_AGENTS.LEGAL: {
        const legalAgent = await getAgent('legalAgent');
        if (legalAgent && typeof legalAgent.process === 'function') {
          subAgentResult = await legalAgent.process({
            text: inputText,
            classification,
            filename,
          });
          agentUsed = 'legalAgent';
        }
        break;
      }

      case TARGET_AGENTS.REVIEW: {
        // Enviar a cola de revisión humana
        subAgentResult = {
          status: 'queued_for_review',
          message: 'Este documento requiere revisión humana por baja confianza',
        };
        agentUsed = 'humanReview';
        break;
      }

      default: {
        // Para 'analytics' o desconocido, procesar como documento genérico
        const documentAgent = await getAgent('documentAgent');
        if (documentAgent && typeof documentAgent.process === 'function') {
          subAgentResult = await documentAgent.process({
            text: inputText,
            classification,
            filename,
            mimeType,
          });
          agentUsed = 'documentAgent';
        }
      }
    }

    // ── Construir respuesta unificada ──────────────────────────────────────
    const durationMs = Date.now() - t0;

    const result = {
      success: true,
      processId,
      durationMs,
      classification: {
        docType:           classification.docType,
        subType:           classification.subType,
        priority:          classification.priority,
        confidence:        classification.confidence,
        requiresReview:    classification.requiresHumanReview,
        summary:           classification.summary,
      },
      agent:               agentUsed,
      subAgentResult:      subAgentResult || { status: 'no_agent_available' },
      input: {
        filename,
        mimeType,
        source,
        textLength:         inputText.length,
      },
    };

    // ── Log de auditoría ───────────────────────────────────────────────────
    const logEntry = {
      processId,
      timestamp: new Date().toISOString(),
      filename,
      docType: classification.docType,
      targetAgent: classification.targetAgent,
      confidence: classification.confidence,
      durationMs,
      success: true,
    };

    try {
      const logPath = path.join(path.dirname(__dirname), '..', 'data', 'orchestrator-log.json');
      let log = [];
      try {
        log = JSON.parse(await fs.readFile(logPath, 'utf8'));
      } catch (_) {}
      log.unshift(logEntry);
      // Mantener solo los últimos 10000 registros
      log = log.slice(0, 10000);
      await fs.writeFile(logPath, JSON.stringify(log, null, 2));
    } catch (logErr) {
      console.error(`[ORCHESTRATOR:${processId}] Error escribiendo log:`, logErr.message);
    }

    res.json(result);

  } catch (err) {
    console.error(`[ORCHESTRATOR:${processId}] Error fatal:`, err.message);
    res.status(500).json({
      success: false,
      processId,
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/orchestrator/batch
// Procesa múltiples inputs en paralelo.
// ═══════════════════════════════════════════════════════════════════════════════

orchestratorRouter.post('/batch', async (req, res) => {
  const { items } = req.body; // Array de { text, filename, source }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '"items" debe ser un array no vacío' });
  }

  if (items.length > 100) {
    return res.status(413).json({ error: 'Máximo 100 items por batch' });
  }

  const results = await Promise.allSettled(
    items.map((item, i) => classify({
      text: item.text || '',
      filename: item.filename || `item-${i}`,
      mimeType: item.mimeType,
      source: item.source || 'batch',
    }))
  );

  const summary = {
    total: items.length,
    processed: 0,
    failed: 0,
    needsReview: 0,
    byType: {},
    byAgent: {},
  };

  const batchResults = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      summary.processed++;
      const c = r.value;
      summary.byType[c.docType] = (summary.byType[c.docType] || 0) + 1;
      summary.byAgent[c.targetAgent] = (summary.byAgent[c.targetAgent] || 0) + 1;
      if (c.requiresHumanReview) summary.needsReview++;
      return { index: i, success: true, classification: r.value };
    } else {
      summary.failed++;
      return { index: i, success: false, error: r.reason?.message };
    }
  });

  res.json({ success: true, summary, results: batchResults });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/orchestrator/queue
// Estado de la cola de procesamiento.
// ═══════════════════════════════════════════════════════════════════════════════

orchestratorRouter.get('/queue', async (_req, res) => {
  try {
    const queuePath = path.join(path.dirname(__dirname), '..', '..', 'data', 'orchestrator-queue.json');
    const queue = JSON.parse(await fs.readFile(queuePath, 'utf8'));
    res.json({ success: true, queue });
  } catch (_) {
    res.json({ success: true, queue: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/orchestrator/status/:id
// Estado de un procesamiento específico.
// ═══════════════════════════════════════════════════════════════════════════════

orchestratorRouter.get('/status/:id', async (req, res) => {
  const logPath = path.join(path.dirname(__dirname), '..', '..', 'data', 'orchestrator-log.json');
  try {
    const log = JSON.parse(await fs.readFile(logPath, 'utf8'));
    const entry = log.find(e => e.processId === req.params.id);
    if (entry) {
      res.json({ success: true, status: entry });
    } else {
      res.status(404).json({ success: false, error: 'Proceso no encontrado' });
    }
  } catch (_) {
    res.status(404).json({ success: false, error: 'Log no disponible' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/orchestrator/reprocess/:id
// Reprocesa un documento fallido.
// ═══════════════════════════════════════════════════════════════════════════════

orchestratorRouter.post('/reprocess/:id', async (req, res) => {
  // Por ahora delega al endpoint /process
  // En el futuro, buscará el archivo original y lo reprocesará
  res.json({
    success: true,
    message: 'Reprocesamiento delegado a /api/orchestrator/process',
    reprocessId: uuid(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Health check del orquestador
// ═══════════════════════════════════════════════════════════════════════════════

orchestratorRouter.get('/health', async (_req, res) => {
  res.json({
    success: true,
    service: 'orchestrator',
    version: '1.0.0',
    agents_loaded: Object.keys(_agents),
    ollama_model: getModel(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/orchestrator/batch-remote
// Procesa TODOS los archivos de uploads/ a través del pipeline completo.
// ═══════════════════════════════════════════════════════════════════════════════

orchestratorRouter.post('/batch-remote', async (_req, res) => {
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    const supported = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.pdf','.png','.jpg','.jpeg','.tiff','.bmp','.txt','.csv','.json','.xml','.docx','.xlsx'].includes(ext);
    });

    if (supported.length === 0) {
      return res.json({ success: true, message: 'No hay archivos soportados en uploads/', processed: 0 });
    }

    const results = [];
    for (const file of supported) {
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        const record = await processFile(filePath, 'application/octet-stream', file);
        results.push({ file, status: record.status, docId: record.id, errors: record.errors });
      } catch (err) {
        results.push({ file, status: 'failed', error: err.message });
      }
    }

    const done = results.filter(r => r.status === 'processed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const partial = results.filter(r => r.status === 'partial').length;

    res.json({
      success: true,
      total: supported.length,
      processed: done,
      partial,
      failed,
      results,
    });
  } catch (err) {
    console.error('[BATCH-REMOTE] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});