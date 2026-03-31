import { Router } from 'express';

export const biloopPortalRouter = Router();

const BILOOP_URL = 'https://assempsa.biloop.es';
let sessionCookies = null;
let sessionExpiry = 0;

// Login to Biloop portal and get session cookies
async function getSession() {
  if (sessionCookies && Date.now() < sessionExpiry) {
    return sessionCookies;
  }
  
  const user = process.env.BILOOP_USER || '';
  const pass = process.env.BILOOP_PASSWORD || '';
  
  console.log('[BiloopPortal] Logging in as:', user);
  
  // First GET to get CSRF token and initial cookies
  const loginPage = await fetch(`${BILOOP_URL}/`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  let cookies = (loginPage.headers.getSetCookie?.() || []).join('; ');
  const html = await loginPage.text();
  
  // Extract CSRF token
  const tokenMatch = html.match(/name="_token"\s+value="([^"]+)"/) ||
                     html.match(/meta.*?csrf.*?content="([^"]+)"/) ||
                     html.match(/token.*?:\s*['"]([^'"]+)['"]/);
  const csrfToken = tokenMatch ? tokenMatch[1] : '';
  
  console.log('[BiloopPortal] Got initial cookies, CSRF:', csrfToken ? 'found' : 'none');
  
  // POST login
  const formData = new URLSearchParams();
  formData.append('user_input', user);
  formData.append('password_input', pass);
  if (csrfToken) formData.append('_token', csrfToken);
  
  const loginRes = await fetch(`${BILOOP_URL}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0',
      'Referer': `${BILOOP_URL}/`
    },
    body: formData.toString(),
    redirect: 'manual'
  });
  
  // Collect all Set-Cookie headers
  const newCookies = loginRes.headers.getSetCookie?.() || [];
  if (newCookies.length > 0) {
    cookies = newCookies.map(c => c.split(';')[0]).join('; ');
  }
  
  console.log('[BiloopPortal] Login response:', loginRes.status, 'Location:', loginRes.headers.get('location'));
  
  // Follow redirect if needed
  const location = loginRes.headers.get('location');
  if (location) {
    const followRes = await fetch(location.startsWith('http') ? location : `${BILOOP_URL}${location}`, {
      headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0' },
      redirect: 'manual'
    });
    const moreCookies = followRes.headers.getSetCookie?.() || [];
    if (moreCookies.length > 0) {
      const existing = cookies.split('; ').map(c => c.split('=')[0]);
      moreCookies.forEach(c => {
        const name = c.split('=')[0];
        if (!existing.includes(name)) cookies += '; ' + c.split(';')[0];
      });
    }
  }
  
  sessionCookies = cookies;
  sessionExpiry = Date.now() + 3600000; // 1 hour
  console.log('[BiloopPortal] Session established, cookies:', cookies.substring(0, 100));
  return cookies;
}

// Fetch a portal page with session
async function portalFetch(path) {
  const cookies = await getSession();
  const url = path.startsWith('http') ? path : `${BILOOP_URL}${path}`;
  console.log('[BiloopPortal] Fetching:', url);
  const res = await fetch(url, {
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  return res.text();
}

// Parse HTML table rows into objects
function parseTable(html, tableId) {
  const rows = [];
  // Find table by id or first table
  const tableRegex = tableId 
    ? new RegExp(`<table[^>]*id=["']${tableId}["'][^>]*>([\\s\\S]*?)</table>`)
    : /<table[^>]*>([\s\S]*?)<\/table>/;
  const tableMatch = html.match(tableRegex);
  if (!tableMatch) return rows;
  
  const tableHtml = tableMatch[1];
  
  // Get headers
  const headers = [];
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/g;
  let thMatch;
  while ((thMatch = thRegex.exec(tableHtml)) !== null) {
    headers.push(thMatch[1].replace(/<[^>]+>/g, '').trim());
  }
  
  // Get body rows
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return rows;
  
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;
  while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
    const cells = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length > 0 && headers.length > 0) {
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      rows.push(row);
    } else if (cells.length > 0) {
      rows.push(cells);
    }
  }
  return rows;
}

// Debug/test endpoint
biloopPortalRouter.get('/portal-test', async (req, res) => {
  try {
    const html = await portalFetch('/bi/home');
    const isLoggedIn = html.includes('David Roldan') || html.includes('CHICKEN PALACE') || html.includes('bi/home');
    const title = html.match(/<title>([^<]+)<\/title>/);
    res.json({
      success: true,
      loggedIn: isLoggedIn,
      title: title ? title[1] : 'unknown',
      htmlLength: html.length,
      preview: html.substring(0, 500)
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Documents (facturas emitidas/recibidas)
biloopPortalRouter.get('/portal-documents', async (req, res) => {
  try {
    const html = await portalFetch('/bi/documents/directory');
    const tables = parseTable(html);
    res.json({ success: true, data: tables, htmlLength: html.length });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Workers/Labor
biloopPortalRouter.get('/portal-workers', async (req, res) => {
  try {
    const html = await portalFetch('/bi/labor/worker-reports');
    const tables = parseTable(html);
    res.json({ success: true, data: tables, htmlLength: html.length });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Customers (ERP)
biloopPortalRouter.get('/portal-customers', async (req, res) => {
  try {
    const html = await portalFetch('/erp/masters/customers');
    const tables = parseTable(html);
    res.json({ success: true, data: tables, htmlLength: html.length });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Home dashboard data
biloopPortalRouter.get('/portal-dashboard', async (req, res) => {
  try {
    const html = await portalFetch('/bi/home');
    // Extract key financial data
    const resultMatch = html.match(/([\d.,]+)\s*EUR/i) || html.match(/(-?[\d.,]+)\s*&euro;/i);
    res.json({
      success: true,
      resultado: resultMatch ? resultMatch[1] : null,
      htmlLength: html.length
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Clear session
biloopPortalRouter.get('/portal-logout', async (req, res) => {
  sessionCookies = null;
  sessionExpiry = 0;
  res.json({ success: true, message: 'Session cleared' });
});
