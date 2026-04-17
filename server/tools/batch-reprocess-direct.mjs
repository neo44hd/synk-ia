#!/usr/bin/env node
// Batch reprocess documents DIRECTLY (no HTTP) — avoids server timeout issues
// Usage: node batch-reprocess-direct.mjs [docId1 docId2 ...]
// If no IDs given, reprocesses ALL documents (except iCloud)

import { reprocessFile } from '../agents/pipeline.js';

async function main() {
  const targetIds = process.argv.slice(2);
  
  if (targetIds.length === 0) {
    console.log('Usage: node batch-reprocess-direct.mjs docId1 docId2 ...');
    process.exit(1);
  }
  
  console.log(`=== Batch reprocess DIRECT: ${targetIds.length} documentos ===\n`);
  
  let ok = 0, fail = 0;
  
  for (const docId of targetIds) {
    const t0 = Date.now();
    console.log(`[${new Date().toISOString()}] → ${docId}`);
    
    try {
      const doc = await reprocessFile(docId);
      const ana = doc.analysis || {};
      const ext = doc.extraction || {};
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      
      console.log(`  ✓ tipo=${ana.tipo} | conf=${ana.confianza} | method=${ext.method} | ${elapsed}s`);
      console.log(`    emisor: ${ana.emisor?.nombre || '?'}`);
      console.log(`    total:  ${ana.importes?.total || '?'} ${ana.importes?.moneda || 'EUR'}`);
      console.log(`    resumen: ${(ana.resumen || '').substring(0, 120)}`);
      
      if (ana.tipo !== 'otro' && !ana._parse_fallback) ok++;
      else fail++;
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      fail++;
    }
    console.log('');
  }
  
  console.log(`\n=== RESUMEN: OK=${ok}, Revisar=${fail}, Total=${ok + fail} ===`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
