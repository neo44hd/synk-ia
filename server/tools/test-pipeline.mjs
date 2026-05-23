// test-pipeline.mjs — Script de diagnóstico para probar pipeline + persistencia
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// Simular exactamente lo que hace pipeline.js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');  // Desde server/tools/ → raíz synkia-app → data
const DOCUMENTS_FILE = path.join(DATA_DIR, 'filemanager_docs.json');

console.log('__dirname:', __dirname);
console.log('DATA_DIR:', DATA_DIR);
console.log('DOCUMENTS_FILE:', DOCUMENTS_FILE);
console.log('data dir exists:', existsSync(DATA_DIR));
console.log('docs file exists:', existsSync(DOCUMENTS_FILE));

// Probar escritura
try {
  const testData = [{ id: 'test_1', original_name: 'test.pdf', status: 'processed' }];
  writeFileSync(DOCUMENTS_FILE, JSON.stringify(testData, null, 2), 'utf-8');
  console.log('WRITE OK');
  const content = readFileSync(DOCUMENTS_FILE, 'utf-8');
  console.log('READ BACK:', content);
} catch (e) {
  console.error('WRITE ERROR:', e.message);
}

// Probar append (upsert)
try {
  const existing = JSON.parse(readFileSync(DOCUMENTS_FILE, 'utf-8'));
  existing.push({ id: 'test_2', original_name: 'test2.pdf', status: 'processed' });
  writeFileSync(DOCUMENTS_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  console.log('UPSERT OK');
  console.log('Final content:', readFileSync(DOCUMENTS_FILE, 'utf-8'));
} catch (e) {
  console.error('UPSERT ERROR:', e.message);
}