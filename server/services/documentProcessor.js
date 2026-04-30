// ══════════════════════════════════════════════════════════════════════════
//  documentProcessor.js  —  V1 PROXY hacia motor V3
//  Mantiene la misma firma pública, reenvía archivos a V3,
//  hace polling hasta que V3 termine, y devuelve el record
//  en el formato que V1 espera (analisis + metadatos).
// ══════════════════════════════════════════════════════════════════════════

import { readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const V3_API       = process.env.V3_API_URL || 'https://api-v3.sinkialabs.com';
const POLL_MS      = 2000;
const FOREGROUND_MS = 45_000;   // si V3 termina en <45s, devolvemos sincrono
const MAX_WAIT_MS  = 10 * 60_000; // hasta 10 min en background
const DOCS_FILE    = process.env.DOCS_FILE || '/Users/davidnows/sinkia/data/documents.json';
const ENT_FILE     = process.env.ENT_FILE  || '/Users/davidnows/sinkia/data/entities.json';

// ── Helpers JSON persistentes ────────────────────────────────────────────
async function loadJSON(file, def) {
  try {
    const txt = await readFile(file, 'utf-8');
    return JSON.parse(txt);
  } catch { return def; }
}
async function saveJSON(file, data) {
  const { writeFile } = await import('fs/promises');
  const dir = path.dirname(file);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Mime sniff básico por extensión ──────────────────────────────────────
function guessMime(originalName, fallback = 'application/octet-stream') {
  const ext = (originalName || '').toLowerCase().split('.').pop();
  const map = {
    pdf: 'application/pdf',
    eml: 'message/rfc822',
    msg: 'application/vnd.ms-outlook',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', tiff: 'image/tiff', bmp: 'image/bmp',
    txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:  'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv:  'text/csv',
  };
  return map[ext] || fallback;
}

// ── Subida multipart hacia V3 ────────────────────────────────────────────
async function uploadToV3(filePath, mimeType, originalName) {
  const buf = await readFile(filePath);
  const mime = mimeType && mimeType !== 'application/octet-stream'
    ? mimeType
    : guessMime(originalName, mimeType);

  const form = new FormData();
  const blob = new Blob([buf], { type: mime });
  form.append('file', blob, originalName);

  const res = await fetch(`${V3_API}/api/ingest`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`V3 ingest HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  return await res.json(); // { id, filename, status, content_hash, file_path, message }
}

// ── Polling hasta done/error ─────────────────────────────────────────────
async function waitForProcessing(docId, maxWait = MAX_WAIT_MS) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxWait) {
    const r = await fetch(`${V3_API}/api/documents/${docId}`);
    if (!r.ok) { await new Promise(s => setTimeout(s, POLL_MS)); continue; }
    const doc = await r.json();
    if (doc.status === 'done')  return doc;
    if (doc.status === 'error') throw new Error(doc.error_message || 'V3 error procesando');
    await new Promise(s => setTimeout(s, POLL_MS));
  }
  return null; // timeout suave
}

// ── Niños (nóminas split) de un PDF multi-factura ────────────────────────
async function fetchChildren(parentId, maxWaitMs = 5 * 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxWaitMs) {
    try {
      const r = await fetch(`${V3_API}/api/documents?parent_id=${parentId}&limit=200`);
      if (r.ok) {
        const data = await r.json();
        const all = Array.isArray(data) ? data : (data.items || data.documents || []);
        const kids = all.filter(d => String(d.parent_id) === String(parentId));
        if (kids.length > 0 && kids.every(k => k.status === 'done' || k.status === 'error')) {
          const full = await Promise.all(kids.filter(k => k.status === 'done').map(async k => {
            try {
              const rr = await fetch(`${V3_API}/api/documents/${k.id}`);
              return rr.ok ? await rr.json() : k;
            } catch { return k; }
          }));
          return full;
        }
      }
    } catch {}
    await new Promise(s => setTimeout(s, 3000));
  }
  return [];
}

// ── Mapea V3 → formato analisis de V1 ────────────────────────────────────
function v3ToV1Analysis(v3Doc) {
  const f = v3Doc.extracted_fields || {};
  return {
    tipo:             f.tipo || v3Doc.doc_type || 'otro',
    subtipo:          f.subtipo || null,
    fecha:            f.fecha || null,
    fecha_vencimiento:f.fecha_vencimiento || null,
    numero_documento: f.numero_documento || null,
    emisor:           f.emisor || null,
    receptor:         f.receptor || null,
    trabajador:       f.trabajador || null,
    conceptos:        Array.isArray(f.conceptos) ? f.conceptos : [],
    base_imponible:   f.base_imponible ?? null,
    iva_total:        f.iva_total ?? null,
    total:            f.total ?? null,
    moneda:           f.moneda || 'EUR',
    forma_pago:       f.forma_pago || null,
    cuenta_bancaria:  f.cuenta_bancaria || null,
    referencia:       f.datos_extra?.referencia_pago || null,
    metodo_pago:      f.datos_extra?.metodo_pago || null,
    estado_pago:      f.tipo === 'factura_recibida' || f.tipo === 'recibo' ? 'pagada' : null,
    resumen:          f.resumen || '',
    confianza:        f.confianza ?? (v3Doc.confidence ? parseFloat(v3Doc.confidence) : null),
  };
}

// ── Normaliza un record V3 al formato que guarda V1 ──────────────────────
function toV1Record(v3Doc, originalName, mimeType, extraMeta = {}) {
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  return {
    id,
    v3_id:             v3Doc.id, // puente al motor V3
    nombre_archivo:    originalName || v3Doc.filename,
    mime_type:         mimeType || v3Doc.mimetype,
    procesado:         new Date().toISOString(),
    tiempo_ms:         v3Doc.processing_ms || 0,
    metodo_extraccion: v3Doc.extraction_method || 'v3-proxy',
    paginas:           v3Doc.page_count || 1,
    chars_extraidos:   (v3Doc.extracted_text || '').length,
    texto_preview:     (v3Doc.extracted_text || '').slice(0, 800),
    analisis:          v3ToV1Analysis(v3Doc),
    estado:            'procesado',
    ...extraMeta,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  API PÚBLICA — misma firma que el processor original
// ══════════════════════════════════════════════════════════════════════════

// Finaliza el registro cuando V3 termina (usado tanto sync como background)
async function finalizeRecord(done, originalName, mimeType, t0) {
  const record = toV1Record(done, originalName, mimeType, {
    tiempo_total_ms: Date.now() - t0,
  });

  if (done.child_count && done.child_count > 0) {
    const kids = await fetchChildren(done.id);
    record.hijos = kids.map(k => ({
      v3_id: k.id,
      nombre: k.filename,
      tipo: k.doc_type,
      pagina: k.page_range,
      analisis: v3ToV1Analysis(k),
    }));
    console.log(`[PROXY→V3]   + ${record.hijos.length} hijos (split)`);
  }

  const docs = await loadJSON(DOCS_FILE, []);
  // Reemplaza placeholder si existía
  const idx = docs.findIndex(d => d.v3_id === done.id && d.estado === 'procesando');
  if (idx >= 0) docs.splice(idx, 1);
  docs.unshift(record);
  if (record.hijos?.length) {
    for (const h of record.hijos) {
      docs.unshift({
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        v3_id: h.v3_id,
        parent_v3_id: done.id,
        nombre_archivo: h.nombre,
        mime_type: 'application/pdf',
        procesado: new Date().toISOString(),
        tiempo_ms: 0,
        metodo_extraccion: 'v3-split',
        paginas: 1,
        analisis: h.analisis,
        estado: 'procesado',
      });
    }
  }
  await saveJSON(DOCS_FILE, docs.slice(0, 5000));
  return record;
}

// Espera en background cuando V3 tarda más que FOREGROUND_MS
async function backgroundFinalize(v3Id, originalName, mimeType, t0, filePath) {
  try {
    const done = await waitForProcessing(v3Id, MAX_WAIT_MS);
    if (!done) {
      console.warn(`[PROXY→V3]   ⚠ timeout background v3_id=${v3Id}`);
      return;
    }
    await finalizeRecord(done, originalName, mimeType, t0);
    console.log(`[PROXY→V3]   ✓ background done v3_id=${v3Id} → tipo=${done.doc_type}`);
  } catch (e) {
    console.warn(`[PROXY→V3]   ✗ background v3_id=${v3Id}: ${e.message}`);
  } finally {
    unlink(filePath).catch(() => {});
  }
}

export async function processDocument(filePath, mimeType, originalName) {
  const t0 = Date.now();
  console.log(`[PROXY→V3] Subiendo: ${originalName}`);

  const ingested = await uploadToV3(filePath, mimeType, originalName);
  console.log(`[PROXY→V3]   V3 id=${ingested.id}, esperando procesamiento…`);

  // Intentamos foreground rápido
  const done = await waitForProcessing(ingested.id, FOREGROUND_MS);

  if (done) {
    console.log(`[PROXY→V3]   ✓ done en ${done.processing_ms}ms → tipo=${done.doc_type}`);
    unlink(filePath).catch(() => {});
    return await finalizeRecord(done, originalName, mimeType, t0);
  }

  // Tarda más → respondemos con placeholder y dejamos procesando en background
  console.log(`[PROXY→V3]   ⏳ >${FOREGROUND_MS/1000}s, sigue en background`);
  backgroundFinalize(ingested.id, originalName, mimeType, t0, filePath);
  const placeholder = {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    v3_id: ingested.id,
    nombre_archivo: originalName,
    mime_type: mimeType,
    procesado: new Date().toISOString(),
    tiempo_ms: 0,
    metodo_extraccion: 'v3-proxy-pending',
    analisis: { tipo: 'procesando', resumen: 'El motor V3 está analizando este documento…' },
    estado: 'procesando',
  };
  const docs = await loadJSON(DOCS_FILE, []);
  docs.unshift(placeholder);
  await saveJSON(DOCS_FILE, docs.slice(0, 5000));
  return placeholder;
}

// ── Lecturas: leen el documents.json local de V1 (sincronizado por este proxy)
export const getDocuments  = () => loadJSON(DOCS_FILE, []);
export const getEntities   = () => loadJSON(ENT_FILE, { clientes: [], proveedores: [], trabajadores: [] });
export const getDocument   = async id => {
  const d = await loadJSON(DOCS_FILE, []);
  return d.find(x => x.id === id) || null;
};

export async function deleteDocument(id) {
  const docs = await loadJSON(DOCS_FILE, []);
  const next = docs.filter(d => d.id !== id);
  await saveJSON(DOCS_FILE, next);
  return { ok: true };
}

export async function getStats() {
  const docs = await loadJSON(DOCS_FILE, []);
  const by_type = {};
  for (const d of docs) {
    const t = d.analisis?.tipo || 'otro';
    by_type[t] = (by_type[t] || 0) + 1;
  }
  const last24 = docs.filter(d => Date.now() - new Date(d.procesado).getTime() < 86_400_000).length;
  return { total: docs.length, last_24h: last24, by_type, motor: 'v3-proxy' };
}

// ── Extractor compat: no se usa con el proxy pero la ruta lo importa ─────
export async function extractText() {
  return { text: '[delegado a V3]', method: 'v3-proxy', ok: true, pages: 1 };
}
