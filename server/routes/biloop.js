import { Router } from 'express';

export const biloopRouter = Router();

const BILOOP_BASE = 'https://assempsa.biloop.es/api-global/v1';
const COMPANY_ID = 'E95251';

let cachedToken = null;
let tokenExpiry = 0;

async function getToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }
  cachedToken = null;
  const cif = process.env.BILOOP_CIF || '';
  const url = `${BILOOP_BASE}/token${cif ? '?cif=' + cif : ''}`;
  console.log('[Biloop] Requesting token - CIF:', cif, 'URL:', url);
  const res = await fetch(url, {
    headers: {
      'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY,
      'USER': process.env.BILOOP_USER,
      'PASSWORD': process.env.BILOOP_PASSWORD
    }
  });
  const data = await res.json();
  if (data.status === 'KO') throw new Error(`Token error: ${data.message}`);
  cachedToken = data.data?.token || data.token || null;
  if (!cachedToken) throw new Error('No token in response');
  tokenExpiry = Date.now() + 7200000;
  return cachedToken;
}

async function biloopFetch(endpoint, addCompanyId = true) {
  const token = await getToken();
  let url = `${BILOOP_BASE}${endpoint}`;
  if (addCompanyId) {
    const sep = endpoint.includes('?') ? '&' : '?';
    url += `${sep}Company_id=${COMPANY_ID}`;
  }
  console.log('[Biloop] Fetching:', url);
  const res = await fetch(url, {
    headers: {
      'token': token,
      'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY
    }
  });
  if (!res.ok) throw new Error(`Biloop ${res.status}: ${res.statusText}`);
  return res.json();
}

// Debug endpoint - tests multiple approaches
biloopRouter.get('/token-debug', async (req, res) => {
  try {
    cachedToken = null;
    tokenExpiry = 0;
    const cif = process.env.BILOOP_CIF || '';
    const results = {};
    
    // Get token with CIF
    const r1 = await fetch(`${BILOOP_BASE}/token?cif=${cif}`, {
      headers: {
        'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY,
        'USER': process.env.BILOOP_USER,
        'PASSWORD': process.env.BILOOP_PASSWORD
      }
    });
    const tokenBody = await r1.json();
    const token = tokenBody.data?.token;
    results.tokenStatus = tokenBody.status;
    
    if (token) {
      const headers = { 'token': token, 'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY };
      
      // Test 1: getUser (no Company_id needed)
      try {
        const r = await fetch(`${BILOOP_BASE}/getUser`, { headers });
        results.getUser = await r.json();
      } catch(e) { results.getUser = e.message; }
      
      // Test 2: getCompanies (no Company_id)
      try {
        const r = await fetch(`${BILOOP_BASE}/getCompanies`, { headers });
        results.getCompanies = await r.json();
      } catch(e) { results.getCompanies = e.message; }
      
      // Test 3: getWorkers WITH Company_id
      try {
        const r = await fetch(`${BILOOP_BASE}/labor/getWorkers?Company_id=${COMPANY_ID}`, { headers });
        results.workersWithCompanyId = await r.json();
      } catch(e) { results.workersWithCompanyId = e.message; }
      
      // Test 4: getWorkers WITHOUT Company_id  
      try {
        const r = await fetch(`${BILOOP_BASE}/labor/getWorkers`, { headers });
        results.workersWithoutCompanyId = await r.json();
      } catch(e) { results.workersWithoutCompanyId = e.message; }
      
      // Test 5: getERPProviders with Company_id
      try {
        const r = await fetch(`${BILOOP_BASE}/erp/erpProvider/getERPProviders?Company_id=${COMPANY_ID}`, { headers });
        results.providersWithCompanyId = await r.json();
      } catch(e) { results.providersWithCompanyId = e.message; }
    }
    
    res.json({ cif, companyId: COMPANY_ID, results });
  } catch (err) {
    res.json({ error: err.message });
  }
});

biloopRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.BILOOP_USER) return res.json({ success: false, error: 'Credentials not configured' });
    const token = await getToken(true);
    res.json({ success: true, tokenOk: true, companyId: COMPANY_ID, cif: process.env.BILOOP_CIF });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

biloopRouter.get('/companies', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/getCompanies', false) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/invoices', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/accounting/getInvoices') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/providers', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/erp/erpProvider/getERPProviders') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/workers', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/labor/getWorkers') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/documents', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/documents/getDirectory') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/customers', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/billing/getERPCustomers') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/expenses-invoices', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/erp/expenses/invoices/getInvoices') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/income-invoices', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/erp/incomes/invoices/getInvoices') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/payslips', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/labor/getPayslips') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

biloopRouter.get('/statistics', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/statistics/result/getResults') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── GET /api/biloop/sync ──────────────────────────────────────────────────────
// FIX: syncBiloopData() en functionsService llamaba a este endpoint que faltaba
biloopRouter.get('/sync', async (req, res) => {
  const startTime = Date.now();
  const results   = {};

  const endpoints = [
    { key: 'facturas_emitidas',  path: '/erp/incomes/invoices/getInvoices' },
    { key: 'facturas_recibidas', path: '/erp/expenses/invoices/getInvoices' },
    { key: 'proveedores',        path: '/erp/expenses/providers/getProviders' },
  ];

  const settled = await Promise.allSettled(
    endpoints.map(({ path }) => biloopFetch(path))
  );

  endpoints.forEach(({ key }, i) => {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      const items = r.value?.data || r.value || [];
      results[key] = { count: Array.isArray(items) ? items.length : 0, success: true };
    } else {
      results[key] = { success: false, error: r.reason?.message };
    }
  });

  res.json({
    success:  true,
    duration: Date.now() - startTime,
    synced:   new Date().toISOString(),
    results,
  });
});

// ── GET /api/biloop/sync-status ───────────────────────────────────────────────
// FIX: getBiloopSyncStatus() llamaba a este endpoint que faltaba
biloopRouter.get('/sync-status', (req, res) => {
  res.json({
    success:   true,
    available: !!process.env.ASSEMPSA_BILOOP_API_KEY || !!process.env.BILOOP_CIF,
    last_sync: null,
  });
});
