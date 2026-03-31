import { Router } from 'express';

export const biloopRouter = Router();

const BILOOP_BASE = 'https://assempsa.biloop.es/api-global/v1';

const biloopFetch = async (endpoint) => {
  const res = await fetch(`${BILOOP_BASE}${endpoint}`, {
    headers: { 'Ocp-Apim-Subscription-Key': process.env.ASSEMPSA_BILOOP_API_KEY }
  });
  if (!res.ok) throw new Error(`Biloop ${res.status}: ${res.statusText}`);
  return res.json();
};

biloopRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.ASSEMPSA_BILOOP_API_KEY) {
      return res.json({ success: false, error: 'ASSEMPSA_BILOOP_API_KEY not configured' });
    }
    const data = await biloopFetch('/getCompanies');
    res.json({ success: true, message: 'Biloop connected', data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

biloopRouter.get('/invoices', async (req, res) => {
  try {
    const data = await biloopFetch('/getExpensesInvoices');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/providers', async (req, res) => {
  try {
    const data = await biloopFetch('/getERPProviders');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/workers', async (req, res) => {
  try {
    const data = await biloopFetch('/getWorkers');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/documents', async (req, res) => {
  try {
    const data = await biloopFetch('/getDocuments');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

biloopRouter.get('/statistics', async (req, res) => {
  try {
    const data = await biloopFetch('/getStatistics');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
