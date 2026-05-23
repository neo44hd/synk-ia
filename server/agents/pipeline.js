// pipeline.js — Orquestador principal del sistema SynK-IA
// Coordina los tres agentes: Extractor → Analyzer → Organizer
// y persiste los resultados en el almacén de documentos (documents.json)

import { EventEmitter } from 'events';
import { readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { extract } from './extractorAgent.js';
import { analyze } from './analyzerAgent.js';
import { organize } from './organizerAgent.js';

// Resolución de __dirname en contexto ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio de datos configurable por variable de entorno
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

// Rutas de los archivos de persistencia
const DOCUMENTS_FILE = path.join(DATA_DIR, 'filemanager_docs.json');
const QUEUE_FILE = path.join(DATA_DIR, 'processing_queue.json');
const MAX_DOCUMENTS = 5000; // Límite FIFO del almacén

// ─────────────────────────────────────────────────────────────────────────────
// Event Emitter — permite suscribirse a eventos de progreso en tiempo real
// Eventos emitidos: 'pipeline:start', 'pipeline:step', 'pipeline:done', 'pipeline:error'
// ─────────────────────────────────────────────────────────────────────────────
export const pipelineEvents = new EventEmitter();
pipelineEvents.setMaxListeners(50);

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de persistencia (async no bloqueante)
// ─────────────────────────────────────────────────────────────────────────────

/** Lee el almacén de documentos; devuelve array vacío si no existe */
async function loadDocuments() {
  if (!existsSync(DOCUMENTS_FILE)) return [];
  try {
    const data = await readFile(DOCUMENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    console.log('[PIPELINE] Advertencia: documents.json corrupto, iniciando vacío');
    return [];
  }
}

/** Guarda el almacén de documentos aplicando límite FIFO de MAX_DOCUMENTS */
async function saveDocuments(docs) {
  // FIFO: si se supera el límite, se eliminan los más antiguos
  const trimmed = docs.length > MAX_DOCUMENTS
    ? docs.slice(docs.length - MAX_DOCUMENTS)
    : docs;
  await writeFile(DOCUMENTS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  return trimmed;
}

/** Actualiza o inserta un documento en el almacén */
async function upsertDocument(doc) {
  const docs = await loadDocuments();
  const idx = docs.findIndex(d => d.id === doc.id);
  if (idx !== -1) {
    docs[idx] = doc;
  } else {
    docs.push(doc);
  }
  return saveDocuments(docs);
}

/** Genera un ID único con prefijo 'doc_' */
function generateDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Busca un documento existente por originalName para deduplicar
 *  (filePath cambia porque multer renombra, pero originalName es estable) */
async function findExistingDoc(originalName) {
  const docs = await loadDocuments();
  return docs.find(d => d.original_name === originalName) || null;
}

/** Lee la cola de procesamiento asíncrono */
async function loadQueue() {
  if (!existsSync(QUEUE_FILE)) return [];
  try {
    const data = await readFile(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/** Persiste la cola de procesamiento */
async function saveQueue(queue) {
  await writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL: processFile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procesa un archivo a través de los tres agentes del pipeline.
 *
 * @param {string} filePath      - Ruta absoluta al archivo subido
 * @param {string} mimeType      - MIME type del archivo (e.g. 'application/pdf')
 * @param {string} originalName  - Nombre original del archivo
 * @returns {Promise<Object>}    - Registro completo con datos de los tres agentes
 */
export async function processFile(filePath, mimeType, originalName) {
  const startTime = Date.now();

  // Deduplicación: si ya existe un doc con mismo nombre original, reutilizarlo
  const existingDoc = await findExistingDoc(originalName);
  const docId = existingDoc ? existingDoc.id : generateDocId();

  const errors = [];
  const agentsCompleted = [];

  // Tamaño del archivo (0 si no existe aún)
  let fileSize = 0;
  try {
    const stats = await stat(filePath);
    fileSize = stats.size;
  } catch { /* sin tamaño */ }

  console.log(`[PIPELINE] Iniciando procesamiento: ${originalName} (${docId})`);
  pipelineEvents.emit('pipeline:start', { docId, originalName, mimeType });

  // Registro base que se irá completando
  let record = {
    id: docId,
    original_name: originalName,
    mime_type: mimeType,
    file_size: fileSize,
    file_path: filePath,

    extraction:   { ok: false },
    analysis:     {},
    organization: {},

    status:           'failed',
    agents_completed: agentsCompleted,
    processing_time_ms: 0,
    processed_at:     new Date().toISOString(),
    errors,
  };

  // ── AGENTE 1: EXTRACTOR ──────────────────────────────────────────────────
  let extractedData = null;
  try {
    console.log(`[PIPELINE] [1/3] Extrayendo contenido de: ${originalName}`);
    pipelineEvents.emit('pipeline:step', { docId, step: 'extractor', status: 'running' });

    extractedData = await extract(filePath, mimeType, originalName);
    record.extraction = { ...extractedData, ok: true };
    agentsCompleted.push('extractor');

    pipelineEvents.emit('pipeline:step', { docId, step: 'extractor', status: 'done' });
    console.log(`[PIPELINE] [1/3] Extracción completada. Método: ${extractedData?.method}`);
  } catch (err) {
    console.log(`[PIPELINE] [1/3] Error en extracción: ${err.message}`);
    errors.push({ agent: 'extractor', message: err.message, timestamp: new Date().toISOString() });
    record.extraction = { ok: false, error: err.message };
    record.status = 'failed';
    record.processing_time_ms = Date.now() - startTime;
    pipelineEvents.emit('pipeline:error', { docId, step: 'extractor', error: err.message });
    await upsertDocument(record);
    return record;
  }

  // ── AGENTE 2: ANALYZER ───────────────────────────────────────────────────
  let analysisResult = null;
  try {
    console.log(`[PIPELINE] [2/3] Analizando documento: ${originalName}`);
    pipelineEvents.emit('pipeline:step', { docId, step: 'analyzer', status: 'running' });

    analysisResult = await analyze(extractedData);
    record.analysis = analysisResult.analysis ?? analysisResult;
    agentsCompleted.push('analyzer');

    pipelineEvents.emit('pipeline:step', { docId, step: 'analyzer', status: 'done' });
    console.log(`[PIPELINE] [2/3] Análisis completado. Tipo: ${record.analysis?.tipo}`);
  } catch (err) {
    console.log(`[PIPELINE] [2/3] Error en análisis: ${err.message}`);
    errors.push({ agent: 'analyzer', message: err.message, timestamp: new Date().toISOString() });
    record.status = 'partial';
    record.processing_time_ms = Date.now() - startTime;
    pipelineEvents.emit('pipeline:error', { docId, step: 'analyzer', error: err.message });
    await upsertDocument(record);
    return record;
  }

  // ── AGENTE 3: ORGANIZER ──────────────────────────────────────────────────
  try {
    console.log(`[PIPELINE] [3/3] Organizando documento: ${originalName}`);
    pipelineEvents.emit('pipeline:step', { docId, step: 'organizer', status: 'running' });

    const organizeResult = await organize(analysisResult.analysis ?? analysisResult, extractedData, originalName);
    record.organization = organizeResult;
    agentsCompleted.push('organizer');

    pipelineEvents.emit('pipeline:step', { docId, step: 'organizer', status: 'done' });
    console.log(`[PIPELINE] [3/3] Organización completada. Carpeta: ${organizeResult?.folder_path}`);
  } catch (err) {
    console.log(`[PIPELINE] [3/3] Error en organización: ${err.message}`);
    errors.push({ agent: 'organizer', message: err.message, timestamp: new Date().toISOString() });
    record.status = 'partial';
    record.processing_time_ms = Date.now() - startTime;
    pipelineEvents.emit('pipeline:error', { docId, step: 'organizer', error: err.message });
    await upsertDocument(record);
    return record;
  }

  // ── FINALIZACIÓN ─────────────────────────────────────────────────────────
  record.status = 'processed';
  record.processing_time_ms = Date.now() - startTime;
  record.processed_at = new Date().toISOString();

  await upsertDocument(record);

  console.log(`[PIPELINE] Procesamiento completo: ${originalName} en ${record.processing_time_ms}ms`);
  pipelineEvents.emit('pipeline:done', { docId, status: 'processed', processingTime: record.processing_time_ms });

  return record;
}

// ─────────────────────────────────────────────────────────────────────────────
// reprocessFile — Re-ejecuta analysis + organization sobre un documento existente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reprocesa un documento ya existente en el almacén.
 * Solo vuelve a ejecutar Analyzer y Organizer (la extracción ya existe).
 *
 * @param {string} docId - ID del documento a reprocesar
 * @returns {Promise<Object>} - Registro actualizado
 */
export async function reprocessFile(docId) {
  const docs = await loadDocuments();
  const doc = docs.find(d => d.id === docId);

  if (!doc) {
    throw new Error(`[PIPELINE] Documento no encontrado: ${docId}`);
  }
  console.log(`[PIPELINE] Reprocesando: ${doc.original_name} (${docId})`);
  pipelineEvents.emit('pipeline:start', { docId, originalName: doc.original_name, mode: 'reprocess' });

  const startTime = Date.now();
  const errors = [];
  const agentsCompleted = [];

  // ── Re-extracción (siempre, para aprovechar nuevos modelos OCR) ──────
  let extractedData = null;
  try {
    pipelineEvents.emit('pipeline:step', { docId, step: 'extractor', status: 'running' });
    extractedData = await extract(doc.file_path, doc.mime_type, doc.original_name);
    doc.extraction = { ...extractedData, ok: true };
    agentsCompleted.push('extractor');
    pipelineEvents.emit('pipeline:step', { docId, step: 'extractor', status: 'done' });
    console.log(`[PIPELINE] [1/3] Re-extracción completada. Método: ${extractedData?.method}`);
  } catch (err) {
    console.warn(`[PIPELINE] Extracción falló, usando original: ${err.message}`);
    extractedData = doc.extraction || {};
    agentsCompleted.push('extractor');
  }

  // Añadir originalName y mimeType al extractedData para el analyzer
  extractedData.originalName = doc.original_name;
  extractedData.mimeType = doc.mime_type;

  // ── Re-análisis ──────────────────────────────────────────────────────────
  let analysisResult = null;
  try {
    pipelineEvents.emit('pipeline:step', { docId, step: 'analyzer', status: 'running' });
    analysisResult = await analyze(extractedData);
    doc.analysis = analysisResult.analysis ?? analysisResult;
    agentsCompleted.push('analyzer');
    pipelineEvents.emit('pipeline:step', { docId, step: 'analyzer', status: 'done' });
  } catch (err) {
    errors.push({ agent: 'analyzer', message: err.message, timestamp: new Date().toISOString() });
    doc.errors = [...(doc.errors || []), ...errors];
    doc.status = 'partial';
    doc.processing_time_ms = Date.now() - startTime;
    await upsertDocument(doc);
    pipelineEvents.emit('pipeline:error', { docId, step: 'analyzer', error: err.message });
    return doc;
  }

  // ── Re-organización ──────────────────────────────────────────────────────
  try {
    pipelineEvents.emit('pipeline:step', { docId, step: 'organizer', status: 'running' });
    const organizeResult = await organize(analysisResult.analysis ?? analysisResult, extractedData, doc.original_name);
    doc.organization = organizeResult;
    agentsCompleted.push('organizer');
    pipelineEvents.emit('pipeline:step', { docId, step: 'organizer', status: 'done' });
  } catch (err) {
    errors.push({ agent: 'organizer', message: err.message, timestamp: new Date().toISOString() });
    doc.errors = [...(doc.errors || []), ...errors];
    doc.status = 'partial';
    doc.processing_time_ms = Date.now() - startTime;
    await upsertDocument(doc);
    pipelineEvents.emit('pipeline:error', { docId, step: 'organizer', error: err.message });
    return doc;
  }

  // Actualización del registro
  doc.status = 'processed';
  doc.agents_completed = agentsCompleted;
  doc.processing_time_ms = Date.now() - startTime;
  doc.processed_at = new Date().toISOString();
  doc.errors = [...(doc.errors || []), ...errors];

  await upsertDocument(doc);
  console.log(`[PIPELINE] Reprocesamiento completo: ${doc.original_name} en ${doc.processing_time_ms}ms`);
  pipelineEvents.emit('pipeline:done', { docId, status: 'processed', mode: 'reprocess' });

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// getProcessingStats — Estadísticas del almacén de documentos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve conteos agrupados por estado de procesamiento.
 *
 * @returns {Object} - { total, processed, partial, failed, queue_pending }
 */
export function getProcessingStats() {
  // Sincrónico — solo lectura rápida del stats actual
  const docs = loadDocuments();
  const queue = loadQueue();

  const stats = {
    total:          0,
    processed:      0,
    partial:        0,
    failed:         0,
    queue_pending:  queue.filter(q => q.status === 'pending').length,
  };

  // Nota: esto es síncrono porque loadDocuments ya resolvió
  // Puede que no sea preciso en llamada directa; para stats en tiempo real
  // usar la versión async getProcessingStatsAsync

  return stats;
}

/** Versión asíncrona de getProcessingStats para datos en tiempo real */
export async function getProcessingStatsAsync() {
  const docs = await loadDocuments();
  const queue = await loadQueue();

  const stats = {
    total:          docs.length,
    processed:      0,
    partial:        0,
    failed:         0,
    queue_pending:  queue.filter(q => q.status === 'pending').length,
  };

  for (const doc of docs) {
    if (doc.status === 'processed') stats.processed++;
    else if (doc.status === 'partial') stats.partial++;
    else stats.failed++;
  }

  console.log(`[PIPELINE] Stats: ${JSON.stringify(stats)}`);
  return stats;
}