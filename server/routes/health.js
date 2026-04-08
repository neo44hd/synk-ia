/**
 * health.js — EXTENDED
 * Añade: /ping, /ai (estado del modelo LLM), info del sistema
 * Mantiene: /  y  /config  existentes
 */

import { Router } from 'express';
import os from 'os';

export const healthRouter = Router();

// ── GET /api/health/ping — ultra-rápido para uptime monitors ─────────────────
healthRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ── GET /api/health — estado completo del sistema ────────────────────────────
healthRouter.get('/', async (_req, res) => {
  const mem    = process.memoryUsage();
  const freeMB = Math.round(os.freemem()   / 1024 / 1024);
  const totMB  = Math.round(os.totalmem()  / 1024 / 1024);

  const status = {
    status:  'ok',
    uptime:  Math.round(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    env:     process.env.NODE_ENV || 'development',
    memory: {
      heap_used_mb:    Math.round(mem.heapUsed  / 1024 / 1024),
      heap_total_mb:   Math.round(mem.heapTotal / 1024 / 1024),
      rss_mb:          Math.round(mem.rss       / 1024 / 1024),
      system_free_mb:  freeMB,
      system_total_mb: totMB,
    },
    services: {
      email:     !!process.env.EMAIL_APP_PASSWORD,
      biloop:    !!process.env.ASSEMPSA_BILOOP_API_KEY,
      revo:      !!process.env.REVO_TOKEN_LARGO,
      eseecloud: !!process.env.ESEECLOUD_USERNAME,
    },
  };

  // Estado del motor AI (sin cargarlo si no está listo)
  try {
    const { llamaService } = await import('../services/llamaService.js');
    const info = llamaService.getInfo();
    status.services.ai = {
      ready:   llamaService.isReady(),
      model:   info.name,
      exists:  info.exists,
      size_mb: info.sizeMB,
      gpu:     info.gpu,
      error:   info.error,
    };
  } catch {
    status.services.ai = { ready: false, error: 'AI service not loaded' };
  }

  res.json(status);
});

// ── GET /api/health/ai — estado del modelo LLM ───────────────────────────────
// Cubre el /api/ollama/health que antes faltaba
healthRouter.get('/ai', async (_req, res) => {
  try {
    const { llamaService } = await import('../services/llamaService.js');
    const info = llamaService.getInfo();
    res.json({ success: true, ready: llamaService.isReady(), engine: 'node-llama-cpp', ...info });
  } catch (err) {
    res.json({ success: false, ready: false, error: err.message });
  }
});

// ── GET /api/health/config — mantiene el existente ───────────────────────────
healthRouter.get('/config', (_req, res) => {
  res.json({
    EMAIL_USER:              process.env.EMAIL_USER || 'info@chickenpalace.es',
    EMAIL_APP_PASSWORD:      process.env.EMAIL_APP_PASSWORD      ? '***configured***' : 'NOT SET',
    ASSEMPSA_BILOOP_API_KEY: process.env.ASSEMPSA_BILOOP_API_KEY ? '***configured***' : 'NOT SET',
    REVO_TOKEN_CORTO:        process.env.REVO_TOKEN_CORTO        ? '***configured***' : 'NOT SET',
    REVO_TOKEN_LARGO:        process.env.REVO_TOKEN_LARGO        ? '***configured***' : 'NOT SET',
    ESEECLOUD_USERNAME:      process.env.ESEECLOUD_USERNAME       ? '***configured***' : 'NOT SET',
    AI_MODEL_NAME:           process.env.AI_MODEL_NAME           || '(default)',
    AI_GPU_MODE:             process.env.AI_GPU_MODE             || 'auto',
  });
});
