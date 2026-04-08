import { Router } from 'express';
import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

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

// ── POST /api/biloop/process-zip ─────────────────────────────────────────────
// Descarga un ZIP o PDF desde file_url (subido previamente via /api/files/upload),
// extrae facturas con pdf-parse y las guarda como registros Invoice + Provider.
// Respuesta: { success, results: { invoices_created, providers_created, errors[] } }
biloopRouter.post('/process-zip', async (req, res) => {
  try {
    const { file_url } = req.body;
    if (!file_url) return res.status(400).json({ success: false, error: 'file_url requerido' });

    const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    const DATA_DIR    = process.env.DATA_DIR    || path.join(process.cwd(), 'data');

    // Extraer nombre de archivo desde la URL  (/api/files/serve/xxx.pdf o URL completa)
    const urlPath  = new URL(file_url, 'http://localhost').pathname;
    const filename = path.basename(urlPath);
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `Archivo no encontrado: ${filename}` });
    }

    const results = { invoices_created: 0, providers_created: 0, errors: [] };

    // ── Helpers de datos (replica el patrón de data.js) ────────────────────────
    const readEntity  = (entity) => {
      const f = path.join(DATA_DIR, `${entity.toLowerCase()}.json`);
      if (!existsSync(f)) return [];
      try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return []; }
    };
    const writeEntity = (entity, data) => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(path.join(DATA_DIR, `${entity.toLowerCase()}.json`), JSON.stringify(data, null, 2), 'utf8');
    };
    const genId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // ── Extraer campos clave de texto PDF con regex ──────────────────────────
    function extractInvoiceData(text, pdfFilename) {
      const t = text || '';
      const inv = { filename: pdfFilename, proveedor: null, numero_factura: null, fecha: null, total: null };

      const numM  = t.match(/(?:factura|invoice|fra\.?|n[uú]m(?:ero)?)[.\s:#]*([A-Z0-9\/\-]{3,20})/i);
      if (numM) inv.numero_factura = numM[1].trim();

      const totM  = t.match(/(?:total\s+(?:factura|a\s+pagar|iva\s+inc\w*|general)|importe\s+total)[:\s€]*([0-9.,]+)/i);
      if (totM)  inv.total = parseFloat(totM[1].replace(/\./g, '').replace(',', '.')) || null;

      const dateM = t.match(/(?:fecha)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
      if (dateM) inv.fecha = dateM[1];

      // Proveedor: intenta cabecera del PDF o nombre de fichero como fallback
      const provM = t.match(/^([A-ZÁÉÍÓÚÑA-Z ,\.&]{5,60})\s*(?:\n|\r)/m);
      inv.proveedor = (provM ? provM[1].trim() : null)
                    || pdfFilename.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ').substring(0, 60);
      return inv;
    }

    // ── Procesar un buffer PDF ───────────────────────────────────────────────
    async function processPdfBuffer(buffer, pdfFilename) {
      let pdfParse;
      try { pdfParse = (await import('pdf-parse')).default; } catch { pdfParse = null; }

      let text = '';
      if (pdfParse) {
        try { text = (await pdfParse(buffer)).text || ''; }
        catch (e) { results.errors.push(`parse error ${pdfFilename}: ${e.message}`); }
      }

      const inv      = extractInvoiceData(text, pdfFilename);
      const providers = readEntity('provider');
      let provider   = providers.find(p =>
        p.nombre?.toLowerCase() === inv.proveedor?.toLowerCase()
      );
      if (!provider) {
        provider = {
          id: genId(), nombre: inv.proveedor || 'Desconocido',
          email: '', created_date: new Date().toISOString()
        };
        providers.push(provider);
        writeEntity('provider', providers);
        results.providers_created++;
      }

      const invoices = readEntity('invoice');
      invoices.push({
        id:              genId(),
        numero_factura:  inv.numero_factura || pdfFilename,
        proveedor:       inv.proveedor,
        provider_id:     provider.id,
        fecha:           inv.fecha,
        total:           inv.total,
        estado:          'pendiente',
        origen:          'zip_upload',
        filename:        pdfFilename,
        text_preview:    text.substring(0, 500),
        created_date:    new Date().toISOString(),
      });
      writeEntity('invoice', invoices);
      results.invoices_created++;
    }

    const ext = path.extname(filename).toLowerCase();

    if (ext === '.zip') {
      // Extraer cada PDF del ZIP y procesarlo
      const { default: AdmZip } = await import('adm-zip');
      const zip     = new AdmZip(filePath);
      const entries = zip.getEntries().filter(e =>
        !e.isDirectory && e.name.toLowerCase().endsWith('.pdf')
      );
      if (entries.length === 0) {
        return res.status(422).json({ success: false, error: 'El ZIP no contiene archivos PDF' });
      }
      for (const entry of entries) {
        try { await processPdfBuffer(entry.getData(), entry.name); }
        catch (e) { results.errors.push(`Error en ${entry.name}: ${e.message}`); }
      }
    } else {
      // PDF individual
      await processPdfBuffer(readFileSync(filePath), filename);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('[process-zip]', err);
    res.status(500).json({ success: false, error: err.message });
  }
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
