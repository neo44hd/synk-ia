/**
 * SYNK-IA Audit Service
 * Registra acciones críticas para seguimiento de seguridad y cumplimiento
 * Migrado: localStorage → /api/data/auditlog (persistencia en servidor)
 */

import authService from './authService';

const API_BASE = '/api/data/auditlog';
const MAX_LOGS = 1000;

// Caché en memoria para lecturas rápidas
let _logsCache = null;

// Tipos de acción para categorización
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  EXPORT_DATA: 'EXPORT_DATA',
  EXPORT_BACKUP: 'EXPORT_BACKUP',
  DOWNLOAD_DOCUMENT: 'DOWNLOAD_DOCUMENT',
  IMPORT_DATA: 'IMPORT_DATA',
  SYNC_EXTERNAL: 'SYNC_EXTERNAL',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  COMPLIANCE_CHECK: 'COMPLIANCE_CHECK',
  INSPECTION_EXPORT: 'INSPECTION_EXPORT',
  INVOICE_PAID: 'INVOICE_PAID',
  PAYROLL_PROCESSED: 'PAYROLL_PROCESSED',
  ERROR: 'ERROR',
  WARNING: 'WARNING'
};

// Niveles de severidad
export const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  ERROR: 'error'
};

// Helpers para API
async function apiGet(url) {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AuditService] API no disponible:', err.message);
    return null;
  }
}

async function apiPost(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AuditService] Error guardando:', err.message);
    return null;
  }
}

async function apiBulkReplace(records) {
  try {
    const res = await fetch(`${API_BASE}/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, merge: false }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AuditService] Error en bulk replace:', err.message);
    return null;
  }
}

class AuditService {
  constructor() {
    this.currentUser = null;
  }

  setCurrentUser(user) {
    this.currentUser = user;
  }

  getCurrentUser() {
    if (this.currentUser) return this.currentUser;
    // Obtener del authService (ya migrado a JWT)
    const cached = authService.getCachedUser();
    if (cached) return cached;
    return { id: 'anonymous', name: 'Usuario Anónimo', email: '' };
  }

  /**
   * Registrar un evento de auditoría
   */
  async log(action, details = {}, severity = SEVERITY.INFO) {
    const user = this.getCurrentUser();
    const timestamp = new Date().toISOString();

    const logEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      action,
      severity,
      user: {
        id: user?.id || 'unknown',
        name: user?.name || 'Unknown User',
        email: user?.email || ''
      },
      details: {
        ...details,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        url: typeof window !== 'undefined' ? window.location.href : ''
      },
      ip: 'client-side'
    };

    await this.saveLog(logEntry);

    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', logEntry);
    }

    return logEntry;
  }

  /**
   * Guardar log en el servidor vía API
   */
  async saveLog(logEntry) {
    // Actualizar caché en memoria
    const logs = await this.getLogs();
    logs.unshift(logEntry);
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }
    _logsCache = logs;

    // Persistir en servidor
    await apiPost(API_BASE, logEntry);
  }

  /**
   * Obtener todos los logs de auditoría
   */
  async getLogs() {
    if (_logsCache) return _logsCache;
    try {
      const result = await apiGet(`${API_BASE}?sort=-timestamp&limit=${MAX_LOGS}`);
      _logsCache = result?.data || [];
      return _logsCache;
    } catch (err) {
      console.warn('[AuditService] Error cargando logs:', err.message);
      return [];
    }
  }

  /**
   * Obtener logs con filtros
   */
  async getFilteredLogs(filters = {}) {
    let logs = await this.getLogs();

    if (filters.action) {
      logs = logs.filter(log => log.action === filters.action);
    }
    if (filters.severity) {
      logs = logs.filter(log => log.severity === filters.severity);
    }
    if (filters.userId) {
      logs = logs.filter(log => log.user?.id === filters.userId);
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      logs = logs.filter(log => new Date(log.timestamp) >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      logs = logs.filter(log => new Date(log.timestamp) <= end);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      logs = logs.filter(log =>
        log.action.toLowerCase().includes(searchLower) ||
        log.user?.name?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.details).toLowerCase().includes(searchLower)
      );
    }

    return logs;
  }

  /**
   * Estadísticas de auditoría
   */
  async getStats() {
    const logs = await this.getLogs();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      total: logs.length,
      today: logs.filter(l => new Date(l.timestamp) >= today).length,
      thisWeek: logs.filter(l => new Date(l.timestamp) >= thisWeek).length,
      byAction: logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      bySeverity: logs.reduce((acc, log) => {
        acc[log.severity] = (acc[log.severity] || 0) + 1;
        return acc;
      }, {}),
      critical: logs.filter(l => l.severity === SEVERITY.CRITICAL).length,
      errors: logs.filter(l => l.severity === SEVERITY.ERROR).length
    };
  }

  /**
   * Limpiar todos los logs (solo admin)
   */
  async clearLogs() {
    await this.log(AUDIT_ACTIONS.DELETE, { target: 'audit_logs', message: 'Audit logs cleared' }, SEVERITY.CRITICAL);
    _logsCache = [];
    await apiBulkReplace([]);
  }

  /**
   * Exportar logs a JSON
   */
  async exportLogs() {
    const logs = await this.getLogs();
    const exportData = {
      exportDate: new Date().toISOString(),
      totalLogs: logs.length,
      logs
    };

    await this.log(AUDIT_ACTIONS.EXPORT_DATA, { target: 'audit_logs', count: logs.length });

    return exportData;
  }

  // Métodos de conveniencia
  async logLogin(user) {
    this.setCurrentUser(user);
    return await this.log(AUDIT_ACTIONS.LOGIN, { userId: user?.id, email: user?.email });
  }

  async logLogout() {
    const result = await this.log(AUDIT_ACTIONS.LOGOUT);
    this.currentUser = null;
    return result;
  }

  async logCreate(entity, entityId, details = {}) {
    return await this.log(AUDIT_ACTIONS.CREATE, { entity, entityId, ...details });
  }

  async logUpdate(entity, entityId, changes = {}) {
    return await this.log(AUDIT_ACTIONS.UPDATE, { entity, entityId, changes });
  }

  async logDelete(entity, entityId, details = {}) {
    return await this.log(AUDIT_ACTIONS.DELETE, { entity, entityId, ...details }, SEVERITY.WARNING);
  }

  async logExport(exportType, details = {}) {
    return await this.log(AUDIT_ACTIONS.EXPORT_DATA, { exportType, ...details });
  }

  async logError(errorMessage, details = {}) {
    return await this.log(AUDIT_ACTIONS.ERROR, { error: errorMessage, ...details }, SEVERITY.ERROR);
  }

  async logConfigChange(configKey, oldValue, newValue) {
    return await this.log(AUDIT_ACTIONS.CONFIG_CHANGE, { configKey, oldValue, newValue }, SEVERITY.WARNING);
  }
}

export const auditService = new AuditService();
export default auditService;
