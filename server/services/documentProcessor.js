/**
 * documentProcessor.js — SYNK-IA Local Processor (v2 — persistent storage)
 * =========================================================
 * Todo el procesamiento es local vía Classifier + Document Agent.
 * Persiste en data/documents.json como fuente única de verdad.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..', '..');
const DATA_DIR   = join(ROOT, 'data');
const DB_PATH    = join(DATA_DIR, 'documents.json');
const ENTITIES_PATH = join(DATA_DIR, 'entities.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(ROOT, 'uploads');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Low-level JSON store ──────────────────────────────────────────────────────

function _loadDB() {
  try {
    if (existsSync(DB_PATH)) return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch { /* ignore corrupt file */ }
  return { documents: [], entities: { providers: [], workers: [], clients: [] } };
}

function _saveDB(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function _nextId() {
  const db = _loadDB();
  const max = db.documents.reduce((m, d) => {
    const n = parseInt((d._id || '').replace('doc_', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `doc_${max + 1}_${Date.now().toString(36)}`;
}

// ── Entity management ────────────────────────────────────────────────────────

export function getEntities() {
  const db = _loadDB();
  // Merge entities from documents into global entities
  const providers = new Map();
  const workers   = new Map();
  for (const d of db.documents) {
    const a = d.analisis || {};
    if (a.emisor?.nombre)   providers.set(a.emisor.nombre.toLowerCase(), a.emisor);
    if (a.receptor?.nombre) providers.set(a.receptor.nombre.toLowerCase(), a.receptor);
  }
  // Also load from entities file
  if (existsSync(ENTITIES_PATH)) {
    try {
      const e = JSON.parse(readFileSync(ENTITIES_PATH, 'utf-8'));
      (e.providers || []).forEach(p => providers.set(p.nombre.toLowerCase(), p));
      (e.workers   || []).forEach(w => workers.set(w.nombre.toLowerCase(), w));
      (e.clients   || []).forEach(c => providers.set(c.nombre.toLowerCase(), c));
    } catch { /* ignore */ }
  }
  return {
    providers: [...providers.values()],
    workers:   [...workers.values()],
    clients:   [...providers.values()],
  };
}

export function saveEntities(entities) {
  writeFileSync(ENTITIES_PATH, JSON.stringify(entities, null, 2), 'utf-8');
  return entities;
}

// ── Field mapping: backend DB → frontend contract ────────────────────────────
function normalizeDocForFrontend(doc) {
  const a = doc.analisis || {};
  const emisor = a.emisor || {};
  const receptor = a.receptor || {};
  return {
    _id:               doc.id || doc._id,
    id:                doc.id || doc._id,
    nombre_archivo:    doc.nombre_archivo,
    filename:          doc.nombre_archivo,
    mime_type:         doc.mime_type,
    filePath:          doc.filePath,
    procesado:         doc.procesado,
    estado:            doc.estado,
    // Frontend-compatible fields
    status:            doc.estado === 'procesado' ? 'processed'
                     : doc.estado === 'error'     ? 'error'
                     :                               'pending',
    docType:           a.tipo || null,
    subType:           a.subtipo || null,
    subtipo:           a.subtipo || null,
    confidence:        a.confianza != null ? (typeof a.confianza === 'number' ? a.confianza / 100 : a.confianza) : 0,
    supplier:          emisor.nombre || null,
    receptor:          receptor.nombre || null,
    entities: {
      supplier:        emisor.nombre || null,
      total:           a.total || null,
      iva:             a.iva_total || a.iva || null,
      currency:        a.moneda || 'EUR',
    },
    fecha:             a.fecha || null,
    fecha_vencimiento: a.fecha_vencimiento || null,
    numero_documento:  a.numero_documento || null,
    base_imponible:    a.base_imponible || null,
    texto_preview:     doc.texto_preview || null,
    // Keep raw/text for the "Ver texto" button
    raw:               doc.texto_preview || null,
    text:              doc.texto_preview || null,
    metodo_extraccion: doc.metodo_extraccion || null,
    chars_extraidos:   doc.chars_extraidos || 0,
    resumen:           a.resumen || '',
    createdAt:         doc.createdAt || null,
    updatedAt:         doc.updatedAt || null,
  };
}

// ── Document CRUD ─────────────────────────────────────────────────────────────

export async function getDocuments() {
  const db = _loadDB();
  const sorted = db.documents.sort((a, b) => (b.procesado || b.createdAt || 0) - (a.procesado || a.createdAt || 0));
  return sorted.map(normalizeDocForFrontend);
}

export async function getDocument(id) {
  const db = _loadDB();
  const doc = db.documents.find(d => (d.id || d._id) === id);
  return doc ? normalizeDocForFrontend(doc) : null;
}

export async function getDocumentById(id) {
  // Find by any id field
  const db = _loadDB();
  const doc = db.documents.find(d => (d.id || d._id) === id || d.nombre_archivo === id);
  return doc ? normalizeDocForFrontend(doc) : null;
}

export async function saveDocument(doc) {
  const db   = _loadDB();
  const idx  = db.documents.findIndex(d => d._id === doc._id);
  const now  = new Date().toISOString();
  doc.updatedAt = now;
  if (idx >= 0) {
    db.documents[idx] = { ...db.documents[idx], ...doc };
  } else {
    doc.createdAt = doc.createdAt || now;
    db.documents.push(doc);
  }
  _saveDB(db);
  return doc;
}

export async function deleteDocument(id) {
  const db = _loadDB();
  const idx = db.documents.findIndex(d => d._id === id);
  if (idx < 0) return false;
  db.documents.splice(idx, 1);
  _saveDB(db);
  return true;
}

export async function clearProcessed() {
  const db = _loadDB();
  const removed = db.documents.filter(d => d.estado === 'procesado');
  db.documents = db.documents.filter(d => d.estado !== 'procesado');
  _saveDB(db);
  return { ok: true, removed: removed.length };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats() {
  const docs = await getDocuments();
  const now  = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const last24h = docs.filter(d => now - new Date(d.procesado || d.createdAt || 0).getTime() < dayMs).length;
  const byType = {};
  for (const d of docs) {
    const t = (d.analisis || {}).tipo || 'otro';
    byType[t] = (byType[t] || 0) + 1;
  }
  return { total: docs.length, last_24h: last24h, by_type: byType, motor: 'synkia-local' };
}

// ── Core processing pipeline ─────────────────────────────────────────────────

export async function processDocument(filePath, mimeType, originalName) {
  const { readFile } = await import('fs/promises');
  const buffer = await readFile(filePath);

  let text = '';
  let method = 'local';

  // Try OCR first for images, use pdftotext for PDFs
  if (mimeType === 'application/pdf') {
    try {
      const { execSync } = await import('child_process');
      text = execSync(`pdftotext '${filePath}' - 2>/dev/null || echo ""`, { encoding: 'utf-8' });
      method = 'pdftotext';
    } catch {
      // Fallback: try text extraction from buffer
      text = buffer.toString('utf-8').slice(0, 50000);
    }
  } else if (mimeType.startsWith('image/')) {
    // Placeholder: Tesseract would go here
    text = buffer.toString('utf-8').slice(0, 50000);
    method = 'raw-buffer';
  } else {
    text = buffer.toString('utf-8').slice(0, 50000);
  }

  if (!text || text.trim().length < 10) {
    const doc = {
      _id: _nextId(),
      nombre_archivo: originalName,
      mime_type: mimeType,
      filePath,
      procesado: new Date().toISOString(),
      estado: 'error',
      analisis: {
        tipo: 'otro',
        subtipo: null,
        resumen: 'No se pudo extraer texto del archivo',
        confianza: 0,
      },
      metodo_extraccion: method,
      chars_extraidos: text ? text.length : 0,
      texto_preview: (text || '').substring(0, 800),
    };
    await saveDocument(doc);
    return doc;
  }

  // Classify
  let classification;
  try {
    const { classify } = await import('../agents/classifier.js');
    classification = await classify({
      text: text.substring(0, 30000), // limit for classification
      filename: originalName,
      mimeType,
      source: 'upload',
    });
  } catch (err) {
    console.error('[CLASSIFIER] Error:', err.message);
    classification = { docType: 'otro', subType: null, confidence: 0, summary: 'Clasificación fallida' };
  }

  // Extract with DocumentAgent
  let result;
  try {
    const { process: docProcess } = await import('../agents/documentAgent.js');
    result = await docProcess({
      text,
      classification,
      filename: originalName,
      mimeType,
    });
  } catch (err) {
    console.error('[DOC-AGENT] Error:', err.message);
    result = {
      success: false,
      classification: {},
      durationMs: 0,
      error: err.message || 'Error en extracción',
    };
  }

  const doc = {
    _id: _nextId(),
    nombre_archivo: originalName,
    mime_type: mimeType,
    filePath,
    procesado: new Date().toISOString(),
    estado: result.success ? 'procesado' : 'error',
    metodo_extraccion: method,
    chars_extraidos: text.length,
    texto_preview: text.substring(0, 800),
    analisis: {
      tipo: result.classification?.docType || classification?.docType || 'otro',
      subtipo: result.classification?.subType || null,
      fecha: result.fecha || null,
      fecha_vencimiento: result.fecha_vencimiento || null,
      numero_documento: result.numero_documento || null,
      emisor: result.emisor || null,
      receptor: result.receptor || null,
      conceptos: result.conceptos || [],
      base_imponible: result.base_imponible || null,
      iva_total: result.iva_total || null,
      total: result.total || null,
      moneda: result.moneda || 'EUR',
      forma_pago: result.forma_pago || null,
      resumen: result.classification?.summary || classification?.summary || '',
      confianza: result.classification?.confidence || classification?.confidence || 0,
    },
    ...(result.subAgentResult || {}),
  };

  await saveDocument(doc);

  // Update entities from analyzed data
  await _updateEntitiesFromDoc(doc);

  return doc;
}

async function _updateEntitiesFromDoc(doc) {
  const entities = getEntities();
  const a = doc.analisis || {};

  if (a.emisor?.nombre) {
    const key = a.emisor.nombre.toLowerCase();
    if (!entities.providers.find(p => p.nombre.toLowerCase() === key)) {
      entities.providers.push({ nombre: a.emisor.nombre, nif: a.emisor.nif || a.emisor.CIF || null, tipo: 'proveedor' });
    }
  }
  if (a.receptor?.nombre) {
    const key = a.receptor.nombre.toLowerCase();
    if (!entities.providers.find(p => p.nombre.toLowerCase() === key)) {
      entities.providers.push({ nombre: a.receptor.nombre, nif: a.receptor.nif || null, tipo: 'cliente' });
    }
  }
  saveEntities(entities);
}

// Mantener compatibilidad
export const extractText = async (buffer, mimeType, name) => ({
  text: buffer.toString('utf-8').slice(0, 50000),
  method: 'local',
  ok: true,
  pages: 1,
});