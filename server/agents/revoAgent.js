// ═══════════════════════════════════════════════════════════════════════════
//  AGENTE REVO — Sincronización de TPV (ventas, artículos, cajas)
//  Datos ya estructurados → NO pasan por el procesador IA
// ═══════════════════════════════════════════════════════════════════════════
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/Users/davidnows/sinkia/data';
const REVO_DIR = path.join(DATA_DIR, 'revo');
const REVO_BASE = 'https://integrations.revoxef.works/api/v1';

// Endpoints conocidos de Revo XEF (orden de preferencia)
const ENDPOINTS = {
  productos:  ['/catalog/products', '/catalog/items', '/items', '/products'],
  categorias: ['/catalog/categories', '/categories'],
  ventas:     ['/orders', '/order/list'],
  cajas:      ['/cash', '/cash/list', '/sessions'],
  mesas:      ['/tables', '/table/list'],
  empleados:  ['/staff', '/employees', '/users'],
};

async function loadJSON(file, def = []) {
  try { return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : def; }
  catch { return def; }
}
async function saveJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

function revoHeaders() {
  const h = { 'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`, 'Content-Type': 'application/json' };
  if (process.env.REVO_TOKEN_CORTO) h['X-API-Key'] = process.env.REVO_TOKEN_CORTO;
  return h;
}

// Prueba múltiples endpoints hasta encontrar uno que funcione
async function fetchAny(endpoints, params = '') {
  const headers = revoHeaders();
  for (const ep of endpoints) {
    try {
      const url = `${REVO_BASE}${ep}${params}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        console.log(`[REVO] ✓ ${ep}`);
        return { data: data?.data || data, endpoint: ep };
      }
    } catch {}
  }
  return null;
}

// ── Sync productos/artículos ────────────────────────────────────────────────
async function syncProductos() {
  const result = await fetchAny(ENDPOINTS.productos);
  if (!result) return null;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'productos.json'), {
    actualizado: new Date().toISOString(),
    total: items.length,
    items,
  });
  return items.length;
}

// ── Sync categorías ─────────────────────────────────────────────────────────
async function syncCategorias() {
  const result = await fetchAny(ENDPOINTS.categorias);
  if (!result) return null;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'categorias.json'), {
    actualizado: new Date().toISOString(),
    items,
  });
  return items.length;
}

// ── Sync ventas (últimos N días) ────────────────────────────────────────────
async function syncVentas(dias = 7) {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeStr = desde.toISOString().split('T')[0];

  const result = await fetchAny(ENDPOINTS.ventas, `?since=${desdeStr}&per_page=500`);
  if (!result) return null;

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

// ── Sync cajas (sesiones de caja) ───────────────────────────────────────────
async function syncCajas() {
  const result = await fetchAny(ENDPOINTS.cajas);
  if (!result) return null;
  const items = Array.isArray(result.data) ? result.data : [];
  await saveJSON(path.join(REVO_DIR, 'cajas.json'), {
    actualizado: new Date().toISOString(),
    items: items.slice(0, 200),
  });
  return items.length;
}

// ── Construir resumen diario de ventas ──────────────────────────────────────
function buildDailySummary(ventas) {
  const byDay = {};
  const byProduct = {};

  for (const v of ventas) {
    const dia = (v.created_at || v.date || '').slice(0, 10);
    if (!dia) continue;

    if (!byDay[dia]) byDay[dia] = { fecha: dia, total: 0, tickets: 0, items: 0 };
    byDay[dia].total   += parseFloat(v.total || v.amount || 0);
    byDay[dia].tickets += 1;

    for (const item of (v.lines || v.items || v.orderLines || [])) {
      byDay[dia].items += parseInt(item.quantity || 1);
      const nombre = item.name || item.product?.name || item.productName || 'Desconocido';
      if (!byProduct[nombre]) byProduct[nombre] = { nombre, cantidad: 0, total: 0 };
      byProduct[nombre].cantidad += parseInt(item.quantity || 1);
      byProduct[nombre].total    += parseFloat(item.price || 0) * parseInt(item.quantity || 1);
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

// ── Sync completo ───────────────────────────────────────────────────────────
export async function syncRevo() {
  console.log('[REVO] Iniciando sincronización...');
  if (!process.env.REVO_TOKEN_LARGO) {
    console.log('[REVO] Sin REVO_TOKEN_LARGO — omitiendo');
    return { success: false, error: 'no token' };
  }

  const results = {};
  try { results.productos  = await syncProductos(); } catch (e) { results.productos_err  = e.message; }
  try { results.categorias = await syncCategorias(); } catch (e) { results.categorias_err = e.message; }
  try { results.ventas     = await syncVentas(7); } catch (e) { results.ventas_err     = e.message; }
  try { results.cajas      = await syncCajas(); } catch (e) { results.cajas_err      = e.message; }

  const ok = Object.values(results).some(v => v !== null && !String(v).includes('err'));
  console.log(`[REVO] ${ok ? '✓' : '✗'} Sync:`, JSON.stringify(results));
  return { success: ok, ...results };
}

// ── Lectura de datos para el cerebro ────────────────────────────────────────
export const getRevoProductos = () => loadJSON(path.join(REVO_DIR, 'productos.json'), { items: [] });
export const getRevoVentas    = () => loadJSON(path.join(REVO_DIR, 'ventas.json'), []);
export const getRevoResumen   = () => loadJSON(path.join(REVO_DIR, 'resumen_diario.json'), {});
export const getRevoCajas     = () => loadJSON(path.join(REVO_DIR, 'cajas.json'), { items: [] });
