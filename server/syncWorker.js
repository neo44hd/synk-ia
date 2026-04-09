// ═══════════════════════════════════════════════════════════════════════════
//  SYNC WORKER — Orquestador de agentes 24/7
//  Delega en los agentes especializados:
//    • emailAgent  → correo IMAP + procesamiento de adjuntos con IA
//    • revoAgent   → TPV Revo XEF (ventas, artículos, cajas) — sin IA
//    • webAgent    → tienda online (pendiente)
// ═══════════════════════════════════════════════════════════════════════════

import {
  syncEmails,
  getEmails,
} from './agents/emailAgent.js';

import {
  syncRevo,
  getRevoProductos,
  getRevoVentas,
  getRevoCajas,
  getRevoResumen,
} from './agents/revoAgent.js';

// ── Estado compartido ────────────────────────────────────────────────────────
const INTERVALS = {
  email: 5  * 60 * 1000,   // 5 minutos
  revo:  15 * 60 * 1000,   // 15 minutos
};

const lastSync    = { email: null, revo: null };
const syncResults = { email: null, revo: null };
let   workerRunning = false;

// ── Runners individuales ─────────────────────────────────────────────────────
async function runEmailSync() {
  console.log('[SYNC-WORKER] ▶ Iniciando emailAgent...');
  try {
    syncResults.email = await syncEmails();
    lastSync.email    = new Date().toISOString();
    const r = syncResults.email;
    if (r.success) {
      console.log(`[SYNC-WORKER] ✓ Email: ${r.new_emails ?? 0} nuevos, ${r.processed ?? 0} procesados`);
    } else {
      console.warn('[SYNC-WORKER] ⚠ Email:', r.error || 'fallo sin detalle');
    }
  } catch (e) {
    console.error('[SYNC-WORKER] ✗ emailAgent crash:', e.message);
    syncResults.email = { success: false, error: e.message };
  }
}

async function runRevoSync() {
  console.log('[SYNC-WORKER] ▶ Iniciando revoAgent...');
  try {
    syncResults.revo = await syncRevo();
    lastSync.revo    = new Date().toISOString();
    const r = syncResults.revo;
    if (r.success) {
      console.log(`[SYNC-WORKER] ✓ Revo: ${r.productos ?? 0} productos, ${r.ventas_nuevas ?? 0} ventas nuevas`);
    } else {
      console.warn('[SYNC-WORKER] ⚠ Revo:', r.error || 'fallo sin detalle');
    }
  } catch (e) {
    console.error('[SYNC-WORKER] ✗ revoAgent crash:', e.message);
    syncResults.revo = { success: false, error: e.message };
  }
}

// ── Arranque principal ───────────────────────────────────────────────────────
export function startSyncWorker() {
  if (workerRunning) {
    console.warn('[SYNC-WORKER] Ya estaba corriendo, ignorando arranque duplicado');
    return;
  }
  workerRunning = true;

  console.log('[SYNC-WORKER] ✓ Arrancado');
  console.log(`[SYNC-WORKER]   Email cada ${INTERVALS.email / 60000} min`);
  console.log(`[SYNC-WORKER]   Revo  cada ${INTERVALS.revo  / 60000} min`);

  // Primera sincronización con retardo para no bloquear el arranque del servidor
  setTimeout(() => runEmailSync(), 12_000);   // 12s → email
  setTimeout(() => runRevoSync(),  18_000);   // 18s → revo

  // Sincronizaciones periódicas
  setInterval(() => runEmailSync(), INTERVALS.email);
  setInterval(() => runRevoSync(),  INTERVALS.revo);
}

// ── Estado público (usado por /api/health y paneles) ────────────────────────
export function getSyncStatus() {
  return {
    running:   workerRunning,
    lastSync,
    results:   syncResults,
    intervals: INTERVALS,
  };
}

// ── Accesores de datos (backward-compat con rutas antiguas) ──────────────────
export { getEmails };
export const getProducts   = () => getRevoProductos();
export const getCategories = () => getRevoResumen();
export const getSales      = () => getRevoVentas();
export { getRevoProductos, getRevoVentas, getRevoCajas, getRevoResumen };
