// Reprocesa documentos existentes (documents.json) por el pipeline actual
// (extractor robusto + analyzer cloud B3 + organizer), ACTUALIZANDO EN SITIO
// (sin duplicar). Uso: node scripts/reprocess-all.mjs [limite]
import '../server/env-loader.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(ROOT, 'data', 'documents.json');

const { extract } = await import('../server/agents/extractorAgent.js');
const { analyze } = await import('../server/agents/analyzerAgent.js');
const { organize } = await import('../server/agents/organizerAgent.js');

const LIMIT = parseInt(process.argv[2] || '0', 10); // 0 = todos
const CONC = parseInt(process.env.REPROCESS_CONC || '2', 10);

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const docs = db.documents || [];
const targets = docs.filter(d => d.filePath && fs.existsSync(d.filePath));
const list = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;
console.log(`Reprocesando ${list.length}/${docs.length} docs (conc ${CONC})...`);

let done = 0, ok = 0, err = 0;
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 2));

async function one(doc) {
  try {
    const ex = await extract(doc.filePath, doc.mime_type || 'application/pdf', doc.nombre_archivo);
    if (!ex.text || ex.text.trim().length < 10) {
      doc.estado = 'error'; doc.metodo_extraccion = ex.method; err++; return;
    }
    const ar = await analyze({ text: ex.text, method: ex.method, originalName: doc.nombre_archivo, mimeType: doc.mime_type, metadata: ex.metadata });
    const A = ar.analysis || {};
    let org = null; try { org = await organize(A, ex, doc.nombre_archivo); } catch { /* organizer opcional */ }
    doc.metodo_extraccion = ex.method;
    doc.chars_extraidos = ex.text.length;
    doc.texto_preview = ex.text.slice(0, 800);
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
    ok++;
  } catch (e) {
    doc.estado = 'error'; err++;
    console.warn('  ✗', doc.nombre_archivo, e.message);
  } finally {
    done++;
    if (done % 5 === 0) { save(); console.log(`  ${done}/${list.length} (ok ${ok}, err ${err})`); }
  }
}

const queue = [...list];
async function worker() { while (queue.length) await one(queue.shift()); }
await Promise.all(Array.from({ length: Math.min(CONC, list.length) }, () => worker()));
save();
console.log(`HECHO: ${done} procesados, ${ok} ok, ${err} err`);

const { syncAll } = await import('../server/services/dataSync.js');
console.log('SYNC:', JSON.stringify(syncAll()));
