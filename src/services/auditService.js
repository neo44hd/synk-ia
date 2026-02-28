/**
 * SYNK-IA Audit Service
 * Logs critical actions for security and compliance tracking
 */

const AUDIT_LOG_KEY = 'synkia_audit_logs';
const MAX_LOGS = 1000; // Maximum logs to keep

// Action types for categorization
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  
  // Data modifications
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  
  // Exports and downloads
  EXPORT_DATA: 'EXPORT_DATA',
  EXPORT_BACKUP: 'EXPORT_BACKUP',
  DOWNLOAD_DOCUMENT: 'DOWNLOAD_DOCUMENT',
  
  // Critical operations
  IMPORT_DATA: 'IMPORT_DATA',
  SYNC_EXTERNAL: 'SYNC_EXTERNAL',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  
  // User management
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  
  // Compliance
  COMPLIANCE_CHECK: 'COMPLIANCE_CHECK',
  INSPECTION_EXPORT: 'INSPECTION_EXPORT',
  
  // Financial
  INVOICE_PAID: 'INVOICE_PAID',
  PAYROLL_PROCESSED: 'PAYROLL_PROCESSED',
  
  // Error tracking
  ERROR: 'ERROR',
  WARNING: 'WARNING'
};

// Severity levels
export const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  ERROR: 'error'
};

class AuditService {
  constructor() {
    this.currentUser = null;
  }

  /**
   * Set the current user for audit logging
   */
  setCurrentUser(user) {
    this.currentUser = user;
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    if (this.currentUser) return this.currentUser;
    
    // Try to get from localStorage
    try {
      const userData = localStorage.getItem('synkia_current_user');
      if (userData) {
        return JSON.parse(userData);
      }
    } catch (e) {
      console.warn('Could not get user from storage');
    }
    
    return { id: 'anonymous', name: 'Usuario Anónimo', email: '' };
  }

  /**
   * Log an audit event
   */
  log(action, details = {}, severity = SEVERITY.INFO) {
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
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      ip: 'client-side' // Note: Real IP would need server-side logging
    };

    this.saveLog(logEntry);
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', logEntry);
    }

    return logEntry;
  }

  /**
   * Save log to localStorage
   */
  saveLog(logEntry) {
    try {
      const logs = this.getLogs();
      logs.unshift(logEntry);
      
      // Trim to max logs
      if (logs.length > MAX_LOGS) {
        logs.splice(MAX_LOGS);
      }
      
      localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save audit log:', e);
    }
  }

  /**
   * Get all audit logs
   */
  getLogs() {
    try {
      const data = localStorage.getItem(AUDIT_LOG_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to get audit logs:', e);
      return [];
    }
  }

  /**
   * Get logs with filters
   */
  getFilteredLogs(filters = {}) {
    let logs = this.getLogs();
    
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
   * Get audit statistics
   */
  getStats() {
    const logs = this.getLogs();
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
   * Clear all logs (admin only)
   */
  clearLogs() {
    this.log(AUDIT_ACTIONS.DELETE, { target: 'audit_logs', message: 'Audit logs cleared' }, SEVERITY.CRITICAL);
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify([]));
  }

  /**
   * Export logs to JSON
   */
  exportLogs() {
    const logs = this.getLogs();
    const exportData = {
      exportDate: new Date().toISOString(),
      totalLogs: logs.length,
      logs
    };
    
    this.log(AUDIT_ACTIONS.EXPORT_DATA, { target: 'audit_logs', count: logs.length });
    
    return exportData;
  }

  // Convenience methods for common actions
  logLogin(user) {
    this.setCurrentUser(user);
    localStorage.setItem('synkia_current_user', JSON.stringify(user));
    return this.log(AUDIT_ACTIONS.LOGIN, { userId: user?.id, email: user?.email });
  }

  logLogout() {
    const result = this.log(AUDIT_ACTIONS.LOGOUT);
    this.currentUser = null;
    localStorage.removeItem('synkia_current_user');
    return result;
  }

  logCreate(entity, entityId, details = {}) {
    return this.log(AUDIT_ACTIONS.CREATE, { entity, entityId, ...details });
  }

  logUpdate(entity, entityId, changes = {}) {
    return this.log(AUDIT_ACTIONS.UPDATE, { entity, entityId, changes });
  }

  logDelete(entity, entityId, details = {}) {
    return this.log(AUDIT_ACTIONS.DELETE, { entity, entityId, ...details }, SEVERITY.WARNING);
  }

  logExport(exportType, details = {}) {
    return this.log(AUDIT_ACTIONS.EXPORT_DATA, { exportType, ...details });
  }

  logError(errorMessage, details = {}) {
    return this.log(AUDIT_ACTIONS.ERROR, { error: errorMessage, ...details }, SEVERITY.ERROR);
  }

  logConfigChange(configKey, oldValue, newValue) {
    return this.log(AUDIT_ACTIONS.CONFIG_CHANGE, { configKey, oldValue, newValue }, SEVERITY.WARNING);
  }
}

export const auditService = new AuditService();
export default auditService;
