/**
 * functionsService.js — FIXED
 *
 * Cambios respecto al original:
 * 1. /api/ollama/* → /api/ai/* (compatible: el nuevo ai.js registra ambos paths)
 * 2. /api/ollama/health → /api/ai/status (endpoint existente, antes faltaba)
 * 3. /api/revo/workers → /api/revo/workers (endpoint añadido en revo.js fix)
 * 4. /api/biloop/sync → /api/biloop/sync (endpoint añadido en biloop.js fix)
 * 5. Todos los fetch con manejo de error unificado
 * 6. fullDataSync mejorado: no bloquea si un servicio falla
 * 7. invoke() para compatibilidad con base44.functions.invoke()
 */
// ─── Helper de fetch con error handling ──────────────────────────────────────
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[functionsService] Error en ${url}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── AI / Ollama (ahora apunta a node-llama-cpp) ─────────────────────────────
export const ollamaHealth = () =>
  apiFetch('/api/ai/status'); // FIX: antes /api/ollama/health (no existía)

export const ollamaModels = () =>
  apiFetch('/api/ai/models');

export const ollamaClassify = (text, filename) =>
  apiFetch('/api/ai/classify', { // FIX: /api/ollama → /api/ai
    method: 'POST',
    body: JSON.stringify({ text, filename }),
  });

export const ollamaClassifyEmail = (subject, body, from) =>
  apiFetch('/api/ai/classify-email', {
    method: 'POST',
    body: JSON.stringify({ subject, body, from }),
  });

export const ollamaGenerate = (prompt, system, format = 'text') =>
  apiFetch('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, system, format, temperature: 0.2 }),
  });

// ─── Email ───────────────────────────────────────────────────────────────────
export const fetchEmails = (params = {}) => {
  const q = new URLSearchParams({ folder: 'INBOX', limit: 100, ...params });
  return apiFetch(`/api/email/fetch-page?${q}`);
};

export const scanEmails = (params = {}) => {
  const q = new URLSearchParams({ since: '2025-01-01', limit: 200, ...params });
  return apiFetch(`/api/email/scan?${q}`);
};

export const fetchPayslips = (params = {}) => {
  const q = new URLSearchParams({ since: '2025-01-01', limit: 100, ...params });
  return apiFetch(`/api/email/payslips?${q}`);
};

export const fetchInvoices = (params = {}) => {
  const q = new URLSearchParams({ since: '2025-01-01', limit: 100, ...params });
  return apiFetch(`/api/email/invoices?${q}`);
};

export const testEmailConnection = () =>
  apiFetch('/api/email/test');

// ─── Revo POS ─────────────────────────────────────────────────────────────────
export const fetchRevoProducts = () =>
  apiFetch('/api/revo/products');

export const fetchRevoCategorias = () =>
  apiFetch('/api/revo/categories');

export const fetchRevoSales = (params = {}) => {
  const q = new URLSearchParams({ days: 30, ...params });
  return apiFetch(`/api/revo/sales?${q}`);
};

export const syncRevoWorkers = () => // FIX: endpoint antes faltaba
  apiFetch('/api/revo/workers');

// ─── Biloop ───────────────────────────────────────────────────────────────────
export const syncBiloopData = () => // FIX: endpoint antes faltaba
  apiFetch('/api/biloop/sync');

export const getBiloopSyncStatus = () =>
  apiFetch('/api/biloop/sync-status');

export const fetchBiloopDocuments = (params = {}) => {
  const q = new URLSearchParams(params);
  return apiFetch(`/api/biloop/documents?${q}`);
};

// ─── Health ───────────────────────────────────────────────────────────────────
export const serverHealth = () =>
  apiFetch('/api/health');

// ─── invoke() — Compatibilidad con base44.functions.invoke('nombre', params) ─
// Mapea nombres de funciones antiguas a endpoints reales del backend
const FUNCTION_MAP = {
  biloopRealSync: () => apiFetch('/api/biloop/sync', { method: 'POST' }),
  processZipFile: (params) => apiFetch('/api/biloop/process-zip', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  syncEmailInvoices: (params) => apiFetch('/api/email/invoices', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  fullSync: () => fullDataSync(),
};

export async function invoke(functionName, params = {}) {
  console.log(`[functionsService] invoke('${functionName}')`, params);
  const fn = FUNCTION_MAP[functionName];
  if (!fn) {
    console.warn(`[functionsService] Función '${functionName}' no mapeada, intentando /api/functions/${functionName}`);
    return apiFetch(`/api/functions/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
  const result = await fn(params);
  // Wrap in { data: ... } para compatibilidad con base44 SDK
  return { data: result };
}

// ─── Sync completo (resiliente: un fallo no para los demás) ──────────────────
export async function fullDataSync() {
  const results = {};
  const tasks = [
    ['emails', () => scanEmails()],
    ['revo', () => fetchRevoProducts()],
    ['payslips', () => fetchPayslips()],
    ['biloop', () => syncBiloopData()],
  ];

  // Corre todas en paralelo — si una falla, las demás continúan
  const settled = await Promise.allSettled(tasks.map(([, fn]) => fn()));
  tasks.forEach(([key], i) => {
    const r = settled[i];
    results[key] = r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message };
    if (r.status === 'rejected') {
      console.warn(`[fullDataSync] ${key} falló:`, r.reason?.message);
    }
  });

  // Persiste en el backend via /api/data (reemplaza localStorage)
  const syncToBackend = async (entity, records) => {
    try {
      await fetch(`/api/data/${entity}/bulk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, merge: true }),
      });
    } catch (e) {
      console.warn(`[fullDataSync] No se pudo sincronizar ${entity}:`, e.message);
    }
  };

  if (results.emails?.documents) await syncToBackend('emailmessage', results.emails.documents);
  if (results.revo?.products) await syncToBackend('product', results.revo.products);
  if (results.payslips?.payslips) await syncToBackend('payroll', results.payslips.payslips);

  return { success: true, results, timestamp: new Date().toISOString() };
}

// ── Export nombrado que espera base44Client.js ────────────────────────────────
// base44Client.js hace: import { functionsService } from './functionsService'
export const functionsService = {
  invoke,
  ollamaHealth,
  ollamaModels,
  ollamaClassify,
  ollamaClassifyEmail,
  ollamaGenerate,
  fetchEmails,
  scanEmails,
  fetchPayslips,
  fetchInvoices,
  testEmailConnection,
  fetchRevoProducts,
  fetchRevoCategorias,
  fetchRevoSales,
  syncRevoWorkers,
  syncBiloopData,
  getBiloopSyncStatus,
  fetchBiloopDocuments,
  serverHealth,
  fullDataSync,
};
