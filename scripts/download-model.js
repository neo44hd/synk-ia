#!/usr/bin/env node
/**
 * download-model.js — Descarga el modelo GGUF de HuggingFace
 * 
 * Uso:
 *   node scripts/download-model.js              → descarga qwen2.5-7b (por defecto)
 *   node scripts/download-model.js phi           → descarga Phi-3.5-mini (más ligero)
 *   node scripts/download-model.js qwen          → descarga qwen2.5-7b
 *   node scripts/download-model.js qwen-3b       → descarga qwen2.5-3b (más ligero)
 */

import https from 'https';
import http from 'http';
import { createWriteStream, mkdirSync, existsSync, statSync, renameSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '../models');

// ─── Catálogo de modelos ─────────────────────────────────────────────────────
const MODELS = {
  'qwen': {
    name: 'qwen2.5-7b-instruct-q4_k_m.gguf',
    url:  'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf',
    size: '4.4 GB',
    desc: 'Qwen2.5 7B — mismo modelo que usabas en Ollama (recomendado)',
  },
  'qwen-3b': {
    name: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    url:  'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    size: '1.9 GB',
    desc: 'Qwen2.5 3B — más ligero, Oracle Cloud Free Tier',
  },
  'phi': {
    name: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    url:  'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    size: '2.2 GB',
    desc: 'Phi-3.5 Mini — rápido y eficiente, ideal para CPU',
  },
  'llama': {
    name: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url:  'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '1.9 GB',
    desc: 'Llama 3.2 3B — Meta, muy bueno para clasificación',
  },
};

// ─── CLI ─────────────────────────────────────────────────────────────────────
const alias  = process.argv[2] || 'qwen';
const chosen = MODELS[alias];

if (!chosen) {
  console.error(`\nModelo desconocido: "${alias}"`);
  console.error('Opciones disponibles:');
  Object.entries(MODELS).forEach(([k, v]) => console.error(`  ${k.padEnd(10)} ${v.size.padEnd(8)} ${v.desc}`));
  process.exit(1);
}

console.log(`\n[download-model] Modelo: ${chosen.desc}`);
console.log(`[download-model] Tamaño: ${chosen.size}`);
console.log(`[download-model] Destino: models/${chosen.name}\n`);

// ─── Descarga con progress bar ───────────────────────────────────────────────
if (!existsSync(MODELS_DIR)) {
  mkdirSync(MODELS_DIR, { recursive: true });
  console.log(`[download-model] Carpeta models/ creada`);
}

const destPath = path.join(MODELS_DIR, chosen.name);
const tmpPath  = destPath + '.download';

// Si ya existe, saltar
if (existsSync(destPath)) {
  const sizeMB = Math.round(statSync(destPath).size / 1024 / 1024);
  console.log(`[download-model] ✓ Ya existe (${sizeMB} MB): ${chosen.name}`);
  console.log(`[download-model] Para re-descargar, borra el archivo y vuelve a ejecutar.`);
  process.exit(0);
}

function download(url, dest, redirects = 0) {
  if (redirects > 5) throw new Error('Demasiadas redirecciones');

  const proto = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    let downloaded = 0;
    let total = 0;
    let lastPrint = 0;

    proto.get(url, { headers: { 'User-Agent': 'synkia-downloader/1.0' } }, (res) => {
      // Seguir redirecciones (HuggingFace usa 302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return resolve(download(res.headers.location, dest, redirects + 1));
      }

      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }

      total = parseInt(res.headers['content-length'] || '0', 10);

      res.on('data', chunk => {
        downloaded += chunk.length;
        const now = Date.now();
        if (now - lastPrint > 2000 || downloaded === total) {
          const pct  = total ? Math.round(downloaded / total * 100) : '?';
          const mb   = (downloaded / 1024 / 1024).toFixed(0);
          const tmb  = total ? (total / 1024 / 1024).toFixed(0) : '?';
          process.stdout.write(`\r  ${mb} MB / ${tmb} MB  (${pct}%)   `);
          lastPrint = now;
        }
      });

      res.pipe(file);

      file.on('finish', () => {
        file.close();
        process.stdout.write('\n');
        resolve();
      });
    }).on('error', err => {
      file.close();
      reject(err);
    });
  });
}

try {
  await download(chosen.url, tmpPath);
  renameSync(tmpPath, destPath);
  const sizeMB = Math.round(statSync(destPath).size / 1024 / 1024);
  console.log(`\n[download-model] ✓ Descargado: ${chosen.name} (${sizeMB} MB)`);
  console.log(`[download-model] Añade a .env:\n  AI_MODEL_NAME=${chosen.name}`);
} catch (err) {
  console.error('\n[download-model] Error:', err.message);
  process.exit(1);
}
