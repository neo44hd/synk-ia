// Validación B1: procesa UN archivo a través del pipeline de 3 agentes
// (extractor markdown-first → analyzer → organizer). Escribe en filemanager_docs.json.
import '../server/env-loader.mjs';
import path from 'path';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/test-pipeline.mjs <ruta-archivo>');
  process.exit(1);
}

const mimeByExt = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};
const ext = path.extname(file).toLowerCase();
const mime = mimeByExt[ext] || 'application/octet-stream';

const { processFile } = await import('../server/agents/pipeline.js');

console.log(`\n▶ Procesando: ${path.basename(file)} (${mime})\n`);
const t0 = Date.now();
const rec = await processFile(file, mime, path.basename(file));
console.log(`\n── RESULTADO (${Date.now() - t0}ms) ──`);
console.log('status:               ', rec.status);
console.log('extraction.method:    ', rec.extraction?.method, '| chars:', rec.extraction?.text?.length || 0);
console.log('analysis.tipo:        ', rec.analysis?.tipo, '| subtipo:', rec.analysis?.subtipo);
console.log('analysis.emisor:      ', JSON.stringify(rec.analysis?.emisor));
console.log('analysis.importes:    ', JSON.stringify(rec.analysis?.importes));
console.log('analysis.fechas:      ', JSON.stringify(rec.analysis?.fechas));
console.log('organization.folder:  ', rec.organization?.folder_path);
console.log('organization.nombre:  ', rec.organization?.normalized_name);
console.log('entities_created:     ', JSON.stringify(rec.organization?.entities_created));
console.log('pending_actions:      ', JSON.stringify(rec.organization?.pending_actions));
