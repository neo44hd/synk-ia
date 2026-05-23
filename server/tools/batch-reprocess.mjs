#!/usr/bin/env node
// Batch reprocess documents sequentially — one at a time
// Usage: node batch-reprocess.mjs [docId1 docId2 ...]
// If no IDs given, reprocesses ALL documents

const BASE = process.env.API_URL || 'http://localhost:59401';
const TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';

async function reprocess(docId, name) {
  console.log(`\n[${new Date().toISOString()}] → ${name} (${docId})`);
  const t0 = Date.now();
  
  try {
    const res = await fetch(`${BASE}/api/filemanager/documents/${docId}/reprocess`, {
      method: 'POST',
      headers: { 'X-Admin-Token': TOKEN },
      signal: AbortSignal.timeout(900_000), // 15 min max per doc
    });
    
    if (!res.ok) {
      console.log(`  ✗ HTTP ${res.status}: ${(await res.text().catch(() => '')).substring(0, 200)}`);
      return false;
    }
    
    const data = await res.json();
    const doc = data.document || data;
    const ana = doc.analysis || {};
    const ext = doc.extraction || {};
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    
    console.log(`  ✓ tipo=${ana.tipo} | conf=${ana.confianza} | method=${ext.method} | ${elapsed}s`);
    console.log(`    emisor: ${ana.emisor?.nombre || '?'}`);
    console.log(`    total:  ${ana.importes?.total || '?'} ${ana.importes?.moneda || 'EUR'}`);
    console.log(`    resumen: ${(ana.resumen || '').substring(0, 120)}`);
    return ana.tipo !== 'otro' && !ana._parse_fallback;
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  // Get all documents
  const res = await fetch(`${BASE}/api/filemanager/documents`, {
    headers: { 'X-Admin-Token': TOKEN },
  });
  const allDocs = await res.json();
  const docs = (Array.isArray(allDocs) ? allDocs : allDocs.documents || [])
    .filter(d => !d.original_name?.includes('iCloud'));
  
  // If specific IDs given, filter
  const targetIds = process.argv.slice(2);
  const toProcess = targetIds.length > 0
    ? docs.filter(d => targetIds.includes(d.id))
    : docs;
  
  console.log(`=== Batch reprocess: ${toProcess.length} documentos ===`);
  
  let ok = 0, fail = 0;
  for (const doc of toProcess) {
    const success = await reprocess(doc.id, doc.original_name);
    if (success) ok++; else fail++;
  }
  
  console.log(`\n=== RESUMEN: OK=${ok}, Revisar=${fail}, Total=${ok + fail} ===`);
}

main().catch(console.error);
