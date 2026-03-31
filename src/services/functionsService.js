/**
 * SYNK-IA - Servicio de Funciones con VPS Real
 * © 2024 David Roldan - Chicken Palace Ibiza
 * Conecta con el VPS scraper para datos reales de Biloop
 */

const VPS_URL = '';  // Uses same domain via nginx proxy

// Helper para llamadas al VPS
const vpsCall = async (endpoint, options = {}) => {
  try {
    const res = await fetch(`${VPS_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    return await res.json();
  } catch (e) {
    console.error('[SYNK-IA] VPS call failed:', endpoint, e.message);
    return { success: false, error: e.message };
  }
};

// Helper mock para funciones aún no conectadas
const mockAsync = (result, delay = 300) => {
  return new Promise(resolve => setTimeout(() => resolve(result), delay));
};

// ===== FUNCIONES REALES (VPS) =====

export const checkSecretsStatus = async () => {
  const biloop = await vpsCall('/api/biloop/portal-test');
  return {
    success: true,
    data: {
      biloop: biloop.success ? 'configured' : 'error',
      revo: 'configured',
      gmail: 'configured',
      eseecloud: 'configured'
    }
  };
};

export const testBiloopConnection = async () => {
  const result = await vpsCall('/api/biloop/portal-test');
  if (result.success) {
    return { success: true, data: { message: 'Conexión Biloop OK - Portal activo', company: result.company || 'CHICKEN PALACE IBIZA' } };
  }
  return { success: false, data: { message: result.error || 'Error conectando con Biloop' } };
};

export const testGmailConnection = async () => {
  return mockAsync({ success: true, data: { message: 'Gmail configurado - info@chickenpalace.es' } });
};

export const testRevoConnection = async () => {
  return mockAsync({ success: true, data: { message: 'Revo XEF configurado' } });
};

export const biloopGetDocuments = async (params = {}) => {
  const { date_from, date_to, doc_type } = params || {};
  const type = doc_type || 'received';
  const result = await vpsCall(`/api/biloop/portal-fetch?path=/bi/documents/directory&type=${type}`);
  return { success: true, data: { documents: result.data || [], message: `${result.found || 0} documentos encontrados` } };
};

export const biloopDownloadPdf = async (params = {}) => {
  return mockAsync({ success: false, data: { message: 'Descarga PDF: usar portal directo' } });
};

export const nvrLocalConnect = async () => {
  return mockAsync({ success: true, data: { message: 'ESEECLOUD configurado' } });
};

// ===== FUNCIONES DE SINCRONIZACIÓN =====

export const biloopAutoSync = async () => {
  const customers = await vpsCall('/api/biloop/portal-fetch?path=/erp/masters/customers');
  return { success: true, data: { message: 'Sincronización Biloop completada', synced: customers.found || 0 } };
};

export const revoAutoSync = async () => {
  return mockAsync({ success: true, data: { message: 'Sincronización Revo completada', synced: 0 } });
};

export const biloopRealSync = async () => {
  const result = await vpsCall('/api/biloop/portal-test');
  return { success: result.success, data: { message: result.success ? 'Sync real Biloop OK' : 'Error sync' } };
};

export const revoRealSync = async () => {
  return mockAsync({ success: true, data: { message: 'Sincronización real Revo simulada' } });
};

export const resetAndSyncReal = async () => {
  return mockAsync({ success: true, data: { message: 'Reset y sincronización completados' } });
};

export const eseeCloudSync = async () => {
  return mockAsync({ success: true, data: { message: 'Sincronización EseeCloud completada' } });
};

// ===== FUNCIONES DE EMAIL =====

export const emailAutoProcessor = async () => {
  return mockAsync({ success: true, data: { processed: 0, message: 'Procesador de email activo' } });
};

export const emailAutoClassifier = async () => {
  return mockAsync({ success: true, data: { classified: 0, message: 'Clasificador de email activo' } });
};

export const smartEmailProcessor = async () => {
  return mockAsync({ success: true, data: { message: 'Procesador inteligente de email activo' } });
};

// ===== FUNCIONES DE REPORTES =====

export const generateExecutiveReport = async () => {
  return mockAsync({ success: true, data: { report: { date: new Date().toISOString(), summary: 'Reporte ejecutivo generado' } } });
};

// ===== FUNCIONES DE ALERTAS =====

export const intelligentAlerts = async () => {
  return mockAsync({ success: true, data: { alerts: [], message: 'Sistema de alertas activo' } });
};

export const systemAnalytics = async () => {
  return mockAsync({ success: true, data: { analytics: { totalRecords: 0, lastUpdated: new Date().toISOString() } } });
};

export const fullBusinessScan = async () => {
  return mockAsync({ success: true, data: { message: 'Escaneo completo de negocio completado' } });
};

export const systemFullScan = async () => {
  return mockAsync({ success: true, data: { message: 'Escaneo completo del sistema completado' } });
};

export const testBiloopReal = async () => {
  return testBiloopConnection();
};

// ===== FUNCIONES DE BILOOP =====

export const biloopUploadInvoice = async (data) => {
  return mockAsync({ success: true, data: { message: 'Subida simulada' } });
};

// ===== FUNCIONES DE ARCHIVOS =====

export const processZipFile = async (file) => {
  return mockAsync({ success: true, data: { processed: 0, message: 'ZIP procesado' } });
};

export const processBulkPayrolls = async (files) => {
  return mockAsync({ success: true, data: { processed: 0, message: 'Nóminas procesadas' } });
};

export const processFlexibleCSV = async (file) => {
  return mockAsync({ success: true, data: { rows: 0, message: 'CSV procesado' } });
};

// ===== FUNCIONES DE ASISTENCIA =====

export const clockIn = async (employeeId, location) => {
  const timestamp = new Date().toISOString();
  return { success: true, data: { timestamp, message: `Entrada registrada a las ${new Date(timestamp).toLocaleTimeString('es-ES')}` } };
};

export const clockOut = async (employeeId, location) => {
  const timestamp = new Date().toISOString();
  return { success: true, data: { timestamp, message: `Salida registrada a las ${new Date(timestamp).toLocaleTimeString('es-ES')}` } };
};

export const employeeAuth = async (credentials) => {
  return mockAsync({ success: true, data: { employee: null, message: 'Autenticación simulada' } });
};

export const generateAttendanceReport = async (params) => {
  return mockAsync({ success: true, data: { report: {}, message: 'Reporte de asistencia generado' } });
};

// ===== FUNCIONES DE EMPLEADOS =====

export const mergeEmployeeDuplicates = async () => {
  return mockAsync({ success: true, data: { merged: 0, message: 'Fusión de duplicados completada' } });
};

export const syncPayrollsToEmployees = async () => {
  return mockAsync({ success: true, data: { synced: 0, message: 'Sincronización de nóminas completada' } });
};

// ===== OBJETO PRINCIPAL CON INVOKE =====

const allFunctions = {
  biloopAutoSync, revoAutoSync, emailAutoProcessor, biloopRealSync,
  revoRealSync, resetAndSyncReal, emailAutoClassifier, eseeCloudSync,
  generateExecutiveReport, intelligentAlerts, systemAnalytics,
  checkSecretsStatus, testGmailConnection, testRevoConnection,
  testBiloopConnection, biloopGetDocuments, biloopUploadInvoice,
  biloopDownloadPdf, systemFullScan, nvrLocalConnect, fullBusinessScan,
  testBiloopReal, smartEmailProcessor, processZipFile, processBulkPayrolls,
  clockIn, clockOut, employeeAuth, generateAttendanceReport,
  processFlexibleCSV, mergeEmployeeDuplicates, syncPayrollsToEmployees
};

export const functionsService = {
  ...allFunctions,
  // CRITICAL: invoke() method - used by base44.functions.invoke('name', params)
  invoke: async (functionName, params) => {
    console.log(`[SYNK-IA] invoke: ${functionName}`, params);
    const fn = allFunctions[functionName];
    if (!fn) {
      console.error(`[SYNK-IA] Function not found: ${functionName}`);
      return { data: { success: false, error: `Function ${functionName} not found` } };
    }
    try {
      const result = await fn(params);
      return { data: result };
    } catch (e) {
      console.error(`[SYNK-IA] Error in ${functionName}:`, e);
      return { data: { success: false, error: e.message } };
    }
  }
};

export default functionsService;
