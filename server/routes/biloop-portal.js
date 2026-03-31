import { Router } from 'express';

export const biloopPortalRouter = Router();

const BILOOP_URL = 'https://assempsa.biloop.es';
let sessionCookies = null;
let sessionExpiry = 0;

// Login to Biloop portal
async function getSession() {
  if (sessionCookies && Date.now() < sessionExpiry) {
    return sessionCookies;
  }
  
  const user = process.env.BILOOP_USER || '';
  const pass = process.env.BILOOP_PASSWORD || '';
  console.log('[Portal] Logging in as:', user);
  
  // Step 1: GET login page for cookies and CSRF
  const r1 = await fetch(`${BILOOP_URL}/`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  
  let cookies = (r1.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const html = await r1.text();
  
  // Find CSRF token
  const csrf = html.match(/name="_token"\s+value="([^"]+)"/)?.[1] ||
               html.match(/csrf[_-]token.*?content="([^"]+)"/)?.[1] || '';
  
  // Find form action
  const formAction = html.match(/action="([^"]*)"/)?.[1] || '';
  
  // Find all script sources to understand login mechanism
  const scripts = [...html.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);
  
  console.log('[Portal] Cookies:', cookies?.substring(0, 80));
  console.log('[Portal] CSRF:', csrf ? 'found' : 'none');
  console.log('[Portal] Form action:', formAction || 'none');
  console.log('[Portal] Scripts:', scripts.length);
  
  // Step 2: Try AJAX login (Biloop likely uses AJAX)
  const loginEndpoints = ['/login', '/auth/login', '/api/login', '/'];
  
  for (const endpoint of loginEndpoints) {
    try {
      // Try JSON POST
      const r2 = await fetch(`${BILOOP_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
          'Referer': `${BILOOP_URL}/`,
          ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {})
        },
        body: JSON.stringify({
          user_input: user,
          password_input: pass,
          _token: csrf
        }),
        redirect: 'manual'
      });
      
      const newCookies = r2.headers.getSetCookie?.() || [];
      if (newCookies.length > 0) {
        cookies = [...cookies.split('; '), ...newCookies.map(c => c.split(';')[0])]
          .filter((v, i, a) => a.findIndex(x => x.split('=')[0] === v.split('=')[0]) === i)
          .join('; ');
      }
      
      const body = await r2.text();
      console.log('[Portal] Login try', endpoint, ':', r2.status, body.substring(0, 200));
      
      // Check if login succeeded
      if (r2.status === 200 && (body.includes('redirect') || body.includes('success') || body.includes('bi/home'))) {
        sessionCookies = cookies;
        sessionExpiry = Date.now() + 3600000;
        console.log('[Portal] Login SUCCESS via', endpoint);
        return cookies;
      }
      
      // Try form-encoded POST
      const r3 = await fetch(`${BILOOP_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': `${BILOOP_URL}/`,
          ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {})
        },
        body: new URLSearchParams({
          user_input: user,
          password_input: pass,
          ...(csrf ? { _token: csrf } : {})
        }).toString(),
        redirect: 'manual'
      });
      
      const newCookies3 = r3.headers.getSetCookie?.() || [];
      if (newCookies3.length > 0) {
        cookies = [...cookies.split('; '), ...newCookies3.map(c => c.split(';')[0])]
          .filter((v, i, a) => a.findIndex(x => x.split('=')[0] === v.split('=')[0]) === i)
          .join('; ');
      }
      
      const location = r3.headers.get('location');
      console.log('[Portal] Form try', endpoint, ':', r3.status, 'Location:', location);
      
      if (r3.status === 302 && location && (location.includes('bi') || location.includes('home'))) {
        sessionCookies = cookies;
        sessionExpiry = Date.now() + 3600000;
        console.log('[Portal] Login SUCCESS via form', endpoint);
        return cookies;
      }
    } catch(e) {
      console.log('[Portal] Error trying', endpoint, ':', e.message);
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
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });
  return res.text();
}

function parseTable(html) {
  const rows = [];
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return rows;
  const tableHtml = tableMatch[1];
  const headers = [];
  let m;
  const thRe = /<th[^>]*>([\s\S]*?)<\/th>/g;
  while ((m = thRe.exec(tableHtml))) headers.push(m[1].replace(/<[^>]+>/g, '').trim());
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return rows;
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

// Debug login
biloopPortalRouter.get('/portal-test', async (req, res) => {
  try {
    sessionCookies = null;
    sessionExpiry = 0;
    
    const user = process.env.BILOOP_USER || '';
    const pass = process.env.BILOOP_PASSWORD || '';
    
    // GET login page
    const r1 = await fetch(`${BILOOP_URL}/`, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const initCookies = (r1.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
    const html = await r1.text();
    
    // Extract form details
    const csrf = html.match(/name="_token"\s+value="([^"]+)"/)?.[1] || '';
    const formAction = html.match(/<form[^>]*action="([^"]*)"/)?.[1] || 'no form tag found';
    const formMethod = html.match(/<form[^>]*method="([^"]*)"/)?.[1] || 'no method';
    const inputs = [...html.matchAll(/<input[^>]*name="([^"]*)"/g)].map(m => m[1]);
    const scripts = [...html.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);
    
    // Find login JS function
    const loginJS = html.match(/function\s+login[\s\S]*?\}/)?.[0] || 
                    html.match(/btnlogin[\s\S]{0,500}/)?.[0] ||
                    html.match(/\.click[\s\S]{0,300}login/)?.[0] || 'not found in inline';
    
    res.json({
      success: true,
      initCookies,
      csrf: csrf ? 'found' : 'none',
      formAction,
      formMethod,
      inputs,
      scripts: scripts.slice(0, 10),
      loginJS: loginJS.substring(0, 500),
      htmlSnippet: html.match(/controller[\s\S]{0,1000}/)?.[0]?.substring(0, 800) || 'not found'
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

biloopPortalRouter.get('/portal-documents', async (req, res) => {
  try {
    const html = await portalFetch('/bi/documents/directory');
    res.json({ success: true, data: parseTable(html), htmlLength: html.length });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-workers', async (req, res) => {
  try {
    const html = await portalFetch('/bi/labor/worker-reports');
    res.json({ success: true, data: parseTable(html), htmlLength: html.length });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-customers', async (req, res) => {
  try {
    const html = await portalFetch('/erp/masters/customers');
    res.json({ success: true, data: parseTable(html), htmlLength: html.length });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

biloopPortalRouter.get('/portal-logout', async (req, res) => {
  sessionCookies = null;
  sessionExpiry = 0;
  res.json({ success: true, message: 'Session cleared' });
});
