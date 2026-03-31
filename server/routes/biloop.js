import { Router } from 'express';

export const biloopRouter = Router();

const BILOOP_BASE = 'https://assempsa.biloop.es/api-global/v1';

// Token cache (2h duration)
let cachedToken = null;
let tokenExpiry = 0;

async function getToken(useCif = false) {
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  let url = `${BILOOP_BASE}/token`;
  if (useCif && process.env.BILOOP_CIF) {
    url += `?cif=${process.env.BILOOP_CIF}`;
  }

  const res = await fetch(url, {
    headers: {
      'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY,
      'USER': process.env.BILOOP_USER,
      'PASSWORD': process.env.BILOOP_PASSWORD
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.status === 'KO') {
    throw new Error(`Token error: ${data.message}`);
  }

  cachedToken = data.token || data.data?.token || data;
  tokenExpiry = Date.now() + 7200000;
  console.log('[Biloop] Token obtained successfully');
  return cachedToken;
}

async function biloopFetch(endpoint, params = {}) {
  const token = await getToken();
  const tokenStr = typeof token === 'string' ? token : JSON.stringify(token);
  
  let url = `${BILOOP_BASE}${endpoint}`;
  const queryParams = new URLSearchParams(params).toString();
  if (queryParams) url += `?${queryParams}`;

  const res = await fetch(url, {
    headers: {
      'token': tokenStr,
      'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY
    }
  });
  if (!res.ok) throw new Error(`Biloop ${res.status}: ${res.statusText}`);
  return res.json();
}

// Test - try getCompanies, fallback to token info
biloopRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.BILOOP_USER || !process.env.BILOOP_PASSWORD) {
      return res.json({ success: false, error: 'Credentials not configured' });
    }
    const token = await getToken();
    // Try companies first
    let data;
    try {
      data = await biloopFetch('/getCompanies');
    } catch (e) {
      data = { note: 'getCompanies failed, but token works', error: e.message };
    }
    res.json({ success: true, message: 'Biloop connected', tokenObtained: true, tokenType: typeof token, data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Raw token debug
biloopRouter.get('/token-debug', async (req, res) => {
  try {
    const url = `${BILOOP_BASE}/token`;
    const response = await fetch(url, {
      headers: {
        'SUBSCRIPTION_KEY': process.env.ASSEMPSA_BILOOP_API_KEY,
        'USER': process.env.BILOOP_USER,
        'PASSWORD': process.env.BILOOP_PASSWORD
      }
    });
    const text = await response.text();
    res.json({ status: response.status, raw: text });
  } catch (err) {
    res.json({ error: err.message });
  }
});

biloopRouter.get('/companies', async (req, res) => {
  try {
    const data = await biloopFetch('/getCompanies');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/invoices', async (req, res) => {
  try {
    const data = await biloopFetch('/accounting/getInvoices');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/providers', async (req, res) => {
  try {
    const data = await biloopFetch('/erp/erpProvider/getERPProviders');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/workers', async (req, res) => {
  try {
    const data = await biloopFetch('/labor/getWorkers');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/documents', async (req, res) => {
  try {
    const data = await biloopFetch('/documents/getDirectory');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/customers', async (req, res) => {
  try {
    const data = await biloopFetch('/billing/getERPCustomers');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/expenses-invoices', async (req, res) => {
  try {
    const data = await biloopFetch('/erp/expenses/invoices/getInvoices');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/income-invoices', async (req, res) => {
  try {
    const data = await biloopFetch('/erp/incomes/invoices/getInvoices');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/payslips', async (req, res) => {
  try {
    const data = await biloopFetch('/labor/getPayslips');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/statistics', async (req, res) => {
  try {
    const data = await biloopFetch('/statistics/result/getResults');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
