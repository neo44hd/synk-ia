#!/usr/bin/env node
// Batch reprocess los 3 doc IDs procesados con código viejo (OLLAMA_URL roto)
import { reprocessFile } from '/app/server/agents/pipeline.js';

const docIds = [
  'doc_1779288551478_ppccix',   // PORTAL_EMPLEADO_PWA.pdf
  'doc_1779288558730_372486',   // SISTEMA_CEO_EJECUTIVO.pdf
  'doc_1779288685458_25lvbw',   // app_analysis.pdf
];

async function main() {
  console.log(`=== Reprocesando ${docIds.length} documentos (código fixeado) ===\n`);
  let ok = 0, fail = 0;

  for (const docId of docIds) {
    const t0 = Date.now();
    console.log(`[${new Date().toISOString()}] → ${docId}`);

    try {
      const doc = await reprocessFile(docId);
      const ana = doc.analysis || {};
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      console.log(`  ✓ tipo=${ana.tipo} | conf=${ana.confianza} | fallback=${ana._parse_fallback || false} | ${elapsed}s`);
      console.log(`    emisor: ${ana.emisor?.nombre || '?'}`);
      console.log(`    total:  ${ana.importes?.total || '?'}`);
      console.log(`    resumen: ${(ana.resumen || '').substring(0, 120)}`);

      if (ana._parse_fallback) { fail++; }
      else { ok++; }
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      fail++;
    }
    console.log('');
  }

  console.log(`\n=== RESUMEN: OK=${ok}, Fallback=${fail}, Total=${ok + fail} ===`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});