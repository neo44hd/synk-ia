import { Router } from 'express';

export const biloopPortalRouter = Router();

const BILOOP_URL = 'https://assempsa.biloop.es';
let sessionCookies = null;
let sessionExpiry = 0;
let lastSyncData = null;

// === LOGIN ===
async function getSession() {
  if (sessionCookies && Date.now() < sessionExpiry) return sessionCookies;
  const user = process.env.BILOOP_USER || '';
  const pass = process.env.BILOOP_PASSWORD || '';
  console.log('[Portal] Login as:', user);
  const r1 = await fetch(`${BILOOP_URL}/`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } });
  let cookies = (r1.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const payloads = [
    { user, password: pass, captcha: '' },
    { user, password: pass }
  ];
  for (const payload of payloads) {
    for (const ct of ['application/x-www-form-urlencoded', 'application/json']) {
      try {
        const body = ct.includes('json') ? JSON.stringify(payload) : new URLSearchParams(payload).toString();
        const r2 = await fetch(`${BILOOP_URL}/login`, {
          method: 'POST', body, redirect: 'manual',
          headers: { 'Content-Type': ct, 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${BILOOP_URL}/`, 'Origin': BILOOP_URL }
        });
        const nc = r2.headers.getSetCookie?.() || [];
        if (nc.length > 0) {
          const all = [...cookies.split('; ').filter(c => c), ...nc.map(c => c.split(';')[0])];
          cookies = all.filter((v, i, a) => a.findIndex(x => x.split('=')[0] === v.split('=')[0]) === i).join('; ');
        }
        const loc = r2.headers.get('location');
        if (r2.status === 302 && loc && !loc.includes('login')) {
          sessionCookies = cookies;
          sessionExpiry = Date.now() + 3600000;
          return cookies;
        }
        const txt = await r2.text();
        try {
          const j = JSON.parse(txt);
          if (j.status === 'OK' || j.success || j.redirect) {
            sessionCookies = cookies;
            sessionExpiry = Date.now() + 3600000;
            return cookies;
          }
        } catch(e) {}
      } catch(e) {}
    }
  }
  throw new Error('Login failed');
}

async function portalFetch(path, opts = {}) {
  const cookies = await getSession();
  const url = path.startsWith('http') ? path : `${BILOOP_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/html, */*', ...opts.headers }
  });
  return res;
}

async function portalJSON(path) {
  const res = await portalFetch(path);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch(e) { return null; }
}

async function portalJSONPost(path, data) {
  const res = await portalFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString()
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch(e) { return null; }
}

async function portalHTML(path) {
  const res = await portalFetch(path);
  return res.text();
}

function parseTable(html) {
  const rows = [];
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return [];
  const t = tableMatch[1];
  const headers = [];
  let m;
  const thRe = /<th[^>]*>([\s\S]*?)<\/th>/g;
  while ((m = thRe.exec(t))) headers.push(m[1].replace(/<[^>]+>/g, '').trim());
  const tbodyMatch = t.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  while ((m = trRe.exec(tbodyMatch[1]))) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let td;
    while ((td = tdRe.exec(m[1]))) cells.push(td[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length && headers.length) {
      const row = {};
      headers.forEach((h, i) => row[h] = cells[i] || '');
      rows.push(row);
    }
  }
  return rows;
}

// === SYNC ENDPOINT: extracts ALL data from Biloop ===
biloopPortalRouter.get('/sync', async (req, res) => {
  try {
    const t0 = Date.now();
    const results = { customers: [], invoicesIssued: [], invoicesReceived: [], forms: [], payslips: [], providers: [] };
    const errors = [];

    // 1. CUSTOMERS - use AJAX endpoint
    try {
      const data = await portalJSON('/erp/masters/customers/getAjaxCustomers');
      results.customers = data?.data || [];
      console.log(`[Sync] Customers: ${results.customers.length}`);
    } catch(e) { errors.push({ section: 'customers', error: e.message }); }

    // 2. FORMS (modelos fiscales) - use AJAX endpoint
    try {
      const data = await portalJSON('/bi/documents/forms/getForms');
      results.forms = data?.forms || data?.data || (Array.isArray(data) ? data : []);
      console.log(`[Sync] Forms: ${results.forms.length}`);
    } catch(e) { errors.push({ section: 'forms', error: e.message }); }

    // 3. INVOICES RECEIVED - use directory/list POST
    try {
      const data = await portalJSONPost('/bi/documents/directory/list', {
        'subsection': '',
        'params[year]': '',
        'params[text]': ''
      });
      results.invoicesReceived = data?.documents || [];
      console.log(`[Sync] Invoices Received: ${results.invoicesReceived.length}`);
    } catch(e) { errors.push({ section: 'invoicesReceived', error: e.message }); }

    // 4. INVOICES ISSUED - DataTables GET with standard params
    try {
      const params = new URLSearchParams({
        draw: '1', start: '0', length: '500',
        'order[0][column]': '0', 'order[0][dir]': 'desc',
        'columns[0][data]': 'date', 'columns[0][name]': 'date',
        'search[value]': '', 'search[regex]': 'false'
      });
      const r = await portalFetch(`/erp/documents/getAjaxDocuments?${params}`);
      const txt = await r.text();
      try {
        const j = JSON.parse(txt);
        results.invoicesIssued = j.data || j.aaData || [];
      } catch(e) {}
      console.log(`[Sync] Invoices Issued: ${results.invoicesIssued.length}`);
    } catch(e) { errors.push({ section: 'invoicesIssued', error: e.message }); }

    // 5. PAYSLIPS - parse server-rendered HTML table (no filters)
    try {
      const html = await portalHTML('/bi/labor/payslips');
      results.payslips = parseTable(html);
      console.log(`[Sync] Payslips: ${results.payslips.length}`);
    } catch(e) { errors.push({ section: 'payslips', error: e.message }); }

    const elapsed = Date.now() - t0;
    const summary = {
      customers: results.customers.length,
      invoicesIssued: results.invoicesIssued.length,
      invoicesReceived: results.invoicesReceived.length,
      forms: results.forms.length,
      payslips: results.payslips.length
    };
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    lastSyncData = { timestamp: new Date().toISOString(), summary, results, errors, elapsed };
    console.log(`[Sync] DONE in ${elapsed}ms - Total: ${total} records`, summary);
    res.json({ success: true, timestamp: lastSyncData.timestamp, elapsed, summary, total, errors, data: results });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get last sync data without re-fetching
biloopPortalRouter.get('/sync-status', async (req, res) => {
  if (lastSyncData) {
    res.json({ success: true, ...lastSyncData });
  } else {
    res.json({ success: false, message: 'No sync data yet. Call /api/biloop/sync first.' });
  }
});

// === DEBUG ENDPOINTS ===
biloopPortalRouter.get('/portal-test', async (req, res) => {
  try {
    sessionCookies = null; sessionExpiry = 0;
    const cookies = await getSession();
    res.json({ success: true, initCookies: cookies?.substring(0, 100), loginResult: { success: true } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

biloopPortalRouter.get('/portal-fetch', async (req, res) => {
  try {
    const path = req.query.path || '/';
    const r = await portalFetch(path);
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    if (ct.includes('json')) { try { return res.json({ success: true, path, data: JSON.parse(text) }); } catch(e) {} }
    res.json({ success: true, path, contentType: ct, length: text.length, body: text.substring(0, 5000) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-search', async (req, res) => {
  try {
    const path = req.query.path || '/'; const search = req.query.q || '';
    const html = await portalHTML(path);
    const results = []; let idx = 0;
    while ((idx = html.indexOf(search, idx)) !== -1 && results.length < 10) {
      const start = Math.max(0, idx - 200); const end = Math.min(html.length, idx + search.length + 200);
      results.push({ pos: idx, context: html.substring(start, end) }); idx += search.length;
    }
    res.json({ success: true, path, search, found: results.length, results: results.slice(0, 5) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-datatable', async (req, res) => {
  try {
    const path = req.query.path || '/'; const html = await portalHTML(path);
    const ajaxUrls = [...html.matchAll(/ajax\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    res.json({ success: true, path, ajaxUrls });
  } catch (err) { res.json({ success: false, error: err.message }); }
});
