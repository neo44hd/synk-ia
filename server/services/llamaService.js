/**
 * llamaService.js — Singleton para node-llama-cpp
 * Reemplaza las llamadas HTTP a Ollama (:11434)
 * El modelo se carga UNA sola vez al arrancar el servidor.
 * Cada request crea/destruye su propio context (sin leak de memoria).
 */

import { getLlama, LlamaChatSession, LlamaJsonSchemaGrammar } from 'node-llama-cpp';
import path from 'path';
import { existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '../../models');

// ─── Estado del singleton ────────────────────────────────────────────────────
let _llama   = null;
let _model   = null;
let _loading = false;
let _error   = null;
let _loadedAt = null;

// ─── Nombre del modelo (configurable por .env) ───────────────────────────────
function getModelName() {
  return process.env.AI_MODEL_NAME || 'qwen2.5-7b-instruct-q4_k_m.gguf';
}

function getModelPath() {
  return process.env.AI_MODEL_PATH || path.join(MODELS_DIR, getModelName());
}

// ─── Inicialización ──────────────────────────────────────────────────────────
async function init() {
  if (_model) return _model;
  if (_error) throw _error;

  // Si ya hay una carga en curso, esperamos
  if (_loading) {
    while (_loading) await new Promise(r => setTimeout(r, 150));
    if (_error) throw _error;
    return _model;
  }

  _loading = true;
  const modelPath = getModelPath();

  try {
    if (!existsSync(modelPath)) {
      throw new Error(
        `[LlamaService] Modelo no encontrado: ${modelPath}\n` +
        `Ejecuta: node scripts/download-model.js`
      );
    }

    const sizeMB = Math.round(statSync(modelPath).size / 1024 / 1024);
    console.log(`[LlamaService] Cargando modelo (${sizeMB} MB): ${path.basename(modelPath)}`);

    _llama = await getLlama({
      // gpu: 'auto'  ← detecta Metal (Mac M4), CUDA, Vulkan o CPU automáticamente
      gpu: process.env.AI_GPU_MODE || 'auto',
    });

    _model = await _llama.loadModel({
      modelPath,
      // gpuLayers: 0  ← fuerza CPU. Quitar para usar GPU completa.
    });

    _loadedAt = new Date();
    console.log(`[LlamaService] ✓ Modelo listo en ${new Date() - _loadedAt + 1}ms`);
    return _model;

  } catch (err) {
    _error = err;
    console.error('[LlamaService] Error al cargar modelo:', err.message);
    throw err;
  } finally {
    _loading = false;
  }
}

// ─── Generación de texto ─────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.prompt       - Mensaje del usuario
 * @param {string} [opts.system]     - System prompt
 * @param {'text'|'json'} [opts.format] - 'json' fuerza JSON válido via gramática
 * @param {object} [opts.jsonSchema] - JSON Schema para structured output
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<{response: string, durationMs: number}>}
 */
async function generate({ prompt, system, format = 'text', jsonSchema = null, temperature = 0.1, maxTokens = 1024 }) {
  const model  = await init();
  const t0     = Date.now();

  // Cada request tiene su propio context → sin estado compartido entre requests
  const context = await model.createContext({ contextSize: 4096 });

  try {
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      ...(system ? { systemPrompt: system } : {}),
    });

    const generateOpts = { temperature, maxTokens };

    // JSON forzado via gramática (equivalente a format:'json' de Ollama)
    if (format === 'json' && _llama) {
      try {
        const schema = jsonSchema || { type: 'object' };
        generateOpts.grammar = new LlamaJsonSchemaGrammar(_llama, schema);
      } catch (grammarErr) {
        // Si la gramática falla, generamos sin ella y parseamos manualmente
        console.warn('[LlamaService] Grammar error (continuando sin ella):', grammarErr.message);
      }
    }

    const response = await session.prompt(prompt, generateOpts);
    return { response, durationMs: Date.now() - t0 };

  } finally {
    await context.dispose();
  }
}

// ─── Info del modelo ─────────────────────────────────────────────────────────
function getInfo() {
  const modelPath = getModelPath();
  const exists    = existsSync(modelPath);
  const sizeMB    = exists ? Math.round(statSync(modelPath).size / 1024 / 1024) : 0;

  return {
    name:     getModelName(),
    path:     modelPath,
    exists,
    sizeMB,
    loaded:   _model !== null,
    loadedAt: _loadedAt,
    error:    _error?.message || null,
    gpu:      process.env.AI_GPU_MODE || 'auto',
  };
}

// ─── Export ──────────────────────────────────────────────────────────────────
export const llamaService = {
  init,
  generate,
  getInfo,
  isReady: () => _model !== null && !_error,
};
