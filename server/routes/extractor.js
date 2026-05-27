/**
 * extractor.js — API routes para Data Extraction
 * ===============================================
 * POST /api/extract - Extrae campos de texto
 * GET /api/extractions - Lista extracciones
 * GET /api/extractions/:id - Detalle de extracción
 * DELETE /api/extractions/:id - Elimina extracción
 * GET /api/extractions/export/:format - Exporta JSON/CSV
 */

import express from 'express';
import {
  extract,
  getExtractions,
  getExtraction,
  deleteExtraction,
  toJSON,
  toCSV,
} from '../services/dataExtractor.js';

const router = express.Router();

// ─── Auth ───────────────────────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const DEV_MODE = process.env.DISABLE_TAILSCALE_AUTH === 'true';

const auth = (req, res, next) => {
  if (DEV_MODE) return next();
  if (req.fromTailscale) return next();
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t !== ADMIN_TOKEN) return res.status(401).json({ error: 'No autorizado' });
  next();
};

// ─── POST /api/extract ──────────────────────────────────────────────────────
/**
 * Extrae campos de un documento de texto
 * Body: { text: string, documentPath?: string }
 * Response: { id, type, typeConfidence, extraction: { type, fields } }
 */
router.post('/', auth, async (req, res) => {
  try {
    const { text, documentPath } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'El campo "text" es requerido' });
    }

    const result = await extract(text, documentPath || null);
    res.json({ ok: true, extraction: result });
  } catch (err) {
    console.error('[Extractor] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/extractions ───────────────────────────────────────────────────
/**
 * Lista todas las extracciones
 * Query: ?type=factura|contrato|po (opcional)
 */
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;

    const extractions = getExtractions(filter);
    res.json({ ok: true, count: extractions.length, extractions });
  } catch (err) {
    console.error('[Extractor] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/extractions/:id ───────────────────────────────────────────────
/**
 * Obtiene una extracción por ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const extraction = getExtraction(req.params.id);
    if (!extraction) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }
    res.json({ ok: true, extraction });
  } catch (err) {
    console.error('[Extractor] GET /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/extractions/:id ────────────────────────────────────────────
/**
 * Elimina una extracción
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const ok = deleteExtraction(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }
    res.json({ ok: true, message: 'Extracción eliminada' });
  } catch (err) {
    console.error('[Extractor] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/extractions/export/:format ───────────────────────────────────
/**
 * Exporta extracciones en JSON o CSV
 * Params: format = json|csv
 * Query: ?type=factura (opcional, filtra por tipo)
 */
router.get('/export/:format', auth, async (req, res) => {
  try {
    const { format } = req.params;
    const filter = {};
    if (req.query.type) filter.type = req.query.type;

    const extractions = getExtractions(filter);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="extractions.json"');
      res.send(toJSON(extractions));
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="extractions.csv"');
      res.send(toCSV(extractions));
    } else {
      res.status(400).json({ error: 'Formato no soportado. Use json o csv.' });
    }
  } catch (err) {
    console.error('[Extractor] GET /export/:format error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
