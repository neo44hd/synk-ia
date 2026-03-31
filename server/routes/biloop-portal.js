import { Router } from 'express';

export const biloopPortalRouter = Router();

const BILOOP_URL = 'https://assempsa.biloop.es';
let sessionCookies = null;
let sessionExpiry = 0;
let lastSyncData = null;

function jqueryParam(obj, prefix) {
  const parts = [];
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      parts.push(jqueryParam(val, fullKey));
    } else if (Array.isArray(val)) {
      val.forEach(v => parts.push(`${encodeURIComponent(fullKey + '[]')}=${encodeURIComponent(v)}`));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(val ?? '')}`);
    }
  }
  return parts.join('&');
}

async function getSession() {
  if (sessionCookies && Date.now() < sessionExpiry) return sessionCookies;
  const user = process.env.BILOOP_USER || '';
  const pass = process.env.BILOOP_PASSWORD || '';
  console.log('[Portal] Login as:', user);
  const r1 = await fetch(`${BILOOP_URL}/`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
  let cookies = (r1.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  for (const payload of [{ user, password: pass, captcha: '' }, { user, password: pass }]) {
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
        if (r2.status === 302 && loc && !loc.includes('login')) { sessionCookies = cookies; sessionExpiry = Date.now() + 3600000; return cookies; }
        const txt = await r2.text();
        try { const j = JSON.parse(txt); if (j.status === 'OK' || j.success || j.redirect) { sessionCookies = cookies; sessionExpiry = Date.now() + 3600000; return cookies; } } catch(e) {}
      } catch(e) {}
    }
  }
  throw new Error('Login failed');
}

async function portalFetch(path, opts = {}) {
  const cookies = await getSession();
  const url = path.startsWith('http') ? path : `${BILOOP_URL}${path}`;
  return fetch(url, { ...opts, headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/html, */*', ...opts.headers } });
}

async function portalJSON(path) {
  const r = await portalFetch(path); const t = await r.text();
  try { return JSON.parse(t); } catch(e) { return null; }
}

async function portalPost(path, data) {
  const r = await portalFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: jqueryParam(data) });
  const t = await r.text();
  try { return JSON.parse(t); } catch(e) { return { _raw: t.substring(0, 500) }; }
}

async function portalHTML(path) { const r = await portalFetch(path); return r.text(); }

function parseTable(html) {
  const rows = [];
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return [];
  const t = tableMatch[1]; const headers = []; let m;
  const thRe = /<th[^>]*>([\s\S]*?)<\/th>/g;
  while ((m = thRe.exec(t))) headers.push(m[1].replace(/<[^>]+>/g, '').trim());
  const tbodyMatch = t.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  while ((m = trRe.exec(tbodyMatch[1]))) {
    const cells = []; const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g; let td;
    while ((td = tdRe.exec(m[1]))) cells.push(td[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length && headers.length) { const row = {}; headers.forEach((h, i) => row[h] = cells[i] || ''); rows.push(row); }
  }
  return rows;
}

// Set session year (needed for documents)
async function setSessionYear(year) {
  try { await portalPost('/year/change', { year }); } catch(e) { console.log('[Portal] Year change error:', e.message); }
}

// === SYNC ENDPOINT ===
biloopPortalRouter.get('/sync', async (req, res) => {
  try {
    const t0 = Date.now();
    const results = { customers: [], invoicesIssued: [], invoicesReceived: [], forms: [], payslips: [], providers: [] };
    const errors = [];
    const debugInfo = {};

    // Set year first
    await setSessionYear(new Date().getFullYear());

    // 1. CUSTOMERS
    try {
      const data = await portalJSON('/erp/masters/customers/getAjaxCustomers');
      results.customers = data?.data || [];
    } catch(e) { errors.push({ section: 'customers', error: e.message }); }

    // 2. FORMS
    try {
      const data = await portalJSON('/bi/documents/forms/getForms');
      results.forms = data?.forms || data?.data || (Array.isArray(data) ? data : []);
    } catch(e) { errors.push({ section: 'forms', error: e.message }); }

    // 3. INVOICES RECEIVED - documents directory
    try {
      // First call to get activities
      const init = await portalPost('/bi/documents/directory/list', { subsection: '' });
      const activities = (init?.activities || []).filter(a => a.id !== '99999');
      const activityIds = activities.map(a => a.id);
      debugInfo.docActivities = activities;
      debugInfo.docInitResponse = { status: init?.status, docCount: init?.documents?.length, activitiesCount: activities.length };

      let allDocs = init?.documents || [];

      // If initial call has no docs but has activities, try with activities selected
      if (allDocs.length === 0 && activityIds.length > 0) {
        const data = await portalPost('/bi/documents/directory/list', {
          subsection: '',
          params: {
            selectedActivities: activityIds,
            year: new Date().getFullYear().toString(),
            text: '',
            globalSearchOptions: { text: '' },
            advancedSearchOptions: { text: '' },
            selectedCostCenters: [],
            selectedRows: []
          }
        });
        allDocs = data?.documents || [];
        debugInfo.docWithActivities = { status: data?.status, docCount: allDocs.length };
      }

      // Try subsections: reports, registers, facturas
      if (allDocs.length === 0) {
        for (const sub of ['', 'reports', 'registers', 'facturas-recibidas', 'nominas']) {
          try {
            const d = await portalPost('/bi/documents/directory/list', { subsection: sub });
            if (d?.documents?.length > 0) {
              allDocs = allDocs.concat(d.documents);
              debugInfo[`sub_${sub||'empty'}`] = d.documents.length;
            }
          } catch(e) {}
        }
      }

      results.invoicesReceived = allDocs;
    } catch(e) { errors.push({ section: 'invoicesReceived', error: e.message }); }

    // 4. INVOICES ISSUED
    try {
      const params = new URLSearchParams({ draw: '1', start: '0', length: '500', 'order[0][column]': '0', 'order[0][dir]': 'desc', 'search[value]': '', 'search[regex]': 'false' });
      const r = await portalFetch(`/erp/documents/getAjaxDocuments?${params}`);
      const txt = await r.text();
      try { const j = JSON.parse(txt); results.invoicesIssued = j.data || j.aaData || []; } catch(e) {}
    } catch(e) { errors.push({ section: 'invoicesIssued', error: e.message }); }

    // 5. PAYSLIPS
    try {
      const html = await portalHTML('/bi/labor/payslips');
      results.payslips = parseTable(html);
    } catch(e) { errors.push({ section: 'payslips', error: e.message }); }

    const elapsed = Date.now() - t0;
    const summary = { customers: results.customers.length, invoicesIssued: results.invoicesIssued.length, invoicesReceived: results.invoicesReceived.length, forms: results.forms.length, payslips: results.payslips.length };
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    lastSyncData = { timestamp: new Date().toISOString(), summary, results, errors, elapsed, debugInfo };
    console.log(`[Sync] DONE in ${elapsed}ms - Total: ${total}`, summary, debugInfo);
    res.json({ success: true, timestamp: lastSyncData.timestamp, elapsed, summary, total, errors, debugInfo, data: results });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

biloopPortalRouter.get('/sync-status', (req, res) => {
  if (lastSyncData) res.json({ success: true, ...lastSyncData });
  else res.json({ success: false, message: 'No sync data yet.' });
});

// === DEBUG ===
biloopPortalRouter.get('/portal-test', async (req, res) => {
  try { sessionCookies = null; sessionExpiry = 0; const c = await getSession(); res.json({ success: true, cookies: c?.substring(0, 100) }); } catch (e) { res.json({ success: false, error: e.message }); }
});

biloopPortalRouter.get('/portal-fetch', async (req, res) => {
  try {
    const path = req.query.path || '/'; const r = await portalFetch(path); const ct = r.headers.get('content-type') || ''; const text = await r.text();
    if (ct.includes('json')) { try { return res.json({ success: true, path, data: JSON.parse(text) }); } catch(e) {} }
    res.json({ success: true, path, contentType: ct, length: text.length, body: text.substring(0, 5000) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

biloopPortalRouter.get('/portal-search', async (req, res) => {
  try {
    const path = req.query.path || '/'; const q = req.query.q || ''; const html = await portalHTML(path);
    const results = []; let idx = 0;
    while ((idx = html.indexOf(q, idx)) !== -1 && results.length < 10) {
      results.push({ pos: idx, context: html.substring(Math.max(0, idx - 200), Math.min(html.length, idx + q.length + 200)) }); idx += q.length;
    }
    res.json({ success: true, path, search: q, found: results.length, results: results.slice(0, 5) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

biloopPortalRouter.get('/portal-post-debug', async (req, res) => {
  try {
    const path = req.query.path || '/'; const params = {};
    for (const k of Object.keys(req.query)) { if (k !== 'path') params[k] = req.query[k]; }
    const data = await portalPost(path, params);
    res.json({ success: true, path, sentBody: jqueryParam(params), data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});
