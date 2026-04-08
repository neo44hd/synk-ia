import { Router } from 'express';

export const revoRouter = Router();

const revoFetch = async (endpoint, method = 'GET') => {
  const headers = {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Content-Type': 'application/json'
  };
  if (process.env.REVO_TOKEN_CORTO) headers['X-API-Key'] = process.env.REVO_TOKEN_CORTO;
  const res = await fetch(`https://integrations.revoxef.works/api/v1${endpoint}`, { method, headers });
  if (!res.ok) throw new Error(`Revo ${res.status}: ${res.statusText}`);
  return res.json();
};

revoRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.REVO_TOKEN_LARGO) {
      return res.json({ success: false, error: 'REVO_TOKEN_LARGO not configured' });
    }
    const data = await revoFetch('/catalog/products?per_page=1');
    res.json({ success: true, message: 'Revo connected', data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

revoRouter.get('/products', async (req, res) => {
  try {
    const data = await revoFetch('/catalog/products');
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
    const data = await revoFetch('/catalog/categories');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/revo/workers ────────────────────────────────────────────────────
// FIX: syncRevoWorkers() en functionsService llamaba a este endpoint que faltaba
revoRouter.get('/workers', async (req, res) => {
  try {
    // Revo XEF expone empleados/cajeros en /staff o /users según el plan
    let data = [];
    try {
      const result = await revoFetch('/staff');
      data = result?.data || result || [];
    } catch {
      // Si /staff no existe en el plan, devuelve vacío (no bloquea el sync)
      console.warn('[Revo] /staff no disponible en este plan');
    }
    res.json({ success: true, workers: data, count: data.length });
  } catch (err) {
    res.json({ success: false, workers: [], error: err.message });
  }
});

// ── GET /api/revo/sync-status ─────────────────────────────────────────────────
revoRouter.get('/sync-status', (req, res) => {
  res.json({ success: true, configured: !!process.env.REVO_TOKEN_LARGO });
});
