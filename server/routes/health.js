/**
 * health.js — EXTENDED v2
 * Rutas originales: /  /ping  /ai  /config
 * Nueva: /full — estado completo de TODOS los servicios del Mac Mini
 */

import { Router } from 'express';
import os from 'os';

export const healthRouter = Router();

// ─── Helpers para /full ──────────────────────────────────────────────────────

async function timedFetch(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    return { ok: false, status: null, json: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function checkOllama() {
  const result = await timedFetch('http://localhost:11434/api/tags');
  if (result.ok && result.json?.models) {
    return { status: 'online', models: result.json.models.map(m => m.name), port: 11434 };
  }
  return { status: 'offline', error: result.error ?? `HTTP ${result.status}`, port: 11434 };
}

async function checkService(port) {
  const result = await timedFetch(`http://localhost:${port}`);
  return result.ok || result.status !== null
    ? { status: 'online', port }
    : { status: 'offline', error: result.error ?? `HTTP ${result.status}`, port };
}

async function checkQdrant() {
  const result = await timedFetch('http://localhost:6333/collections');
  if ((result.ok || result.status !== null) && result.json?.result?.collections) {
    return { status: 'online', collections: result.json.result.collections.length, port: 6333 };
  }
  if (result.ok || result.status !== null) return { status: 'online', collections: null, port: 6333 };
  return { status: 'offline', error: result.error ?? `HTTP ${result.status}`, port: 6333 };
}

async function checkTunnel(req) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? '';
  if (host.includes('sinkialabs.com')) return { status: 'online', note: 'via tunnel' };
  const result = await timedFetch('https://sinkialabs.com');
  return result.ok || result.status !== null
    ? { status: 'online' }
    : { status: 'offline', error: result.error ?? `HTTP ${result.status}` };
}

// ── GET /api/health/ping — ultra-rápido para uptime monitors ─────────────────
healthRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ── GET /api/health — estado básico del sistema ──────────────────────────────
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

// ── GET /api/health/full — estado de TODOS los servicios del Mac Mini ────────
healthRouter.get('/full', async (req, res) => {
  const [ollama, open_webui, openclaw, searxng, n8n, qdrant, cloudflare_tunnel] =
    await Promise.all([
      checkOllama(),
      checkService(3030),
      checkService(18789),
      checkService(8888),
      checkService(5678),
      checkQdrant(),
      checkTunnel(req),
    ]);

  const sinkia_api = { status: 'online', port: 3001 };

  const services = { ollama, open_webui, openclaw, searxng, n8n, qdrant, sinkia_api, cloudflare_tunnel };
  const list = Object.values(services);
  const online = list.filter(s => s.status === 'online').length;

  const totalMem = os.totalmem();
  const freeMem  = os.freemem();

  res.json({
    timestamp:    new Date().toISOString(),
    hostname:     os.hostname(),
    uptime_hours: Math.round(os.uptime() / 3600),
    memory: {
      total_gb:     parseFloat((totalMem / 1024 ** 3).toFixed(1)),
      free_gb:      parseFloat((freeMem  / 1024 ** 3).toFixed(1)),
      used_percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    services,
    summary: { total: list.length, online, offline: list.length - online },
  });
});

// ── GET /api/health/ai — estado del modelo LLM ──────────────────────────────
healthRouter.get('/ai', async (_req, res) => {
  try {
    const { llamaService } = await import('../services/llamaService.js');
    const info = llamaService.getInfo();
    res.json({ success: true, ready: llamaService.isReady(), engine: 'node-llama-cpp', ...info });
  } catch (err) {
    res.json({ success: false, ready: false, error: err.message });
  }
});

// ── GET /api/health/config — estado de variables de entorno ──────────────────
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
