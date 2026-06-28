// ═══════════════════════════════════════════════════════════════════════════════
//  Biloop Authentication Agent — Direct Basic Auth
//  
//  PROBLEMA: Biloop API requiere SUBSCRIPTION_KEY (difícil de obtener)
//  SOLUCIÓN: Usar Basic Auth + Web Scraping como fallback
//
//  Opción 1: API con Basic Auth (HTTP 401 si no funciona)
//  Opción 2: Web Scraping con Puppeteer (si opción 1 falla)
//
//  El sistema intenta API primero, fallback a scraping automáticamente
// ═══════════════════════════════════════════════════════════════════════════════

import puppeteer from 'puppeteer';

const BILOOP_API_BASE = 'https://assempsa.biloop.es/api-global/v1';
const BILOOP_WEB = 'https://www.biloop.es';
const COMPANY_ID = 'E95251';

let browser = null;
let page = null;
let sessionToken = null;
let sessionExpiry = 0;

// ── Opción 1: API con Basic Auth ────────────────────────────────────────────────
async function biloopApiCall(endpoint, username, password, method = 'GET', body = null) {
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const url = `${BILOOP_API_BASE}${endpoint}`;
    console.log(`[BiloopAuth] API: ${method} ${endpoint}`);
    
    const res = await fetch(url, options);
    
    if (res.status === 401) {
      throw new Error('Invalid credentials (401)');
    }
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Biloop API ${res.status}: ${error}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error(`[BiloopAuth] Error en API:`, err.message);
    return { success: false, error: err.message };
  }
}

// ── Opción 2: Web Scraping con Puppeteer ───────────────────────────────────────
async function launchBrowser() {
  if (!browser) {
    console.log('[BiloopAuth] Lanzando navegador para scraping...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function loginToBiloopWeb(username, password) {
  if (sessionToken && Date.now() < sessionExpiry) {
    console.log('[BiloopAuth] Usando sesión almacenada');
    return sessionToken;
  }

  const browser = await launchBrowser();
  page = await browser.newPage();

  console.log('[BiloopAuth] Iniciando sesión en Biloop web...');
  
  try {
    // 1. Navegar a login
    await page.goto(`${BILOOP_WEB}/login`, { waitUntil: 'networkidle2' });

    // 2. Rellenar credenciales
    const userField = await page.$('input[type="email"], input[type="text"][name*="email"], input[name*="usuario"]');
    const passField = await page.$('input[type="password"]');
    
    if (!userField || !passField) {
      throw new Error('Could not find login form fields');
    }

    await userField.type(username, { delay: 50 });
    await passField.type(password, { delay: 50 });

    // 3. Hacer click en login/submit
    const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    }
    
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch {
      // Si no hay redirección, esperar a que la página se cargue
      await page.waitForTimeout(2000);
    }

    // 4. Verificar que estamos autenticados (check URL o elemento)
    const url = page.url();
    if (url.includes('login')) {
      throw new Error('Login failed - still on login page');
    }

    // 5. Extraer token de cookies
    const cookies = await page.cookies();
    const authCookie = cookies.find(c => 
      c.name.toLowerCase().includes('session') || 
      c.name.toLowerCase().includes('auth') ||
      c.name.toLowerCase().includes('token')
    );
    
    if (!authCookie) {
      console.warn('[BiloopAuth] Warning: No auth cookie found, but page navigated');
      sessionToken = 'authenticated';
    } else {
      sessionToken = authCookie.value;
    }

    sessionExpiry = Date.now() + 3600000; // 1 hora
    console.log('[BiloopAuth] ✅ Sesión iniciada correctamente en web');
    
    return sessionToken;
  } catch (err) {
    console.error('[BiloopAuth] Error en login web:', err.message);
    throw err;
  }
}

async function extractBiloopData(url, tableSelector = 'table, [role="table"]') {
  if (!page) {
    throw new Error('Browser not initialized');
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Intentar extraer tabla
    const data = await page.evaluate((selector) => {
      // Intentar múltiples selectores
      let element = document.querySelector(selector);
      if (!element) {
        element = document.querySelector('table');
      }
      if (!element) {
        element = document.querySelector('[role="table"]');
      }

      if (!element) {
        return { error: 'No table found' };
      }

      const rows = [];
      
      // Extraer headers
      const headerCells = element.querySelectorAll('thead th, [role="columnheader"]');
      const headers = Array.from(headerCells).map(h => h.textContent.trim());

      // Extraer filas
      const bodyRows = element.querySelectorAll('tbody tr, [role="row"]');
      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td, [role="gridcell"]');
        const rowData = {};
        headers.forEach((header, i) => {
          rowData[header] = cells[i]?.textContent.trim() || '';
        });
        if (Object.values(rowData).some(v => v)) {
          rows.push(rowData);
        }
      });

      return { data: rows, headers };
    }, tableSelector);

    return data;
  } catch (err) {
    console.error('[BiloopAuth] Error extrayendo datos:', err.message);
    throw err;
  }
}

// ── Funciones públicas: Intenta API, fallback a scraping ─────────────────────────
export async function getBiloopWorkers(username, password) {
  // Intentar API primero
  const apiResult = await biloopApiCall('/labor/getWorkers', username, password);
  if (apiResult.success) {
    return { source: 'api', ...apiResult };
  }

  console.log('[BiloopAuth] API falló, intentando web scraping...');
  
  // Fallback: scraping
  try {
    await loginToBiloopWeb(username, password);
    const url = `${BILOOP_WEB}/employees`;
    const data = await extractBiloopData(url);
    return { source: 'scraping', success: true, data };
  } catch (err) {
    return { source: 'scraping', success: false, error: err.message };
  }
}

export async function getBiloopPayslips(username, password, dateFrom, dateTo) {
  // Intentar API primero
  const endpoint = dateFrom && dateTo 
    ? `/labor/getPayslips?from=${dateFrom}&to=${dateTo}`
    : '/labor/getPayslips';
  
  const apiResult = await biloopApiCall(endpoint, username, password);
  if (apiResult.success) {
    return { source: 'api', ...apiResult };
  }

  console.log('[BiloopAuth] API falló, intentando web scraping...');
  
  // Fallback: scraping
  try {
    await loginToBiloopWeb(username, password);
    let url = `${BILOOP_WEB}/payslips`;
    if (dateFrom) url += `?from=${dateFrom}`;
    if (dateTo) url += `&to=${dateTo}`;
    
    const data = await extractBiloopData(url);
    return { source: 'scraping', success: true, data };
  } catch (err) {
    return { source: 'scraping', success: false, error: err.message };
  }
}

export async function getBiloopInvoices(username, password, type = 'received') {
  const endpoint = type === 'sent' 
    ? '/erp/incomes/invoices/getInvoices'
    : '/erp/expenses/invoices/getInvoices';
  
  const apiResult = await biloopApiCall(endpoint, username, password);
  if (apiResult.success) {
    return { source: 'api', ...apiResult };
  }

  console.log('[BiloopAuth] API falló, intentando web scraping...');
  
  try {
    await loginToBiloopWeb(username, password);
    const urlPath = type === 'sent' ? 'issued-invoices' : 'received-invoices';
    const url = `${BILOOP_WEB}/${urlPath}`;
    const data = await extractBiloopData(url);
    return { source: 'scraping', success: true, data };
  } catch (err) {
    return { source: 'scraping', success: false, error: err.message };
  }
}

export async function getBiloopProviders(username, password) {
  const apiResult = await biloopApiCall('/erp/erpProvider/getERPProviders', username, password);
  if (apiResult.success) {
    return { source: 'api', ...apiResult };
  }

  console.log('[BiloopAuth] API falló, intentando web scraping...');
  
  try {
    await loginToBiloopWeb(username, password);
    const url = `${BILOOP_WEB}/vendors`;
    const data = await extractBiloopData(url);
    return { source: 'scraping', success: true, data };
  } catch (err) {
    return { source: 'scraping', success: false, error: err.message };
  }
}

// ── Cerrar navegador ────────────────────────────────────────────────────────────
export async function closeBrowser() {
  if (browser) {
    console.log('[BiloopAuth] Cerrando navegador...');
    await browser.close();
    browser = null;
    page = null;
  }
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
