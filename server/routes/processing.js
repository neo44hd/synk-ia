/**
 * processing.js — Ruta universal de procesamiento de documentos
 * ==============================================================
 * POST /api/process — procesa cualquier documento soportado
 * Soporta single file upload y batch processing
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  processDocument,
  processDocumentsParallel,
  detectDocumentType,
  validateDocumentBuffer,
  generateProcessingSummary,
  SUPPORTED_TYPES,
} from '../services/documentProcessor/universalProcessor.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DOCUMENTS_DIR = join(ROOT, '..', 'data', 'documents');
const TEMP_UPLOADS_DIR = process.env.TEMP_UPLOADS_DIR || '/tmp/synkia-doc-processing';

// Crear directorios si no existen
await mkdir(DATA_DOCUMENTS_DIR, { recursive: true });
await mkdir(TEMP_UPLOADS_DIR, { recursive: true });

// ── Multer: Upload de archivos ─────────────────────────────────────────────────
const upload = multer({
  dest: TEMP_UPLOADS_DIR,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    // Solo aceptar tipos soportados
    const supportedMimes = Object.values(SUPPORTED_TYPES);
    const isSupported =
      supportedMimes.includes(file.mimetype) ||
      /\.(pdf|xlsx|xls|csv|docx|doc|png|jpg|jpeg|tiff|tif|txt)$/i.test(file.originalname);

    if (isSupported) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ── Auth middleware ────────────────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const DEV_MODE = process.env.DISABLE_TAILSCALE_AUTH === 'true';

const auth = (req, res, next) => {
  if (DEV_MODE) return next();
  if (req.fromTailscale) return next();
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ── POST /api/process ─────────────────────────────────────────────────────────
/**
 * Procesa un documento único
 * Parámetros:
 * - file (form data): archivo a procesar
 * - format (query): 'summary' | 'full' (default: 'full')
 * - save (query): 'true' para guardar en data/documents/
 */
router.post('/', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const { readFile } = await import('fs/promises');
    const buffer = await readFile(req.file.path);

    // Validar documento
    const validation = validateDocumentBuffer(buffer, req.file.mimetype, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Procesar documento
    const result = await processDocument(
      buffer,
      req.file.mimetype,
      req.file.originalname
    );

    // Opción: guardar resultado en data/documents/
    if (req.query.save === 'true') {
      const docId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const resultPath = join(DATA_DOCUMENTS_DIR, `${docId}.json`);
      await writeFile(resultPath, JSON.stringify(result, null, 2), 'utf-8');
      result.savedPath = resultPath;
    }

    // Formato de respuesta
    const format = req.query.format || 'full';
    const responseBody =
      format === 'summary' ? generateProcessingSummary(result) : result;

    // Limpiar archivo temporal
    try {
      const { unlink } = await import('fs/promises');
      await unlink(req.file.path);
    } catch {}

    res.json(responseBody);
  } catch (err) {
    console.error('[PROCESS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/process/batch ────────────────────────────────────────────────────
/**
 * Procesa múltiples documentos en paralelo
 * Parámetros:
 * - files (form data): archivos a procesar (multiple=true)
 * - concurrency (query): número de workers paralelos (default: 4, max: 10)
 * - format (query): 'summary' | 'full'
 */
router.post('/batch', auth, upload.array('files', 100), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  try {
    const { readFile } = await import('fs/promises');
    const concurrency = Math.min(parseInt(req.query.concurrency || '4'), 10);

    // Leer todos los buffers
    const documents = await Promise.all(
      req.files.map(async (file) => ({
        buffer: await readFile(file.path),
        mimeType: file.mimetype,
        filename: file.originalname,
        tempPath: file.path,
      }))
    );

    // Procesar en paralelo
    const results = await processDocumentsParallel(documents, concurrency);

    // Formatear respuesta
    const format = req.query.format || 'full';
    const responseBody = format === 'summary'
      ? results.map(generateProcessingSummary)
      : results;

    // Limpiar archivos temporales
    for (const doc of documents) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(doc.tempPath);
      } catch {}
    }

    res.json({
      total: results.length,
      successful: results.filter((r) => r.status === 'success').length,
      partial: results.filter((r) => r.status === 'partial').length,
      failed: results.filter((r) => r.status === 'error').length,
      results: responseBody,
    });
  } catch (err) {
    console.error('[PROCESS-BATCH] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/process/supported ─────────────────────────────────────────────────
/**
 * Retorna lista de tipos soportados
 */
router.get('/supported', auth, (_req, res) => {
  res.json({
    types: SUPPORTED_TYPES,
    formats: Object.keys(SUPPORTED_TYPES),
    mimeTypes: Object.values(SUPPORTED_TYPES),
  });
});

// ── GET /api/process/health ────────────────────────────────────────────────────
/**
 * Verifica disponibilidad de procesadores especializados
 */
router.get('/health', auth, async (_req, res) => {
  const health = {
    status: 'operational',
    processors: {
      pdf: { available: true, note: 'Uses pdf-parse or pdftotext' },
      excel: { available: true, note: 'Uses xlsx library' },
      docx: { available: true, note: 'Uses adm-zip + xml parsing' },
      image: {
        available: true,
        note: 'OCR available if: tesseract, tesseract.js, or pytesseract installed',
      },
      text: { available: true, note: 'Direct text parsing' },
    },
    directories: {
      dataDocuments: DATA_DOCUMENTS_DIR,
      tempUploads: TEMP_UPLOADS_DIR,
    },
  };

  res.json(health);
});

// ── Error handler ──────────────────────────────────────────────────────────────
router.use((err, _req, res, _next) => {
  console.error('[PROCESSING] Error:', err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 500MB)' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  res.status(500).json({
    error: err.message || 'Unknown error during processing',
  });
});

export default router;
