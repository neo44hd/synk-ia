/**
 * files.js — Upload y servicio de archivos
 *
 * Endpoints:
 *   POST /api/files/upload   → sube un archivo (multipart/form-data, campo "file")
 *                              devuelve { success, url, id, name, size }
 *   GET  /api/files/serve/:filename → sirve el archivo subido
 *
 * Dependencia: multer (npm install multer --prefix server/)
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { mkdirSync, existsSync, readdirSync, statSync } from 'fs';

// En producción process.cwd() = /opt/sinkia-backend → uploads en /opt/sinkia-backend/uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');

// Crear directorio de uploads si no existe
mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext    = path.extname(file.originalname) || '.bin';
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB máximo
});

export const filesRouter = Router();

// ── POST /api/files/upload ────────────────────────────────────────────────────
filesRouter.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
  }
  const url = `/api/files/serve/${req.file.filename}`;
  res.json({
    success: true,
    url,
    id:   req.file.filename,
    name: req.file.originalname,
    size: req.file.size,
  });
});

// ── GET /api/files/list ─────────────────────────────────────────────────────
filesRouter.get('/list', (_req, res) => {
  try {
    const files = readdirSync(UPLOADS_DIR)
      .map(name => {
        const stats = statSync(path.join(UPLOADS_DIR, name));
        return { name, size: stats.size, modified: stats.mtime };
      })
      .sort((a, b) => b.modified - a.modified)
      .slice(0, 20);
    res.json({ success: true, files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/files/serve/:filename ────────────────────────────────────────────
filesRouter.get('/serve/:filename', (req, res) => {
  // path.basename previene path traversal
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  res.sendFile(filePath);
});
