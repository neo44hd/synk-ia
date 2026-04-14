import { Router } from 'express';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export const revoRouter = Router();

// ── Webhook storage ──────────────────────────────────────────────────────────
const WEBHOOK_DIR = join(process.cwd(), 'data', 'revo-webhooks');
if (!existsSync(WEBHOOK_DIR)) mkdirSync(WEBHOOK_DIR, { recursive: true });

const WEBHOOK_LOG = join(WEBHOOK_DIR, 'events.json');
const loadEvents = () => {
  try { return existsSync(WEBHOOK_LOG) ? JSON.parse(readFileSync(WEBHOOK_LOG, 'utf8')) : []; }
  catch { return []; }
};
const saveEvent = (event) => {
  const events = loadEvents();
  events.unshift(event);            // newest first
  if (events.length > 500) events.length = 500;   // keep last 500
  writeFileSync(WEBHOOK_LOG, JSON.stringify(events, null, 2));
};

const REVO_CATALOG = 'https://api.revoxef.works/catalog/v1';
const REVO_REPORTS = 'https://revoxef.works/api/external/v3';

const revoFetch = async (endpoint, { base = 'catalog', method = 'GET' } = {}) => {
  const baseUrl = base === 'catalog' ? REVO_CATALOG : REVO_REPORTS;
  const headers = {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${baseUrl}${endpoint}`, { method, headers });
  if (!res.ok) throw new Error(`Revo ${res.status}: ${res.statusText}`);
  return res.json();
};

revoRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.REVO_TOKEN_LARGO) {
      return res.json({ success: false, error: 'REVO_TOKEN_LARGO not configured' });
    }
    const data = await revoFetch('/items?pagination=1');
    res.json({ success: true, message: 'Revo connected', data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

revoRouter.get('/products', async (req, res) => {
  try {
    const data = await revoFetch('/items');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

revoRouter.get('/sales', async (req, res) => {
  try {
    const { since, until } = req.query;
    let endpoint = '/orders';
    if (since) endpoint += `?since=${since}`;
    if (until) endpoint += `${since ? '&' : '?'}until=${until}`;
    const data = await revoFetch(endpoint);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

revoRouter.get('/categories', async (req, res) => {
  try {
    const data = await revoFetch('/categories');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/workers ────────────────────────────────────────────────────
// FIX: syncRevoWorkers() en functionsService llamaba a este endpoint que faltaba
revoRouter.get('/workers', async (req, res) => {
  try {
    // Revo XEF Reports API v3: empleados
    let data = [];
    try {
      const result = await revoFetch('/employees', { base: 'reports' });
      data = result?.data || result || [];
    } catch (e1) {
      console.warn(`[Revo] /employees: ${e1.message}`);
    }
    res.json({ success: true, workers: data, count: data.length });
  } catch (err) {
    res.json({ success: false, workers: [], error: err.message });
  }
});

// ── POST /api/revo/webhook ───────────────────────────────────────────────────
// Recibe eventos push de Revo XEF (products, orders, customers, stocks, turns…)
revoRouter.post('/webhook', (req, res) => {
  try {
    const payload = req.body;
    const event = {
      id: crypto.randomUUID(),
      received_at: new Date().toISOString(),
      event: payload.event || payload.type || 'unknown',
      data: payload
    };
    console.log(`[Revo Webhook] ${event.event}`, JSON.stringify(payload).slice(0, 200));
    saveEvent(event);
    res.status(200).json({ success: true, message: 'Event received', id: event.id });
  } catch (err) {
    console.error('[Revo Webhook] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/webhook/events ────────────────────────────────────────────
// Consultar los últimos eventos recibidos (para Mission Control)
revoRouter.get('/webhook/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const events = loadEvents().slice(0, limit);
  res.json({ success: true, events, count: events.length });
});

// ── POST /api/revo/sync ─────────────────────────────────────────────────────
// Trigger manual sync desde Mission Control
revoRouter.post('/sync', async (req, res) => {
  try {
    if (!process.env.REVO_TOKEN_LARGO) {
      return res.json({ success: false, error: 'REVO_TOKEN_LARGO not configured' });
    }
    const [products, categories, orders] = await Promise.allSettled([
      revoFetch('/items'),
      revoFetch('/categories'),
      revoFetch('/orders', { base: 'reports' })
    ]);
    res.json({
      success: true,
      message: 'Sync completed',
      results: {
        products: products.status === 'fulfilled' ? { count: (products.value?.data || products.value || []).length } : { error: products.reason?.message },
        categories: categories.status === 'fulfilled' ? { count: (categories.value?.data || categories.value || []).length } : { error: categories.reason?.message },
        orders: orders.status === 'fulfilled' ? { count: (orders.value?.data || orders.value || []).length } : { error: orders.reason?.message }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/sync-status ─────────────────────────────────────────────────
revoRouter.get('/sync-status', (req, res) => {
  const events = loadEvents();
  const lastEvent = events.length > 0 ? events[0] : null;
  res.json({
    success: true,
    configured: !!process.env.REVO_TOKEN_LARGO,
    webhook_active: events.length > 0,
    last_event: lastEvent ? { event: lastEvent.event, received_at: lastEvent.received_at } : null,
    total_events: events.length
  });
});
