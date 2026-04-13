/**
 * aider.js — Aider (AI coding assistant) via HTTP API
 *
 * Ejecuta Aider como subproceso y devuelve la respuesta via SSE streaming.
 * Aider usa Ollama como backend LLM.
 *
 * Endpoints:
 *   POST /api/aider        → enviar mensaje a Aider (SSE streaming)
 *   GET  /api/aider/status → estado de Aider
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';

const router = Router();

const AIDER_BIN    = process.env.AIDER_BIN || 'aider';
const OLLAMA_URL   = process.env.OLLAMA_URL || 'http://localhost:11434';
const AIDER_MODEL  = process.env.AIDER_MODEL || 'ollama/qwen3.5';
const PROJECT_DIR  = process.env.AIDER_PROJECT_DIR || process.env.SINKIA_DIR || '/Users/davidnows/sinkia';

// ── POST /api/aider — enviar mensaje a Aider ─────────────────────────────────
// Body: { message, model? }
// SSE: {type:"text", text:"..."} | {type:"status", text:"..."} | [DONE]
router.post('/', async (req, res) => {
  const { message, model } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Mensaje requerido' });

  const useModel = model || AIDER_MODEL;

  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  send({ type: 'status', text: `Ejecutando Aider con ${useModel}...` });

  try {
    const aider = spawn(AIDER_BIN, [
      '--model', useModel,
      '--no-auto-commits',
      '--no-git',
      '--yes-always',
      '--no-pretty',
      '--no-stream',
      '--message', message,
    ], {
      cwd: PROJECT_DIR,
      env: {
        ...process.env,
        OLLAMA_API_BASE: OLLAMA_URL,
      },
      timeout: 120_000,
    });

    let output = '';
    let errorOutput = '';

    aider.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      // Stream cada línea
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          send({ type: 'text', text: line + '\n' });
        }
      }
    });

    aider.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    aider.on('close', (code) => {
      if (code !== 0 && errorOutput) {
        send({ type: 'error', text: errorOutput.slice(0, 500) });
      }
      if (!output.trim()) {
        send({ type: 'text', text: '(Aider no produjo salida)' });
      }
      send({ type: 'status', text: `Aider finalizado (código ${code})` });
      res.write('data: [DONE]\n\n');
      res.end();
    });

    aider.on('error', (err) => {
      send({ type: 'error', text: `Error al ejecutar Aider: ${err.message}` });
      res.write('data: [DONE]\n\n');
      res.end();
    });

    // Timeout safety
    setTimeout(() => {
      try { aider.kill('SIGTERM'); } catch {}
    }, 120_000);

  } catch (e) {
    send({ type: 'error', text: e.message });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ── GET /api/aider/status ────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  try {
    // Check if aider binary exists
    const { execSync } = await import('child_process');
    const version = execSync(`${AIDER_BIN} --version 2>/dev/null`, { timeout: 5000 })
      .toString().trim();
    res.json({
      available: true,
      version,
      model: AIDER_MODEL,
      project: PROJECT_DIR,
    });
  } catch {
    res.json({
      available: false,
      error: 'Aider no encontrado',
      model: AIDER_MODEL,
    });
  }
});

export const aiderRouter = router;
