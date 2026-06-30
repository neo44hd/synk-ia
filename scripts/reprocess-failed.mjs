// REPROCESA SOLO LOS FALLIDOS — documentos con estado !== 'procesado' en
// documents.json, usando el pipeline actual (ahora con OCR de visión NVIDIA
// para escaneados). Actualiza en sitio. En serie para no corromper los JSON.
// Uso: node scripts/reprocess-failed.mjs [limite]
import '../server/env-loader.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(ROOT, 'data', 'documents.json');

const { extract } = await import('../server/agents/extractorAgent.js');
const { analyze } = await import('../server/agents/analyzerAgent.js');
const { organize } = await import('../server/agents/organizerAgent.js');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const docs = db.documents || [];
const LIMIT = parseInt(process.argv[2] || '0', 10);
let targets = docs.filter(d => d.estado !== 'procesado' && d.filePath && fs.existsSync(d.filePath));
if (LIMIT > 0) targets = targets.slice(0, LIMIT);
console.log(`[FAILED] Reprocesando ${targets.length} documentos fallidos (OCR visión NVIDIA)`);

let done = 0, ok = 0, err = 0;
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 2));

for (const doc of targets) {
  try {
    const ex = await extract(doc.filePath, doc.mime_type || 'application/pdf', doc.nombre_archivo);
    const text = ex.text || '';
    doc.metodo_extraccion = ex.method;
    doc.chars_extraidos = text.length;
    if (!text || text.trim().length < 10) {
      doc.estado = 'error';
      err++;
    } else {
      const ar = await analyze({ text, method: ex.method, originalName: doc.nombre_archivo, mimeType: doc.mime_type, metadata: ex.metadata });
      const A = ar.analysis || {};
      let org = null; try { org = await organize(A, ex, doc.nombre_archivo); } catch (e) { /* opcional */ }
      doc.texto_preview = text.slice(0, 800);
      doc.estado = ar.ok ? 'procesado' : 'error';
      doc.analisis = {
        tipo: A.tipo || 'otro', subtipo: A.subtipo || null,
        fecha: A.fechas?.documento || null, fecha_vencimiento: A.fechas?.vencimiento || null,
        numero_documento: A.referencias?.numero_documento || null,
        emisor: A.emisor || null, receptor: A.receptor || null, trabajador: A.trabajador || null,
        conceptos: A.conceptos || [],
        base_imponible: A.importes?.base_imponible ?? null, iva_total: A.importes?.iva_total ?? null,
        total: A.importes?.total ?? null, moneda: A.importes?.moneda || 'EUR',
        forma_pago: A.forma_pago || null, resumen: A.resumen || '', confianza: A.confianza || 0, tags: A.tags || [],
      };
      doc.organizacion = org ? {
        folder_path: org.folder_path, normalized_name: org.normalized_name, full_path: org.full_path,
        destination: org.destination || null, pending_actions: org.pending_actions || [], tags: org.tags || [],
      } : null;
      doc.procesado = new Date().toISOString();
      if (ar.ok) ok++; else err++;
    }
  } catch (e) {
    err++;
    console.warn('[FAILED] ✗', doc.nombre_archivo, e.message);
  }
  done++;
  if (done % 5 === 0) { save(); console.log(`[FAILED] ${done}/${targets.length} (ok ${ok}, err ${err})`); }
}
save();
console.log(`[FAILED] HECHO: ${done} reprocesados, ${ok} ok, ${err} err`);

const { syncAll } = await import('../server/services/dataSync.js');
console.log('[FAILED] SYNC:', JSON.stringify(syncAll()));
