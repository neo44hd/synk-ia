import { Router } from 'express';

export const biloopPortalRouter = Router();

const BILOOP_URL = 'https://assempsa.biloop.es';
let sessionCookies = null;
let sessionExpiry = 0;

// Login to Biloop portal (Vue.js AJAX login)
async function getSession() {
  if (sessionCookies && Date.now() < sessionExpiry) {
    return sessionCookies;
  }

  const user = process.env.BILOOP_USER || '';
  const pass = process.env.BILOOP_PASSWORD || '';
  console.log('[Portal] Logging in as:', user);

  // Step 1: GET login page for PHPSESSID cookie
  const r1 = await fetch(`${BILOOP_URL}/`, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  let cookies = (r1.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  console.log('[Portal] Init cookies:', cookies?.substring(0, 80));

  // Step 2: Try POST /login with JSON (Vue.js $.post style)
  const loginPayloads = [
    { user: user, password: pass, captcha: '' },
    { user_input: user, password_input: pass, captcha: '' },
    { user: user, password: pass },
    { nif: user, password: pass },
  ];

  const loginEndpoints = ['/login', '/', '/auth/login', '/api/login'];
  const contentTypes = [
    'application/x-www-form-urlencoded',
    'application/json'
  ];

  for (const endpoint of loginEndpoints) {
    for (const payload of loginPayloads) {
      for (const ct of contentTypes) {
        try {
          const body = ct.includes('json')
            ? JSON.stringify(payload)
            : new URLSearchParams(payload).toString();

          const r2 = await fetch(`${BILOOP_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': ct,
              'Cookie': cookies,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json, text/html, */*',
              'Referer': `${BILOOP_URL}/`,
              'Origin': BILOOP_URL
            },
            body,
            redirect: 'manual'
          });

          // Collect new cookies
          const newCookies = r2.headers.getSetCookie?.() || [];
          if (newCookies.length > 0) {
            const all = [...cookies.split('; ').filter(c => c), ...newCookies.map(c => c.split(';')[0])];
            cookies = all.filter((v, i, a) => a.findIndex(x => x.split('=')[0] === v.split('=')[0]) === i).join('; ');
          }

          const respText = await r2.text();
          const location = r2.headers.get('location');

          console.log(`[Portal] ${endpoint} ${ct.split('/')[1]} payload=${Object.keys(payload).join(',')}:`, r2.status, respText.substring(0, 150));

          // Success: 302 redirect to dashboard
          if (r2.status === 302 && location && !location.includes('login')) {
            sessionCookies = cookies;
            sessionExpiry = Date.now() + 3600000;
            console.log('[Portal] Login SUCCESS (302) ->', location);
            return cookies;
          }

          // Success: JSON with redirect/success/OK
          if (r2.status === 200) {
            try {
              const json = JSON.parse(respText);
              if (json.status === 'OK' || json.success || json.redirect) {
                sessionCookies = cookies;
                sessionExpiry = Date.now() + 3600000;
                console.log('[Portal] Login SUCCESS (JSON):', JSON.stringify(json).substring(0, 200));
                return cookies;
              }
            } catch(e) {
              // Not JSON, check if redirected to dashboard
              if (respText.includes('bi/home') || respText.includes('dashboard')) {
                sessionCookies = cookies;
                sessionExpiry = Date.now() + 3600000;
                console.log('[Portal] Login SUCCESS (HTML redirect)');
                return cookies;
              }
            }
          }
        } catch(e) {
          console.log(`[Portal] Error ${endpoint}:`, e.message);
        }
      }
    }
  }

  throw new Error('All login attempts failed');
}

async function portalFetch(path) {
  const cookies = await getSession();
  const url = path.startsWith('http') ? path : `${BILOOP_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  return res.text();
}

function parseTable(html) {
  const rows = [];
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return { rows: [], rawLength: html.length, hasTable: false };
  const tableHtml = tableMatch[1];
  const headers = [];
  let m;
  const thRe = /<th[^>]*>([\s\S]*?)<\/th>/g;
  while ((m = thRe.exec(tableHtml))) headers.push(m[1].replace(/<[^>]+>/g, '').trim());
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return { rows: [], headers, rawLength: html.length, hasTable: true };
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
  return { rows, headers, rawLength: html.length, hasTable: true };
}

// Debug: extract ALL inline scripts from login page
biloopPortalRouter.get('/portal-test', async (req, res) => {
  try {
    sessionCookies = null;
    sessionExpiry = 0;

    const r1 = await fetch(`${BILOOP_URL}/`, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const initCookies = (r1.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
    const html = await r1.text();

    // Extract ALL inline script blocks
    const inlineScripts = [];
    const scriptRe = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g;
    let sm;
    while ((sm = scriptRe.exec(html))) {
      const content = sm[1].trim();
      if (content.length > 10) inlineScripts.push(content.substring(0, 2000));
    }

    // Extract external script sources
    const scripts = [...html.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);

    // Find Vue app definition
    const vueApp = html.match(/new\s+Vue\s*\(([\s\S]*?)\)\s*;?/)?.[0]?.substring(0, 3000) || 'not found';

    // Find login-related code
    const loginCode = html.match(/login[\s\S]{0,2000}/i)?.[0]?.substring(0, 1500) || 'not found';

    // Find $.post or $.ajax calls
    const ajaxCalls = html.match(/\$\.(post|ajax|get)[\s\S]{0,500}/g) || [];

    // Try actual login
    let loginResult = null;
    try {
      const cookies = await getSession();
      loginResult = { success: true, cookies: cookies?.substring(0, 100) };
    } catch(e) {
      loginResult = { success: false, error: e.message };
    }

    res.json({
      success: true,
      initCookies,
      scripts: scripts.slice(0, 10),
      inlineScriptsCount: inlineScripts.length,
      inlineScripts,
      vueApp: vueApp.substring(0, 2000),
      loginCode: loginCode.substring(0, 1000),
      ajaxCalls: ajaxCalls.map(c => c.substring(0, 300)),
      loginResult
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

biloopPortalRouter.get('/portal-documents', async (req, res) => {
  try {
    const html = await portalFetch('/bi/documents/directory');
    res.json({ success: true, ...parseTable(html) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-workers', async (req, res) => {
  try {
    const html = await portalFetch('/bi/labor/worker-reports');
    res.json({ success: true, ...parseTable(html) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-customers', async (req, res) => {
  try {
    const html = await portalFetch('/erp/masters/customers');
    res.json({ success: true, ...parseTable(html) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-logout', async (req, res) => {
  sessionCookies = null;
  sessionExpiry = 0;
  res.json({ success: true, message: 'Session cleared' });
});

// Debug: raw HTML from any portal path
biloopPortalRouter.get('/portal-raw', async (req, res) => {
  try {
    const path = req.query.path || '/erp/masters/customers';
    const html = await portalFetch(path);
    // Find table section
    const tableStart = html.indexOf('<table');
    const tableEnd = html.indexOf('</table>');
    const tableSnippet = tableStart >= 0 ? html.substring(tableStart, Math.min(tableStart + 3000, tableEnd + 10)) : 'no table found';
    // Find Vue data / inline scripts with data
    const inlineScripts = [];
    const scriptRe = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g;
    let sm;
    while ((sm = scriptRe.exec(html))) {
      const c = sm[1].trim();
      if (c.length > 50) inlineScripts.push(c.substring(0, 2000));
    }
    // Find AJAX data URLs
    const ajaxUrls = [...html.matchAll(/(?:get|post|fetch|ajax)\s*\(?\s*['"]([^'"]+)['"]|url:\s*['"]([^'"]+)['"]/gi)].map(m => m[1] || m[2]).filter(Boolean);
    res.json({
      success: true,
      path,
      htmlLength: html.length,
      title: html.match(/<title>([^<]*)<\/title>/)?.[1] || '',
      hasTable: tableStart >= 0,
      tableSnippet: tableSnippet.substring(0, 2000),
      inlineScriptsCount: inlineScripts.length,
      inlineScripts: inlineScripts.slice(0, 5),
      ajaxUrls: ajaxUrls.slice(0, 20)
    });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Fetch any portal path and return raw response
biloopPortalRouter.get('/portal-fetch', async (req, res) => {
  try {
    const path = req.query.path || '/erp/masters/customers';
    const cookies = await getSession();
    const url = path.startsWith('http') ? path : `${BILOOP_URL}${path}`;
    const r = await fetch(url, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/html, */*'
      }
    });
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    if (ct.includes('json')) {
      try { res.json({ success: true, path, data: JSON.parse(text) }); return; }
      catch(e) {}
    }
    res.json({ success: true, path, contentType: ct, length: text.length, body: text.substring(0, 5000) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Search page HTML for DataTable config
biloopPortalRouter.get('/portal-datatable', async (req, res) => {
  try {
    const path = req.query.path || '/erp/masters/customers';
    const html = await portalFetch(path);
    // Find DataTable initialization
    const dtConfigs = [...html.matchAll(/(?:dataTable|DataTable)\s*\(([\s\S]*?)\)\s*;/g)].map(m => m[0].substring(0, 1500));
    // Find ajax URLs in DataTable config  
    const ajaxUrls = [...html.matchAll(/ajax\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    const ajaxObjs = [...html.matchAll(/ajax\s*:\s*\{[^}]*url\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    // Find Vue data sources
    const vueData = [...html.matchAll(/\$\.(?:get|post)\s*\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    res.json({
      success: true,
      path,
      dtConfigsCount: dtConfigs.length,
      dtConfigs: dtConfigs.slice(0, 5),
      ajaxUrls,
      ajaxObjs,
      vueDataSources: vueData.slice(0, 30)
    });
  } catch (err) { res.json({ success: false, error: err.message }); }
});
