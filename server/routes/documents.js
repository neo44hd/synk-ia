// ── Documentos API ─────────────────────────────────────────────────────────
import express from 'express';
import multer  from 'multer';
import path    from 'path';
import { unlink } from 'fs/promises';
import {
  processDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  getEntities,
  getStats,
} from '../services/documentProcessor.js';

const router = express.Router();

// ── Auth ───────────────────────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const auth = (req, res, next) => {
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t !== ADMIN_TOKEN) return res.status(401).json({ error: 'No autorizado' });
  next();
};

// ── Multer ─────────────────────────────────────────────────────────────────
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/Users/davidnows/sinkia/uploads';
const upload = multer({
  dest:   UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ── POST /api/documents/upload ─────────────────────────────────────────────
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  try {
    const result = await processDocument(
      req.file.path,
      req.file.mimetype,
      req.file.originalname
    );
    res.json({ ok: true, documento: result });
  } catch (err) {
    // Limpiar archivo temporal si el proceso falla
    unlink(req.file.path).catch(() => {});
    const code = err.message?.includes('No se pudo') ? 422 : 500;
    res.status(code).json({ error: err.message });
  }
});

// ── GET /api/documents ─────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    let docs = await getDocuments();
    // Filtros opcionales
    if (req.query.tipo)  docs = docs.filter(d => d.analisis?.tipo === req.query.tipo);
    if (req.query.q) {
      const q = req.query.q.toLowerCase();
      docs = docs.filter(d =>
        d.nombre_archivo?.toLowerCase().includes(q) ||
        d.analisis?.emisor?.nombre?.toLowerCase().includes(q) ||
        d.analisis?.receptor?.nombre?.toLowerCase().includes(q) ||
        d.analisis?.resumen?.toLowerCase().includes(q)
      );
    }
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/documents/stats ───────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try { res.json(await getStats()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/documents/entities ───────────────────────────────────────────
router.get('/entities', auth, async (req, res) => {
  try { res.json(await getEntities()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/documents/:id ─────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
  res.json(doc);
});

// ── DELETE /api/documents/:id ──────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  const ok = await deleteDocument(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Documento no encontrado' });
  res.json({ ok: true });
});

export default router;
