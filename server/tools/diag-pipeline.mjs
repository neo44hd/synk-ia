// Reproduce el flujo real del pipeline para diagnosticar persistencia
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { extract } from '../agents/extractorAgent.js';
import { analyze } from '../agents/analyzerAgent.js';
import { organize } from '../agents/organizerAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'filemanager_docs.json');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

function loadDocs() {
  if (!existsSync(DOCUMENTS_FILE)) return [];
  return JSON.parse(readFileSync(DOCUMENTS_FILE, 'utf-8'));
}

function saveDocs(docs) {
  writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

function upsertDocument(doc) {
  const docs = loadDocs();
  const idx = docs.findIndex(d => d.id === doc.id);
  if (idx !== -1) docs[idx] = doc;
  else docs.push(doc);
  saveDocs(docs);
  return doc;
}

// Usar el PDF de uploads
import { readdirSync } from 'fs';
const pdfs = readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.pdf'));
console.log('PDFs encontrados:', pdfs);

if (pdfs.length === 0) {
  console.log('No hay PDFs en uploads/');
  process.exit(0);
}

const originalName = pdfs[0];
const filePath = path.join(UPLOADS_DIR, originalName);
const fileSize = statSync(filePath).size;
const mimeType = 'application/pdf';

console.log(`Procesando: ${originalName} (${fileSize} bytes)`);

const docId = `doc_${Date.now()}_test`;
let record = {
  id: docId,
  original_name: originalName,
  mime_type: mimeType,
  file_size: fileSize,
  file_path: filePath,
  extraction: { ok: false },
  analysis: {},
  organization: {},
  status: 'failed',
  agents_completed: [],
  processing_time_ms: 0,
  processed_at: new Date().toISOString(),
  errors: [],
};

const startTime = Date.now();

// Paso 1: Extracción
try {
  console.log('[1/3] Extrayendo...');
  const extractedData = await extract(filePath, mimeType, originalName);
  record.extraction = { ...extractedData, ok: true };
  record.agents_completed.push('extractor');
  console.log(`  Extraído: ${extractedData.text?.length || 0} chars`);
} catch (err) {
  console.error('Extracción falló:', err.message);
  record.errors.push({ agent: 'extractor', message: err.message });
  record.status = 'failed';
  record.processing_time_ms = Date.now() - startTime;
  upsertDocument(record);
  console.log('Persistido (error en extracción)');
  process.exit(1);
}

// Paso 2: Análisis
try {
  console.log('[2/3] Analizando...');
  const analysisResult = await analyze(record.extraction);
  record.analysis = analysisResult.analysis ?? analysisResult;
  record.agents_completed.push('analyzer');
  console.log(`  Tipo: ${record.analysis?.tipo}, confianza: ${record.analysis?.confianza}`);
} catch (err) {
  console.error('Análisis falló:', err.message);
  record.errors.push({ agent: 'analyzer', message: err.message });
  record.status = 'partial';
  record.processing_time_ms = Date.now() - startTime;
  upsertDocument(record);
  console.log('Persistido (error en análisis)');
  process.exit(1);
}

// Paso 3: Organización
try {
  console.log('[3/3] Organizando...');
  const organizeResult = await organize(record.analysis, record.extraction, originalName);
  record.organization = organizeResult;
  record.agents_completed.push('organizer');
  console.log(`  Carpeta: ${organizeResult?.folder_path}`);
} catch (err) {
  console.error('Organización falló:', err.message);
  record.errors.push({ agent: 'organizer', message: err.message });
  record.status = 'partial';
}

// Finalizar
record.status = 'processed';
record.processing_time_ms = Date.now() - startTime;
upsertDocument(record);

console.log(`\n✅ Procesado en ${record.processing_time_ms}ms`);
console.log('Examinando filemanager_docs.json...');

const final = loadDocs();
console.log(`Docs en store: ${final.length}`);
const lastDoc = final[final.length - 1];
console.log(`  ID: ${lastDoc.id}`);
console.log(`  Nombre: ${lastDoc.original_name}`);
console.log(`  Tipo: ${lastDoc.analysis?.tipo}`);
console.log(`  Confianza: ${lastDoc.analysis?.confianza}`);
console.log(`  Estado: ${lastDoc.status}`);
console.log(`  Agentes: ${lastDoc.agents_completed.join(', ')}`);