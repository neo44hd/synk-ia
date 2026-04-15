import { Router } from 'express';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { syncRevo } from '../agents/revoAgent.js';

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
  events.unshift(event);
  if (events.length > 500) events.length = 500;
  writeFileSync(WEBHOOK_LOG, JSON.stringify(events, null, 2));
};

// ── API Base URLs ────────────────────────────────────────────────────────────
const REVO_CATALOG = 'https://api.revoxef.works/catalog/v1';
const REVO_CLASSIC = 'https://revoxef.works/api/external/v2';
const REVO_REPORTS = 'https://revoxef.works/api/external/v3';
const REVO_TENANT  = process.env.REVO_TENANT || 'chickenpalaceibiza2';

const catalogFetch = async (endpoint) => {
  const res = await fetch(`${REVO_CATALOG}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
      'Accept': 'application/json',
    }
  });
  if (!res.ok) throw new Error(`Revo Catalog ${res.status}: ${res.statusText}`);
  return res.json();
};

const classicFetch = async (endpoint) => {
  const headers = {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Accept': 'application/json',
    'tenant': REVO_TENANT,
  };
  if (process.env.REVO_CLIENT_TOKEN) {
    headers['client-token'] = process.env.REVO_CLIENT_TOKEN;
  }
  const res = await fetch(`${REVO_CLASSIC}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`Revo Classic ${res.status}: ${res.statusText}`);
  return res.json();
};

const reportsFetch = async (endpoint) => {
  const headers = {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Accept': 'application/json',
    'tenant': REVO_TENANT,
  };
  if (process.env.REVO_CLIENT_TOKEN) {
    headers['client-token'] = process.env.REVO_CLIENT_TOKEN;
  }
  const res = await fetch(`${REVO_REPORTS}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`Revo Reports ${res.status}: ${res.statusText}`);
  return res.json();
};

// ── GET /api/revo/test ──────────────────────────────────────────────────────
revoRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.REVO_TOKEN_LARGO) {
      return res.json({ success: false, error: 'REVO_TOKEN_LARGO not configured' });
    }
    const data = await catalogFetch('/items?pagination=1');
    res.json({ success: true, message: 'Revo connected', data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/products ──────────────────────────────────────────────────
revoRouter.get('/products', async (req, res) => {
  try {
    const data = await catalogFetch('/items');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/categories ────────────────────────────────────────────────
revoRouter.get('/categories', async (req, res) => {
  try {
    const data = await catalogFetch('/categories');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/sales ─────────────────────────────────────────────────────
revoRouter.get('/sales', async (req, res) => {
  try {
    if (!process.env.REVO_CLIENT_TOKEN) {
      return res.json({ 
        success: false, 
        error: 'REVO_CLIENT_TOKEN not configured — need integrator token from Revo',
        hint: 'Request at https://community.revo.works/integration'
      });
    }
    const { start_date, end_date } = req.query;
    let endpoint = '/reports/orders';
    const params = [];
    if (start_date) params.push(`start_date=${start_date}`);
    if (end_date) params.push(`end_date=${end_date}`);
    if (params.length) endpoint += `?${params.join('&')}`;
    const data = await reportsFetch(endpoint);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/workers ───────────────────────────────────────────────────
revoRouter.get('/workers', async (req, res) => {
  try {
    if (!process.env.REVO_CLIENT_TOKEN) {
      return res.json({ 
        success: false, 
        workers: [],
        error: 'REVO_CLIENT_TOKEN not configured — need integrator token from Revo'
      });
    }
    const result = await reportsFetch('/reports/tenantUsers');
    const data = result?.data || result || [];
    res.json({ success: true, workers: data, count: data.length });
  } catch (err) {
    res.json({ success: false, workers: [], error: err.message });
  }
});

// ── GET /api/revo/payments ──────────────────────────────────────────────────
revoRouter.get('/payments', async (req, res) => {
  try {
    if (!process.env.REVO_CLIENT_TOKEN) {
      return res.json({ 
        success: false, 
        error: 'REVO_CLIENT_TOKEN not configured — need integrator token from Revo'
      });
    }
    const { start_date, end_date } = req.query;
    let endpoint = '/reports/payments';
    const params = [];
    if (start_date) params.push(`start_date=${start_date}`);
    if (end_date) params.push(`end_date=${end_date}`);
    if (params.length) endpoint += `?${params.join('&')}`;
    const data = await reportsFetch(endpoint);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/revo/webhook ──────────────────────────────────────────────────
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
revoRouter.get('/webhook/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const events = loadEvents().slice(0, limit);
  res.json({ success: true, events, count: events.length });
});

// ── POST /api/revo/sync ─────────────────────────────────────────────────────
// Delega al revoAgent.js que maneja toda la lógica de sync
revoRouter.post('/sync', async (req, res) => {
  try {
    if (!process.env.REVO_TOKEN_LARGO) {
      return res.json({ success: false, error: 'REVO_TOKEN_LARGO not configured' });
    }
    const results = await syncRevo();
    res.json({
      success: results.success,
      message: results.success ? 'Sync completed' : 'Sync failed',
      catalogOk: results.catalogOk,
      reportsOk: results.reportsOk,
      needsClientToken: results.needsClientToken,
      results: {
        productos: results.productos,
        categorias: results.categorias,
        ventas: results.ventas,
        pagos: results.pagos,
        empleados: results.empleados,
        cajas: results.cajas,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/sync-status ───────────────────────────────────────────────
revoRouter.get('/sync-status', (req, res) => {
  const events = loadEvents();
  const lastEvent = events.length > 0 ? events[0] : null;
  res.json({
    success: true,
    configured: !!process.env.REVO_TOKEN_LARGO,
    hasClientToken: !!process.env.REVO_CLIENT_TOKEN,
    webhook_active: events.length > 0,
    last_event: lastEvent ? { event: lastEvent.event, received_at: lastEvent.received_at } : null,
    total_events: events.length
  });
});
