// filemanager.js — Router Express para la API del gestor de archivos SynK-IA
// Expone todos los endpoints del explorador de documentos del frontend
// Autenticación: cabecera X-Admin-Token

import express from 'express';
import multer  from 'multer';
import path    from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

import {
  processFile,
  reprocessFile,
  getProcessingStats,
  pipelineEvents,
} from '../agents/pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_TOKEN    = process.env.ADMIN_TOKEN  || 'sinkia2026';
const UPLOADS_DIR    = process.env.UPLOADS_DIR  || '/Users/davidnows/sinkia/uploads';
const DATA_DIR       = process.env.DATA_DIR     || path.join(__dirname, '..', '..', 'data');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'filemanager_docs.json');

// Asegurar que los directorios existen
try { mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// ─────────────────────────────────────────────────────────────────────────────
// Multer — almacenamiento de archivos subidos (máx. 100 MB)
// ─────────────────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ext   = path.extname(file.originalname);
    cb(null, `${stamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, _file, cb) => {
    // Aceptar todos los tipos; el pipeline determina si puede procesarlo
    cb(null, true);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Middleware de autenticación por token
// ─────────────────────────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token de administrador inválido o ausente' });
  }
  next();
}

// Aplicar autenticación a todas las rutas del router
router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades internas de persistencia
// ─────────────────────────────────────────────────────────────────────────────

/** Carga todos los documentos del almacén */
function loadDocs() {
  if (!existsSync(DOCUMENTS_FILE)) return [];
  try { return JSON.parse(readFileSync(DOCUMENTS_FILE, 'utf-8')); }
  catch { return []; }
}

/** Guarda el array de documentos en disco */
function persistDocs(docs) {
  writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD — Subida y procesamiento de archivos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/filemanager/upload
 * Sube un archivo y lo procesa inmediatamente a través del pipeline.
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }
  try {
    const { path: filePath, mimetype, originalname } = req.file;
    console.log(`[FILEMANAGER] Upload recibido: ${originalname}`);
    const record = await processFile(filePath, mimetype, originalname);
    res.status(201).json({ success: true, document: record });
  } catch (err) {
    console.error('[FILEMANAGER] Error en upload:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/filemanager/upload-batch
 * Sube múltiples archivos (hasta 20) y los procesa en paralelo.
 */
router.post('/upload-batch', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se recibieron archivos' });
  }
  try {
    console.log(`[FILEMANAGER] Batch upload: ${req.files.length} archivos`);
    const results = await Promise.allSettled(
      req.files.map(f => processFile(f.path, f.mimetype, f.originalname))
    );
    const documents = results.map((r, i) => ({
      file:     req.files[i].originalname,
      status:   r.status,
      document: r.status === 'fulfilled' ? r.value : null,
      error:    r.status === 'rejected'  ? r.reason?.message : null,
    }));
    res.status(207).json({ success: true, total: req.files.length, documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS — CRUD y filtros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/filemanager/documents
 * Lista todos los documentos con filtros opcionales:
 * ?tipo=factura&tag=urgente&folder=contabilidad&from=2024-01-01&to=2024-12-31&search=texto&status=processed
 */
router.get('/documents', (req, res) => {
  try {
    let docs = loadDocs();
    const { tipo, tag, folder, from, to, search, status, limit = 200, offset = 0 } = req.query;

    // Filtro por tipo de documento (análisis del agente 2)
    if (tipo)   docs = docs.filter(d => d.analysis?.tipo?.toLowerCase() === tipo.toLowerCase());
    // Filtro por tag (organización del agente 3)
    if (tag)    docs = docs.filter(d => d.organization?.tags?.includes(tag));
    // Filtro por carpeta (prefijo de ruta)
    if (folder) docs = docs.filter(d => d.organization?.folder_path?.startsWith(folder));
    // Filtro por estado del pipeline
    if (status) docs = docs.filter(d => d.status === status);
    // Filtro por rango de fechas de procesamiento
    if (from)   docs = docs.filter(d => new Date(d.processed_at) >= new Date(from));
    if (to)     docs = docs.filter(d => new Date(d.processed_at) <= new Date(to));
    // Búsqueda de texto libre sobre nombre, contenido, tags y entidades
    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter(d => {
        const name    = d.original_name?.toLowerCase() || '';
        const text    = d.extraction?.text?.toLowerCase() || '';
        const tags    = (d.organization?.tags || []).join(' ').toLowerCase();
        const emisor  = (d.analysis?.emisor?.nombre || '').toLowerCase();
        const receptor= (d.analysis?.receptor?.nombre || '').toLowerCase();
        const resumen = (d.analysis?.resumen || '').toLowerCase();
        const folder  = (d.organization?.folder_path || '').toLowerCase();
        return name.includes(q) || text.includes(q) || tags.includes(q) ||
               emisor.includes(q) || receptor.includes(q) || resumen.includes(q) || folder.includes(q);
      });
    }

    // Ordenar por fecha descendente (más recientes primero)
    docs.sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at));

    const total = docs.length;
    const paged = docs.slice(Number(offset), Number(offset) + Number(limit));

    res.json({ total, offset: Number(offset), limit: Number(limit), documents: paged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/filemanager/documents/:id
 * Devuelve un documento completo con todos sus datos de agentes.
 */
router.get('/documents/:id', (req, res) => {
  const docs = loadDocs();
  const doc  = docs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
  res.json(doc);
});

/**
 * DELETE /api/filemanager/documents/:id
 * Elimina el registro del almacén y el archivo físico si existe.
 */
router.delete('/documents/:id', (req, res) => {
  const docs = loadDocs();
  const idx  = docs.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Documento no encontrado' });

  const [removed] = docs.splice(idx, 1);
  persistDocs(docs);

  // Intentar borrar el archivo físico sin propagar errores
  if (removed.file_path && existsSync(removed.file_path)) {
    try { unlinkSync(removed.file_path); } catch { /* ignorar errores de sistema de archivos */ }
  }

  console.log(`[FILEMANAGER] Documento eliminado: ${removed.id}`);
  res.json({ success: true, deleted: removed.id });
});

/**
 * POST /api/filemanager/documents/:id/reprocess
 * Re-ejecuta el pipeline (Analyzer + Organizer) sobre un documento existente.
 */
router.post('/documents/:id/reprocess', async (req, res) => {
  // PDFs escaneados con glm-ocr pueden tardar 10-15 min → desactivar timeout HTTP
  req.setTimeout(0);
  res.setTimeout(0);
  try {
    const record = await reprocessFile(req.params.id);
    res.json({ success: true, document: record });
  } catch (err) {
    const status = err.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CARPETAS — Árbol y navegación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/filemanager/folders
 * Devuelve el árbol de carpetas con conteo de documentos por nodo.
 */
router.get('/folders', (req, res) => {
  const docs = loadDocs();
  const folderMap = {};

  for (const doc of docs) {
    const fp = doc.organization?.folder_path || 'sin_clasificar';
    folderMap[fp] = (folderMap[fp] || 0) + 1;
  }

  // Construir árbol jerárquico a partir de las rutas de carpeta separadas por '/'
  const tree = {};
  for (const [folderPath, count] of Object.entries(folderMap)) {
    const parts = folderPath.split('/');
    let node = tree;
    for (const part of parts) {
      if (!node[part]) node[part] = { _count: 0, _children: {} };
      node[part]._count += count;
      node = node[part]._children;
    }
  }

  res.json({ folders: folderMap, tree });
});

/**
 * GET /api/filemanager/folders/:path
 * Lista los documentos dentro de una carpeta específica (por prefijo de ruta).
 */
router.get('/folders/:path(*)', (req, res) => {
  const folderPath = req.params.path;
  const docs = loadDocs().filter(d =>
    d.organization?.folder_path?.startsWith(folderPath)
  );
  res.json({ folder: folderPath, total: docs.length, documents: docs });
});

// ─────────────────────────────────────────────────────────────────────────────
// TAGS y ENTIDADES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/filemanager/tags
 * Lista todos los tags con su frecuencia de uso, ordenados por popularidad.
 */
router.get('/tags', (req, res) => {
  const docs     = loadDocs();
  const tagCount = {};

  for (const doc of docs) {
    for (const tag of (doc.organization?.tags || [])) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }

  const tags = Object.entries(tagCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ total: tags.length, tags });
});

/**
 * GET /api/filemanager/entities
 * Lista todas las entidades conocidas: proveedores, clientes, trabajadores.
 */
router.get('/entities', (req, res) => {
  const docs = loadDocs();
  const buckets = { proveedores: {}, clientes: {}, trabajadores: {} };

  for (const doc of docs) {
    // Entidades explícitas creadas por el Organizer
    const created = doc.organization?.entities_created || {};
    for (const [type, names] of Object.entries(created)) {
      if (!buckets[type]) buckets[type] = {};
      const nameList = Array.isArray(names) ? names : [names];
      for (const name of nameList.filter(Boolean)) {
        buckets[type][name] = (buckets[type][name] || 0) + 1;
      }
    }
    // Emisores y receptores del análisis como proveedores/clientes
    const { emisor, receptor } = doc.analysis || {};
    const emisorNom  = typeof doc.analysis?.emisor === 'object' ? doc.analysis.emisor?.nombre : doc.analysis?.emisor;
    const receptorNom = typeof doc.analysis?.receptor === 'object' ? doc.analysis.receptor?.nombre : doc.analysis?.receptor;
    if (emisorNom)   buckets.proveedores[emisorNom]  = (buckets.proveedores[emisorNom]  || 0) + 1;
    if (receptorNom) buckets.clientes[receptorNom]   = (buckets.clientes[receptorNom]   || 0) + 1;
  }

  // Convertir objetos en arrays ordenados por frecuencia descendente
  const toArray = obj => Object.entries(obj)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    proveedores:  toArray(buckets.proveedores),
    clientes:     toArray(buckets.clientes),
    trabajadores: toArray(buckets.trabajadores),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESTADÍSTICAS Y DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/filemanager/stats
 * Estadísticas para el dashboard: totales, por tipo, por mes, almacenamiento usado.
 */
router.get('/stats', (req, res) => {
  const docs  = loadDocs();
  const stats = getProcessingStats();

  // Conteo agrupado por tipo de documento (del análisis del agente 2)
  const byType = {};
  for (const doc of docs) {
    const tipo = doc.analysis?.tipo || 'desconocido';
    byType[tipo] = (byType[tipo] || 0) + 1;
  }

  // Conteo por mes de procesamiento (últimos 24 meses incluidos)
  const byMonth = {};
  for (const doc of docs) {
    const month = doc.processed_at?.slice(0, 7); // Formato 'YYYY-MM'
    if (month) byMonth[month] = (byMonth[month] || 0) + 1;
  }

  // Almacenamiento total estimado en bytes y megabytes
  const storageBytes = docs.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const storageMB    = Number((storageBytes / (1024 * 1024)).toFixed(2));

  // Tiempo de procesamiento promedio en milisegundos
  const withTime = docs.filter(d => d.processing_time_ms > 0);
  const avgProcMs = withTime.length
    ? Math.round(withTime.reduce((a, d) => a + d.processing_time_ms, 0) / withTime.length)
    : 0;

  res.json({
    ...stats,
    by_type:            byType,
    by_month:           byMonth,
    storage_bytes:      storageBytes,
    storage_mb:         storageMB,
    avg_processing_ms:  avgProcMs,
  });
});

/**
 * GET /api/filemanager/recent
 * Devuelve los últimos 20 documentos procesados, ordenados por fecha.
 */
router.get('/recent', (req, res) => {
  const docs = loadDocs()
    .sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at))
    .slice(0, 20);
  res.json({ total: docs.length, documents: docs });
});

/**
 * GET /api/filemanager/notifications
 * Devuelve alertas y notificaciones pendientes generadas por el agente Organizer.
 */
router.get('/notifications', (req, res) => {
  const docs = loadDocs();
  const notifications = [];

  for (const doc of docs) {
    const notifs = doc.organization?.notifications || [];
    for (const n of notifs) {
      notifications.push({
        doc_id:   doc.id,
        doc_name: doc.original_name,
        priority: doc.organization?.priority || 'normal',
        ...n,
      });
    }
  }

  // Ordenar por prioridad: alta > normal > baja
  const priorityRank = { alta: 0, normal: 1, baja: 2 };
  notifications.sort((a, b) =>
    (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1)
  );

  res.json({ total: notifications.length, notifications });
});

// ─────────────────────────────────────────────────────────────────────────────
// BÚSQUEDA — Full-text sobre nombre, contenido, tags y entidades
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/filemanager/search?q=texto&limit=50&offset=0
 * Búsqueda de texto completo con puntuación por relevancia.
 */
router.get('/search', (req, res) => {
  const { q, limit = 50, offset = 0 } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'El parámetro q debe tener al menos 2 caracteres' });
  }

  const query = q.toLowerCase().trim();
  const docs  = loadDocs();

  // Función de puntuación por relevancia según el campo coincidente
  function scoreDoc(doc) {
    let s = 0;
    if (doc.original_name?.toLowerCase().includes(query))                  s += 10;
    if (doc.analysis?.tipo?.toLowerCase().includes(query))                 s += 8;
    const emisorN  = typeof doc.analysis?.emisor === 'object' ? doc.analysis.emisor?.nombre : doc.analysis?.emisor;
    const receptorN = typeof doc.analysis?.receptor === 'object' ? doc.analysis.receptor?.nombre : doc.analysis?.receptor;
    if (emisorN?.toLowerCase().includes(query))                            s += 6;
    if (receptorN?.toLowerCase().includes(query))                          s += 6;
    if (doc.organization?.display_name?.toLowerCase().includes(query))     s += 5;
    if (doc.organization?.tags?.some(t => t.toLowerCase().includes(query))) s += 4;
    if (doc.extraction?.text?.toLowerCase().includes(query))               s += 2;
    return s;
  }

  const results = docs
    .map(doc => ({ doc, score: scoreDoc(doc) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(Number(offset), Number(offset) + Number(limit))
    .map(({ doc, score }) => ({ ...doc, _relevance_score: score }));

  res.json({ query: q, total: results.length, documents: results });
});

// ─────────────────────────────────────────────────────────────────────────────
// SSE — Stream de eventos del pipeline en tiempo real
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/filemanager/events
 * Server-Sent Events: permite al frontend suscribirse a eventos del pipeline.
 */
router.get('/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Helper para enviar un evento SSE formateado
  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Suscriptores a los eventos del pipeline
  const onStart = data => send('pipeline:start', data);
  const onStep  = data => send('pipeline:step',  data);
  const onDone  = data => send('pipeline:done',  data);
  const onError = data => send('pipeline:error', data);

  pipelineEvents.on('pipeline:start', onStart);
  pipelineEvents.on('pipeline:step',  onStep);
  pipelineEvents.on('pipeline:done',  onDone);
  pipelineEvents.on('pipeline:error', onError);

  // Limpiar listeners al desconectarse el cliente para evitar fugas de memoria
  req.on('close', () => {
    pipelineEvents.off('pipeline:start', onStart);
    pipelineEvents.off('pipeline:step',  onStep);
    pipelineEvents.off('pipeline:done',  onDone);
    pipelineEvents.off('pipeline:error', onError);
    res.end();
  });
});

export default router;
