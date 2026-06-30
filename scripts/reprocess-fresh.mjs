// REPROCESO DESDE CERO — reconstruye documents.json + entities.json a partir
// de TODOS los archivos de uploads/, usando el pipeline actual (extractor →
// analyzer con modelo potente → organizer). En SERIE (concurrencia 1) para no
// corromper los JSON ni entities.json (el organizer escribe entities.json).
//
// Requisito: los stores deben haberse reseteado antes (lo hace el orquestador).
// Uso: node scripts/reprocess-fresh.mjs [limite]
import '../server/env-loader.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const UPLOADS = process.env.UPLOADS_DIR || path.join(ROOT, 'uploads');
const DB = path.join(DATA, 'documents.json');

const { extract } = await import('../server/agents/extractorAgent.js');
const { analyze } = await import('../server/agents/analyzerAgent.js');
const { organize } = await import('../server/agents/organizerAgent.js');

const mimeByExt = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv', '.txt': 'text/plain',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.eml': 'message/rfc822',
};

const LIMIT = parseInt(process.argv[2] || '0', 10);
const files = fs.readdirSync(UPLOADS)
  .filter(f => !f.startsWith('.') && fs.statSync(path.join(UPLOADS, f)).isFile());
const list = LIMIT > 0 ? files.slice(0, LIMIT) : files;
console.log(`[FRESH] Reprocesando ${list.length} archivos de uploads/ (modelo potente, serie)`);

const docs = [];
let done = 0, ok = 0, err = 0, idn = 0;
const save = () => fs.writeFileSync(DB, JSON.stringify({ documents: docs, entities: { providers: [], workers: [], clients: [] } }, null, 2));

for (const file of list) {
  const fp = path.join(UPLOADS, file);
  const ext = path.extname(file).toLowerCase();
  const mime = mimeByExt[ext] || 'application/octet-stream';
  try {
    const ex = await extract(fp, mime, file);
    const text = ex.text || '';
    let A = {}, org = null, estado = 'error';
    const method = ex.method;
    if (text && text.trim().length >= 10) {
      const ar = await analyze({ text, method, originalName: file, mimeType: mime, metadata: ex.metadata });
      A = ar.analysis || {};
      estado = ar.ok ? 'procesado' : 'error';
      try { org = await organize(A, ex, file); } catch (e) { /* organizer opcional */ }
    }
    docs.push({
      id: `doc_${Date.now()}_${(idn++).toString(36)}`,
      nombre_archivo: file, mime_type: mime, filePath: fp,
      procesado: new Date().toISOString(), estado, metodo_extraccion: method,
      chars_extraidos: text.length, texto_preview: text.slice(0, 800),
      analisis: {
        tipo: A.tipo || 'otro', subtipo: A.subtipo || null,
        fecha: A.fechas?.documento || null, fecha_vencimiento: A.fechas?.vencimiento || null,
        numero_documento: A.referencias?.numero_documento || null,
        emisor: A.emisor || null, receptor: A.receptor || null, trabajador: A.trabajador || null,
        conceptos: A.conceptos || [],
        base_imponible: A.importes?.base_imponible ?? null, iva_total: A.importes?.iva_total ?? null,
        total: A.importes?.total ?? null, moneda: A.importes?.moneda || 'EUR',
        forma_pago: A.forma_pago || null, resumen: A.resumen || '', confianza: A.confianza || 0, tags: A.tags || [],
      },
      organizacion: org ? {
        folder_path: org.folder_path, normalized_name: org.normalized_name, full_path: org.full_path,
        destination: org.destination || null, pending_actions: org.pending_actions || [], tags: org.tags || [],
      } : null,
    });
    if (estado === 'procesado') ok++; else err++;
  } catch (e) {
    err++;
    console.warn('[FRESH] ✗', file, e.message);
  }
  done++;
  if (done % 5 === 0) { save(); console.log(`[FRESH] ${done}/${list.length} (ok ${ok}, err ${err})`); }
}
save();
console.log(`[FRESH] HECHO: ${done} archivos, ${ok} ok, ${err} err`);

const { syncAll } = await import('../server/services/dataSync.js');
console.log('[FRESH] SYNC:', JSON.stringify(syncAll()));
console.log('[FRESH] ✓ Reconstrucción completa');
