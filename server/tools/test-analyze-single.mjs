#!/usr/bin/env node
// Test: analyze a single doc and print the raw LLM response
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = process.env.DATA_DIR || join(__dirname, '..', '..', 'data');
const DB_PATH   = join(DATA_DIR, 'filemanager_docs.json');

const docId = process.argv[2] || '';
if (!docId) { console.log('Usage: node test-analyze-single.mjs <docId>'); process.exit(1); }

const db = JSON.parse(readFileSync(DB_PATH, 'utf-8'));
const docs = Array.isArray(db) ? db : (db.documents || []);
const doc = docs.find(d => d.id === docId);
if (!doc) { console.log('Not found'); process.exit(1); }

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const text = (doc.extraction?.text || '').substring(0, 3000); // Only first 3000 chars for speed

console.log(`Doc: ${doc.original_name}`);
console.log(`Text (first 200): ${text.substring(0, 200)}`);
console.log(`\n--- Calling harmonic-hermes-9b ---\n`);

const res = await fetch(`${OLLAMA_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'harmonic-hermes-9b:latest',
    stream: false,
    think: false,
    options: { num_predict: 1500, temperature: 0.05 },
    messages: [
      { role: 'system', content: 'Eres un clasificador de documentos. Responde SOLO con JSON válido. El JSON debe tener esta estructura exacta: {"tipo": "factura_recibida", "confianza": 0.95, "emisor": {"nombre": "..."}, "importes": {"total": 100, "moneda": "EUR"}, "resumen": "..."}' },
      { role: 'user', content: `Clasifica este documento:\n${text}\n\nIMPORTANTE: Responde ÚNICAMENTE con JSON. Tu respuesta debe empezar con { y terminar con }.` }
    ]
  }),
  signal: AbortSignal.timeout(120_000),
});

const data = await res.json();
console.log('Content:', data.message?.content?.substring(0, 1000) || '(empty)');
console.log('\nThinking:', (data.message?.thinking || '(none)').substring(0, 500));
