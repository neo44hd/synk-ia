// ═══════════════════════════════════════════════════════════════════════════════
//  Revo Authentication Agent — Web Scraping Approach
//  
//  PROBLEMA: Revo no proporciona API keys fácilmente (requiere integración especial)
//  SOLUCIÓN: Usar Puppeteer para login web + extraer datos como usuario normal
//
//  Ventajas:
//  - No requiere API key
//  - Acceso a todos los datos disponibles en la interfaz web
//  - Funciona con usuario/contraseña normal
//  - Puede extraer reportes, inventario, ventas, etc
//
//  Desventajas:
//  - Más lento que API (300-500ms por petición)
//  - Requiere mantener sesión
//  - Vulnerable a cambios de UI de Revo
// ═══════════════════════════════════════════════════════════════════════════════

import puppeteer from 'puppeteer';

const REVO_URL = 'https://app.revo.works';
const REVO_TENANT = process.env.REVO_TENANT || 'chickenpalaceibiza2';

let browser = null;
let page = null;
let sessionToken = null;
let sessionExpiry = 0;

// ── Inicializar navegador ──────────────────────────────────────────────────────
async function launchBrowser() {
  if (!browser) {
    console.log('[RevoAuth] Lanzando navegador...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

// ── Login a Revo ───────────────────────────────────────────────────────────────
async function loginToRevo(username, password) {
  if (sessionToken && Date.now() < sessionExpiry) {
    console.log('[RevoAuth] Usando sesión almacenada');
    return sessionToken;
  }

  const browser = await launchBrowser();
  page = await browser.newPage();

  console.log('[RevoAuth] Iniciando sesión en Revo...');
  
  try {
    // 1. Navegar a login
    await page.goto(`${REVO_URL}/login`, { waitUntil: 'networkidle2' });

    // 2. Rellenar credenciales
    await page.type('input[name="email"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });

    // 3. Hacer click en login
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 4. Extraer token de sesión de cookies
    const cookies = await page.cookies();
    const sessionCookie = cookies.find(c => c.name === 'sessionId' || c.name === 'session' || c.name === 'auth');
    
    if (!sessionCookie) {
      throw new Error('No session cookie found after login');
    }

    sessionToken = sessionCookie.value;
    sessionExpiry = Date.now() + 3600000; // 1 hora
    console.log('[RevoAuth] ✅ Sesión iniciada correctamente');
    
    return sessionToken;
  } catch (err) {
    console.error('[RevoAuth] Error en login:', err.message);
    throw err;
  }
}

// ── Extraer datos de tabla HTML ────────────────────────────────────────────────
async function extractTableData(pageUrl, tableSelector) {
  if (!page) {
    throw new Error('Browser not initialized. Call loginToRevo first.');
  }

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle2' });
    
    const data = await page.evaluate((selector) => {
      const table = document.querySelector(selector);
      if (!table) return [];

      const rows = [];
      const headerCells = table.querySelectorAll('thead th');
      const headers = Array.from(headerCells).map(h => h.textContent.trim());

      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = {};
        headers.forEach((header, i) => {
          rowData[header] = cells[i]?.textContent.trim() || '';
        });
        rows.push(rowData);
      });

      return rows;
    }, tableSelector);

    return data;
  } catch (err) {
    console.error('[RevoAuth] Error extrayendo tabla:', err.message);
    throw err;
  }
}

// ── Exportar funciones para rutas ──────────────────────────────────────────────
export async function getRevoProducts(username, password) {
  await loginToRevo(username, password);
  const url = `${REVO_URL}/${REVO_TENANT}/inventory/products`;
  return extractTableData(url, 'table.products-table');
}

export async function getRevoSales(username, password, dateFrom, dateTo) {
  await loginToRevo(username, password);
  
  // Navegar a reporte de ventas
  const url = new URL(`${REVO_URL}/${REVO_TENANT}/reports/sales`);
  if (dateFrom) url.searchParams.set('from', dateFrom);
  if (dateTo) url.searchParams.set('to', dateTo);
  
  return extractTableData(url.toString(), 'table.sales-table');
}

export async function getRevoWorkers(username, password) {
  await loginToRevo(username, password);
  const url = `${REVO_URL}/${REVO_TENANT}/team/workers`;
  return extractTableData(url, 'table.workers-table');
}

export async function getRevoPayments(username, password, dateFrom, dateTo) {
  await loginToRevo(username, password);
  
  const url = new URL(`${REVO_URL}/${REVO_TENANT}/reports/payments`);
  if (dateFrom) url.searchParams.set('from', dateFrom);
  if (dateTo) url.searchParams.set('to', dateTo);
  
  return extractTableData(url.toString(), 'table.payments-table');
}

// ── Cerrar navegador al apagar el servidor ─────────────────────────────────────
export async function closeBrowser() {
  if (browser) {
    console.log('[RevoAuth] Cerrando navegador...');
    await browser.close();
    browser = null;
    page = null;
  }
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
