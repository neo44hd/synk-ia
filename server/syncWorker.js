// ═══════════════════════════════════════════════════════════════════════════
//  SYNC WORKER — Orquestador de agentes 24/7
//  Delega en los agentes especializados:
//    • emailAgent  → correo IMAP + procesamiento IA unificado
//    • revoAgent   → TPV Revo XEF (ventas, artículos, cajas) — sin IA
//    • webAgent    → tienda online (pendiente)
//
//  CAMBIO v2: emailAgent ahora es el pipeline unificado que escribe
//             en documents.json + entities.json (fuente única para Brain)
// ═══════════════════════════════════════════════════════════════════════════

import {
  syncEmails,
  getEmails,
  getDocuments,
  getEntities,
  getEmailStats,
} from './agents/emailAgent.js';

// import {
//   syncRevo,
//   getRevoProductos,
//   getRevoVentas,
//   getRevoCajas,
//   getRevoResumen,
// } from './agents/revoAgent.js';  // DESACTIVADO — API denegada por Revo

import { syncAll } from './services/dataSync.js';

// ── Estado compartido ────────────────────────────────────────────────────────
const INTERVALS = {
  email: 5  * 60 * 1000,   // 5 minutos
  // revo:  15 * 60 * 1000,   // DESACTIVADO
};

const lastSync    = { email: null };
const syncResults = { email: null };
let   workerRunning = false;

// ── Runners individuales ─────────────────────────────────────────────────────
async function runEmailSync() {
  console.log('[SYNC-WORKER] ▶ Iniciando emailAgent...');
  try {
    syncResults.email = await syncEmails();
    lastSync.email    = new Date().toISOString();
    const r = syncResults.email;
    if (r.success) {
      console.log(`[SYNC-WORKER] ✓ Email: ${r.nuevos ?? 0} nuevos, ${r.con_documentos ?? 0} con documentos, ${r.procesados ?? 0} procesados con IA`);
      // Sincronizar entidades después de cada ciclo de email
      try { syncAll(); } catch (e) { console.error('[SYNC-WORKER] dataSync error:', e.message); }
    } else {
      console.warn('[SYNC-WORKER] ⚠ Email:', r.error || 'fallo sin detalle');
    }
  } catch (e) {
    console.error('[SYNC-WORKER] ✗ emailAgent crash:', e.message);
    syncResults.email = { success: false, error: e.message };
  }
}

// runRevoSync — DESACTIVADO (API denegada por Revo)

// ── Arranque principal ───────────────────────────────────────────────────────
export function startSyncWorker() {
  if (workerRunning) {
    console.warn('[SYNC-WORKER] Ya estaba corriendo, ignorando arranque duplicado');
    return;
  }
  workerRunning = true;

  console.log('[SYNC-WORKER] ✓ Arrancado (pipeline unificado)');
  console.log(`[SYNC-WORKER]   Email cada ${INTERVALS.email / 60000} min (con IA)`);
  console.log('[SYNC-WORKER]   Revo: desactivado');

  // Primera sincronización con retardo para no bloquear el arranque del servidor
  setTimeout(() => runEmailSync(), 12_000);   // 12s → email
  // setTimeout(() => runRevoSync(),  18_000);   // DESACTIVADO

  // Sincronizaciones periódicas
  setInterval(() => runEmailSync(), INTERVALS.email);
  // setInterval(() => runRevoSync(),  INTERVALS.revo);  // DESACTIVADO
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

// ── Accesores de datos ──────────────────────────────────────────────────────
export { getEmails, getDocuments, getEntities, getEmailStats };
export const getProducts   = () => [];
export const getCategories = () => ({});
export const getSales      = () => [];
export const getRevoProductos = () => [];
export const getRevoVentas    = () => [];
export const getRevoCajas     = () => [];
export const getRevoResumen   = () => ({});
