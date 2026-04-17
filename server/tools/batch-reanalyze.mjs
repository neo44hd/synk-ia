#!/usr/bin/env node
// Batch RE-ANALYZE documents (skip extraction, only re-run analyzer)
// Usage: node batch-reanalyze.mjs [docId1 docId2 ...]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = process.env.DATA_DIR || join(__dirname, '..', '..', 'data');
const DB_PATH   = join(DATA_DIR, 'filemanager_docs.json');

// Import analyzer and organizer
const { analyzeDocument } = await import('../agents/analyzerAgent.js');
const { organizeDocument } = await import('../agents/organizerAgent.js');

function loadDB() {
  return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
}
function saveDB(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function reanalyze(docId) {
  const db = loadDB();
  const docs = Array.isArray(db) ? db : (db.documents || []);
  const doc = docs.find(d => d.id === docId);
  if (!doc) throw new Error(`Doc ${docId} not found in ${docs.length} docs`);
  
  const text   = doc.extraction?.text || '';
  const method = doc.extraction?.method || 'unknown';
  const name   = doc.original_name;
  
  if (!text || text.length < 10) {
    throw new Error(`Doc ${docId} has no extracted text (${text.length} chars)`);
  }
  
  console.log(`  Texto: ${text.length} chars | método: ${method}`);
  
  // Re-analyze
  const analysis = await analyzeDocument(text, name, method);
  
  // Update DB
  const db2 = loadDB();
  const docs2 = Array.isArray(db2) ? db2 : (db2.documents || []);
  const doc2 = docs2.find(d => d.id === docId);
  doc2.analysis = analysis;
  doc2.status = 'processed';
  doc2.updated_at = new Date().toISOString();
  
  // Re-organize
  const orgResult = await organizeDocument(doc2);
  if (orgResult.storagePath) {
    doc2.storage_path = orgResult.storagePath;
    doc2.tags = orgResult.tags || doc2.tags;
  }
  
  saveDB(db2);
  return doc2;
}

async function main() {
  const targetIds = process.argv.slice(2);
  if (targetIds.length === 0) {
    console.log('Usage: node batch-reanalyze.mjs docId1 docId2 ...');
    process.exit(1);
  }
  
  console.log(`=== Batch RE-ANALYZE: ${targetIds.length} documentos ===\n`);
  
  let ok = 0, fail = 0;
  
  for (const docId of targetIds) {
    const t0 = Date.now();
    const db = loadDB();
    const allDocs = Array.isArray(db) ? db : (db.documents || []);
    const doc = allDocs.find(d => d.id === docId);
    const name = doc?.original_name || docId;
    
    console.log(`[${new Date().toISOString()}] → ${name} (${docId})`);
    
    try {
      const result = await reanalyze(docId);
      const ana = result.analysis || {};
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      
      console.log(`  ✓ tipo=${ana.tipo} | conf=${ana.confianza} | ${elapsed}s`);
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
