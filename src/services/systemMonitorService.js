/**
 * System Monitor Service - Frontend
 * Comunicación con /api/system/*
 */

const API_BASE = '/api/system';

export const systemMonitorService = {
  /**
   * Obtener health check de todos los servicios
   */
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Health check error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener métricas del sistema
   */
  async getMetrics() {
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Metrics error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener logs
   */
  async getLogs(type = 'pm2', service = '', lines = 100) {
    try {
      const params = new URLSearchParams({ type, service, lines });
      const res = await fetch(`${API_BASE}/logs?${params}`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Logs error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener agentes/procesos
   */
  async getAgents() {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Agents error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener modelos IA
   */
  async getModels() {
    try {
      const res = await fetch(`${API_BASE}/models`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Models error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener puertos activos y redes
   */
  async getPorts() {
    try {
      const res = await fetch(`${API_BASE}/ports`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Ports error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener configuración del sistema
   */
  async getConfig() {
    try {
      const res = await fetch(`${API_BASE}/config`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Config error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener dashboard completo
   */
  async getDashboard() {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Dashboard error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Ejecutar acciones (restart, etc)
   */
  async executeAction(action, target = '', query = '') {
    try {
      const body = { action, target };
      if (query) body.query = query;
      
      const res = await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Action error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtener estadísticas de email
   */
  async getEmailStats() {
    try {
      const res = await fetch('/api/email/stats');
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Email stats error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sincronizar emails
   */
  async syncEmails(processAI = true) {
    try {
      const res = await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ process_ai: processAI, limit: 100 })
      });
      return await res.json();
    } catch (err) {
      console.error('[SystemMonitor] Sync error:', err);
      return { success: false, error: err.message };
    }
  }
};

export default systemMonitorService;
