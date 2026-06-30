// Verificación de integridad de datos tras el reproceso.
// Comprueba que los JSON no estén corruptos, conteos coherentes y cross-checks.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data');
const load = (f) => {
  try { return JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); }
  catch (e) { return { __error: e.message }; }
};

const out = [];
const log = (...a) => out.push(a.join(' '));
let problems = 0;

log('═══════════════════════════════════════════════════════════');
log('  INFORME DE INTEGRIDAD — ' + new Date().toISOString());
log('═══════════════════════════════════════════════════════════');

// documents.json (fuente)
const dj = load('documents.json');
if (dj.__error) { log('✗ documents.json CORRUPTO: ' + dj.__error); problems++; }
else {
  const docs = dj.documents || [];
  const proc = docs.filter(d => d.estado === 'procesado').length;
  const errd = docs.length - proc;
  const org = docs.filter(d => d.organizacion).length;
  const tipos = {};
  docs.forEach(d => { const t = d.analisis?.tipo || '?'; tipos[t] = (tipos[t] || 0) + 1; });
  log(`✓ documents.json: ${docs.length} docs (procesados ${proc}, error ${errd}, con organización ${org})`);
  log('  tipos: ' + JSON.stringify(tipos));
  const noProc = docs.filter(d => d.estado !== 'procesado').map(d => d.nombre_archivo);
  if (noProc.length) log(`  ⚠ no procesados (${noProc.length}): ${noProc.slice(0, 20).join(', ')}${noProc.length > 20 ? '…' : ''}`);
}

// stores derivados (los que lee el frontend)
for (const f of ['document.json', 'invoice.json', 'provider.json', 'client.json', 'uploadedfile.json', 'emailmessage.json']) {
  const j = load(f);
  if (j.__error) { log(`✗ ${f} CORRUPTO: ${j.__error}`); problems++; }
  else log(`✓ ${f}: ${Array.isArray(j) ? j.length : '(NO es array)'} registros`);
}

// entities.json
const ent = load('entities.json');
if (ent.__error) { log('✗ entities.json CORRUPTO: ' + ent.__error); problems++; }
else log(`✓ entities.json: proveedores ${(ent.proveedores || []).length}, trabajadores ${(ent.trabajadores || []).length}, clientes ${(ent.clientes || []).length}`);

// cross-checks
if (!dj.__error) {
  const docs = dj.documents || [];
  const facturasDoc = docs.filter(d => (d.analisis?.tipo || '').includes('factura')).length;
  const nominasDoc = docs.filter(d => ['nomina', 'finiquito'].includes(d.analisis?.tipo)).length;
  const inv = load('invoice.json'); const invN = Array.isArray(inv) ? inv.length : 0;
  const upl = load('uploadedfile.json'); const uplN = Array.isArray(upl) ? upl.length : 0;
  log('— Cross-checks —');
  log(`  facturas: docs(tipo factura)=${facturasDoc} · invoice.json=${invN}`);
  log(`  nóminas: docs=${nominasDoc}`);
  log(`  uploadedfile.json=${uplN} (debería ≈ documents procesados+error)`);
}

log('═══════════════════════════════════════════════════════════');
log(problems === 0 ? '✅ INTEGRIDAD OK (sin ficheros corruptos)' : `❌ ${problems} problema(s) de integridad`);
log('═══════════════════════════════════════════════════════════');

console.log(out.join('\n'));
process.exit(problems === 0 ? 0 : 1);
