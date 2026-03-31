import { Router } from 'express';

export const biloopRouter = Router();

const BILOOP_BASE = 'https://assempsa.biloop.es/api-global/v1';

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  const cif = process.env.BILOOP_CIF || '';
  const url = `${BILOOP_BASE}/token${cif ? '?cif=' + cif : ''}`;

  console.log('[Biloop] Requesting token with CIF:', cif, 'URL:', url);

  const res = await fetch(url, {
    headers: {
      'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY,
      'USER': process.env.BILOOP_USER,
      'PASSWORD': process.env.BILOOP_PASSWORD
    }
  });

  const data = await res.json();
  console.log('[Biloop] Token response status:', data.status);

  if (data.status === 'KO') {
    throw new Error(`Token error: ${data.message}`);
  }

  cachedToken = data.data?.token || data.token || null;
  if (!cachedToken) throw new Error('No token in response: ' + JSON.stringify(data));
  tokenExpiry = Date.now() + 7200000;
  console.log('[Biloop] Token obtained, length:', cachedToken.length);
  return cachedToken;
}

async function biloopFetch(endpoint) {
  const token = await getToken();
  const res = await fetch(`${BILOOP_BASE}${endpoint}`, {
    headers: {
      'token': token,
      'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY
    }
  });
  if (!res.ok) throw new Error(`Biloop ${res.status}: ${res.statusText}`);
  return res.json();
}

biloopRouter.get('/token-debug', async (req, res) => {
  try {
    // Test both with and without CIF
    const cif = process.env.BILOOP_CIF || '';
    const results = {};

    // With CIF
    const r1 = await fetch(`${BILOOP_BASE}/token?cif=${cif}`, {
      headers: {
        'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY,
        'USER': process.env.BILOOP_USER,
        'PASSWORD': process.env.BILOOP_PASSWORD
      }
    });
    results.withCif = { status: r1.status, body: await r1.json() };

    // Without CIF
    const r2 = await fetch(`${BILOOP_BASE}/token`, {
      headers: {
        'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY,
        'USER': process.env.BILOOP_USER,
        'PASSWORD': process.env.BILOOP_PASSWORD
      }
    });
    results.withoutCif = { status: r2.status, body: await r2.json() };

    res.json({ cif, results });
  } catch (err) {
    res.json({ error: err.message });
  }
});

biloopRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.BILOOP_USER) {
      return res.json({ success: false, error: 'Credentials not configured' });
    }
    const token = await getToken();
    let companiesData;
    try {
      companiesData = await biloopFetch('/getCompanies');
    } catch (e) {
      companiesData = { error: e.message };
    }
    res.json({ success: true, tokenOk: true, data: companiesData });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

biloopRouter.get('/companies', async (req, res) => {
  try { res.json({ success: true, data: await biloopFetch('/getCompanies') }); }
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
