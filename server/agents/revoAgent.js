// ═══════════════════════════════════════════════════════════════════════════
//  AGENTE REVO — Sincronización de TPV (ventas, artículos, cajas)
//  Datos ya estructurados → NO pasan por el procesador IA
// ═══════════════════════════════════════════════════════════════════════════
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const REVO_DIR = path.join(DATA_DIR, 'revo');

// ── API Configuration ────────────────────────────────────────────────────
// Catalog API v1: solo necesita JWT Bearer (OAuth2 token con scope catalog.*)
// Classic API v2: necesita tenant + Bearer + client-token (integrator token)
// Reports API v3: necesita tenant + Bearer + client-token (integrator token)
const REVO_CATALOG_BASE = 'https://api.revoxef.works/catalog/v1';
const REVO_CLASSIC_BASE = 'https://revoxef.works/api/external/v2';
const REVO_REPORTS_BASE = 'https://revoxef.works/api/external/v3';
const REVO_TENANT = process.env.REVO_TENANT || 'chickenpalaceibiza2';
const CACHE_FILE = path.join(REVO_DIR, 'endpoints-cache.json');

// Endpoints por tipo de API
const ENDPOINTS = {
  // Catalog API v1 (funciona con JWT Bearer)
  productos:  { api: 'catalog', paths: ['/items', '/products'] },
  categorias: { api: 'catalog', paths: ['/categories', '/general-groups'] },
  
  // Reports API v3 (necesita client-token)
  ventas:     { api: 'reports', paths: ['/reports/orders'] },
  pagos:      { api: 'reports', paths: ['/reports/payments'] },
  empleados:  { api: 'reports', paths: ['/reports/tenantUsers', '/reports/presences'] },
  facturas:   { api: 'reports', paths: ['/reports/invoices'] },
  cajas:      { api: 'reports', paths: ['/reports/turns'] },
  
  // Classic API v2 (necesita client-token)
  metodosPago: { api: 'classic', paths: ['/paymentMethods'] },
  mesas:       { api: 'classic', paths: ['/rooms'] },
  clientes:    { api: 'classic', paths: ['/customers'] },
  almacenes:   { api: 'classic', paths: ['/warehouses'] },
};

// ── Cache de endpoints válidos ──────────────────────────────────────────
let endpointCache = {};
let cacheLoaded = false;

async function loadEndpointCache() {
  if (cacheLoaded) return;
  try {
    if (existsSync(CACHE_FILE)) {
      const raw = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
      endpointCache = raw?.endpoints || {};
      const n = Object.keys(endpointCache).length;
      if (n > 0) console.log(`[REVO] Cache cargado: ${n} endpoints optimizados`);
    }
  } catch (err) {
    console.log(`[REVO] Cache no disponible (${err.message}), usando fallback completo`);
    endpointCache = {};
  }
  cacheLoaded = true;
}

async function updateCacheEntry(recurso, endpoint) {
  if (endpointCache[recurso] === endpoint) return;
  endpointCache[recurso] = endpoint;
  try {
    await mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify({
      generado: new Date().toISOString(),
      nota: 'Auto-actualizado por revoAgent.js en producción.',
      endpoints: endpointCache,
    }, null, 2));
  } catch {} // no crítico
}

async function loadJSON(file, def = []) {
  try { return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : def; }
  catch { return def; }
}
async function saveJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

// ── Headers según tipo de API ───────────────────────────────────────────
function catalogHeaders() {
  return {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

function classicHeaders() {
  const headers = {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'tenant': REVO_TENANT,
  };
  // client-token es proporcionado por Revo a integradores registrados
  if (process.env.REVO_CLIENT_TOKEN) {
    headers['client-token'] = process.env.REVO_CLIENT_TOKEN;
  }
  return headers;
}

function getBaseUrl(api) {
  if (api === 'catalog') return REVO_CATALOG_BASE;
  if (api === 'classic') return REVO_CLASSIC_BASE;
  return REVO_REPORTS_BASE;
}

function getHeaders(api) {
  return api === 'catalog' ? catalogHeaders() : classicHeaders();
}

function needsClientToken(api) {
  return api !== 'catalog';
}

// ── Fetch con fallback inteligente ──────────────────────────────────────
async function fetchAny(recurso, endpointConfig, params = '') {
  await loadEndpointCache();
  const { api, paths } = endpointConfig;
  const baseUrl = getBaseUrl(api);
  const headers = getHeaders(api);

  // Verificar si necesita client-token y no lo tenemos
  if (needsClientToken(api) && !process.env.REVO_CLIENT_TOKEN) {
    console.log(`[REVO] ⚠ ${recurso}: requiere client-token (integrator token) — no configurado`);
    return { data: null, error: 'needs-client-token', recurso };
  }

  // 1. Intentar endpoint cacheado
  const cached = endpointCache[recurso];
  if (cached) {
    try {
      const url = `${baseUrl}${cached}${params}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        console.log(`[REVO] ✓ ${recurso} → ${cached} (cache)`);
        return { data: data?.data || data, endpoint: cached };
      }
      console.log(`[REVO] ✗ ${recurso} → ${cached} (cache) → ${res.status}`);
      try { const body = await res.text(); console.log(`[REVO]   Body: ${body.slice(0, 300)}`); } catch {}
    } catch (err) {
      console.log(`[REVO] ✗ ${recurso} → ${cached} (cache) → ${err.message}`);
    }
  }

  // 2. Fallback: probar alternativas
  for (const ep of paths) {
    if (ep === cached) continue;
    try {
      const url = `${baseUrl}${ep}${params}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        console.log(`[REVO] ✓ ${recurso} → ${ep} (descubierto)`);
        await updateCacheEntry(recurso, ep);
        return { data: data?.data || data, endpoint: ep };
      }
      console.log(`[REVO] ✗ ${recurso} → ${ep} → ${res.status}`);
      try { const body = await res.text(); console.log(`[REVO]   Body: ${body.slice(0, 300)}`); } catch {}
    } catch (err) {
      console.log(`[REVO] ✗ ${recurso} → ${ep} → ${err.message}`);
    }
  }
  console.log(`[REVO] ✗ ${recurso}: todos los endpoints fallaron`);
  return null;
}

// ── Fetch paginado (Catalog API devuelve páginas) ───────────────────────
async function fetchAllPages(recurso, endpointConfig, maxPages = 10) {
  let allItems = [];
  let page = 1;
  
  while (page <= maxPages) {
    const params = `?pagination=200&page=${page}`;
    const result = await fetchAny(recurso, endpointConfig, params);
    
    if (!result || result.error) return result;
    
    const items = Array.isArray(result.data) ? result.data : [];
    allItems = [...allItems, ...items];
    
    // Si recibimos menos de 200, ya no hay más páginas
    if (items.length < 200) break;
    page++;
  }
  
  return { data: allItems, endpoint: endpointCache[recurso] || 'paginado' };
}

// ── Sync productos/artículos ────────────────────────────────────────────
async function syncProductos() {
  const result = await fetchAllPages('productos', ENDPOINTS.productos);
  if (!result || result.error) return result;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'productos.json'), {
    actualizado: new Date().toISOString(),
    total: items.length,
    items,
  });
  return items.length;
}

// ── Sync categorías ─────────────────────────────────────────────────────
async function syncCategorias() {
  const result = await fetchAllPages('categorias', ENDPOINTS.categorias);
  if (!result || result.error) return result;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'categorias.json'), {
    actualizado: new Date().toISOString(),
    items,
  });
  return items.length;
}

// ── Sync ventas (últimos N días) — Reports API v3 ───────────────────────
async function syncVentas(dias = 7) {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeStr = desde.toISOString().split('T')[0];
  const hastaStr = new Date().toISOString().split('T')[0];

  const result = await fetchAny('ventas', ENDPOINTS.ventas, 
    `?start_date=${desdeStr}&end_date=${hastaStr}&pagination=200`);
  
  if (!result || result.error) return result;

  const nuevas    = Array.isArray(result.data) ? result.data : [];
  const existing  = await loadJSON(path.join(REVO_DIR, 'ventas.json'), []);
  const existIds  = new Set(existing.map(v => v.id));
  const combined  = [...nuevas.filter(v => !existIds.has(v.id)), ...existing].slice(0, 10000);

  await saveJSON(path.join(REVO_DIR, 'ventas.json'), combined);

  // Resumen diario para el cerebro
  const resumenDiario = buildDailySummary(combined);
  await saveJSON(path.join(REVO_DIR, 'resumen_diario.json'), resumenDiario);

  return nuevas.length;
}

// ── Sync pagos — Reports API v3 ─────────────────────────────────────────
async function syncPagos(dias = 7) {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeStr = desde.toISOString().split('T')[0];
  const hastaStr = new Date().toISOString().split('T')[0];

  const result = await fetchAny('pagos', ENDPOINTS.pagos,
    `?start_date=${desdeStr}&end_date=${hastaStr}&pagination=200`);
  
  if (!result || result.error) return result;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'pagos.json'), {
    actualizado: new Date().toISOString(),
    total: items.length,
    items,
  });
  return items.length;
}

// ── Sync empleados — Reports API v3 ─────────────────────────────────────
async function syncEmpleados() {
  const result = await fetchAny('empleados', ENDPOINTS.empleados);
  if (!result || result.error) return result;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'empleados.json'), {
    actualizado: new Date().toISOString(),
    items,
  });
  return items.length;
}

// ── Sync cajas/turnos — Reports API v3 ──────────────────────────────────
async function syncCajas() {
  const desde = new Date();
  desde.setDate(desde.getDate() - 7);
  const desdeStr = desde.toISOString().split('T')[0];
  const hastaStr = new Date().toISOString().split('T')[0];

  const result = await fetchAny('cajas', ENDPOINTS.cajas,
    `?start_date=${desdeStr}&end_date=${hastaStr}&pagination=200`);
  
  if (!result || result.error) return result;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'cajas.json'), {
    actualizado: new Date().toISOString(),
    items: items.slice(0, 200),
  });
  return items.length;
}

// ── Construir resumen diario de ventas ──────────────────────────────────
function buildDailySummary(ventas) {
  const byDay = {};
  const byProduct = {};

  for (const v of ventas) {
    const dia = (v.created_at || v.date || v.closed_at || '').slice(0, 10);
    if (!dia) continue;

    if (!byDay[dia]) byDay[dia] = { fecha: dia, total: 0, tickets: 0, items: 0 };
    byDay[dia].total   += parseFloat(v.total || v.amount || v.sum || 0);
    byDay[dia].tickets += 1;

    for (const item of (v.contents || v.lines || v.items || v.orderLines || [])) {
      byDay[dia].items += parseInt(item.quantity || 1);
      const nombre = item.name || item.item_name || item.product?.name || item.productName || 'Desconocido';
      if (!byProduct[nombre]) byProduct[nombre] = { nombre, cantidad: 0, total: 0 };
      byProduct[nombre].cantidad += parseInt(item.quantity || 1);
      byProduct[nombre].total    += parseFloat(item.price || item.subtotal || 0) * parseInt(item.quantity || 1);
    }
  }

  const ranking = Object.values(byProduct)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 50);

  return {
    actualizado: new Date().toISOString(),
    por_dia:     Object.values(byDay).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    top_productos: ranking,
    total_ventas:  Object.values(byDay).reduce((s, d) => s + d.total, 0),
    total_tickets: Object.values(byDay).reduce((s, d) => s + d.tickets, 0),
  };
}

// ── Sync completo ───────────────────────────────────────────────────────
export async function syncRevo() {
  console.log('[REVO] Iniciando sincronización...');
  if (!process.env.REVO_TOKEN_LARGO) {
    console.log('[REVO] Sin REVO_TOKEN_LARGO — omitiendo');
    return { success: false, error: 'no token' };
  }

  const hasClientToken = !!process.env.REVO_CLIENT_TOKEN;
  if (!hasClientToken) {
    console.log('[REVO] ⚠ Sin REVO_CLIENT_TOKEN — solo se sincronizará el catálogo');
    console.log('[REVO]   Para ventas/pagos/empleados: solicitar client-token en https://community.revo.works/integration');
  }

  const results = {};
  
  // Catalog API (siempre funciona con JWT)
  try { results.productos  = await syncProductos(); }  catch (e) { results.productos  = null; results.productos_err  = e.message; }
  try { results.categorias = await syncCategorias(); } catch (e) { results.categorias = null; results.categorias_err = e.message; }
  
  // Reports API (necesita client-token)
  try { 
    const r = await syncVentas(7);
    results.ventas = r?.error ? `⚠ ${r.error}` : r;
  } catch (e) { results.ventas = null; results.ventas_err = e.message; }
  
  try {
    const r = await syncPagos(7);
    results.pagos = r?.error ? `⚠ ${r.error}` : r;
  } catch (e) { results.pagos = null; results.pagos_err = e.message; }
  
  try {
    const r = await syncEmpleados();
    results.empleados = r?.error ? `⚠ ${r.error}` : r;
  } catch (e) { results.empleados = null; results.empleados_err = e.message; }
  
  try {
    const r = await syncCajas();
    results.cajas = r?.error ? `⚠ ${r.error}` : r;
  } catch (e) { results.cajas = null; results.cajas_err = e.message; }

  const catalogOk = [results.productos, results.categorias].some(v => typeof v === 'number');
  const reportsOk = [results.ventas, results.pagos, results.empleados, results.cajas].some(v => typeof v === 'number');
  
  console.log(`[REVO] Catálogo: ${catalogOk ? '✓' : '✗'} | Reports: ${reportsOk ? '✓' : '⚠ necesita client-token'}`);
  console.log(`[REVO] Resultados:`, JSON.stringify(results));
  
  return { 
    success: catalogOk, 
    catalogOk,
    reportsOk,
    needsClientToken: !hasClientToken,
    ...results 
  };
}

// ── Lectura de datos para el cerebro ────────────────────────────────────
export const getRevoProductos  = () => loadJSON(path.join(REVO_DIR, 'productos.json'), { items: [] });
export const getRevoVentas     = () => loadJSON(path.join(REVO_DIR, 'ventas.json'), []);
export const getRevoResumen    = () => loadJSON(path.join(REVO_DIR, 'resumen_diario.json'), {});
export const getRevoCajas      = () => loadJSON(path.join(REVO_DIR, 'cajas.json'), { items: [] });
export const getRevoPagos      = () => loadJSON(path.join(REVO_DIR, 'pagos.json'), { items: [] });
export const getRevoEmpleados  = () => loadJSON(path.join(REVO_DIR, 'empleados.json'), { items: [] });
