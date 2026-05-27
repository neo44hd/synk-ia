/**
 * System API Routes - Monitorización y Control Centralizado
 * GET /api/system/* - Información de sistema
 * POST /api/system/action - Ejecutar acciones
 */

import express from 'express';
import PM2Service from '../services/pm2Service.js';
import SystemService from '../services/systemService.js';
import LogsService from '../services/logsService.js';
import OllamaService from '../services/ollamaService.js';

export const systemRouter = express.Router();

/**
 * GET /api/system/health
 * Estado de todos los servicios
 */
systemRouter.get('/health', async (req, res) => {
  try {
    const pm2Status = await PM2Service.getSummary();
    const systemMetrics = SystemService.getSystemMetrics();
    const ollamaStatus = await OllamaService.getSummary();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        pm2: {
          processes: pm2Status.total,
          online: pm2Status.online,
          stopped: pm2Status.stopped,
          errored: pm2Status.errored,
          status: pm2Status.online === pm2Status.total ? 'healthy' : 'warning'
        },
        system: {
          cpu_percent: systemMetrics.memory.percent,
          memory_mb: systemMetrics.memory.used,
          platform: systemMetrics.platform,
          uptime: Math.round(systemMetrics.uptime / 3600)
        },
        ollama: {
          installed: ollamaStatus.installed,
          running: ollamaStatus.running,
          models: ollamaStatus.total_models,
          status: ollamaStatus.installed ? 'available' : 'not_installed'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system/metrics
 * Métricas del sistema en tiempo real
 */
systemRouter.get('/metrics', async (req, res) => {
  try {
    const summary = await SystemService.getFullSummary();
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system/logs
 * Obtener logs (query params: service=, lines=100, type=pm2|app|error)
 */
systemRouter.get('/logs', async (req, res) => {
  try {
    const { service = '', lines = 100, type = 'pm2' } = req.query;
    let logs;

    switch (type) {
      case 'app':
        logs = await LogsService.getAppLogs(parseInt(lines));
        break;
      case 'error':
        logs = await LogsService.getErrorLogs(parseInt(lines));
        break;
      case 'system':
        logs = await LogsService.getSystemLogs(parseInt(lines));
        break;
      case 'pm2':
      default:
        logs = await LogsService.getPM2Logs(service, parseInt(lines));
    }

    res.json({ success: true, type, service, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system/agents
 * Lista de procesos PM2 (agentes/servicios)
 */
systemRouter.get('/agents', async (req, res) => {
  try {
    const pm2Status = await PM2Service.getSummary();
    res.json({
      success: true,
      total: pm2Status.total,
      online: pm2Status.online,
      stopped: pm2Status.stopped,
      errored: pm2Status.errored,
      agents: pm2Status.processes
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system/models
 * Estado de modelos IA (Ollama, etc.)
 */
systemRouter.get('/models', async (req, res) => {
  try {
    const ollamaStatus = await OllamaService.getSummary();
    res.json({
      success: true,
      providers: {
        ollama: ollamaStatus
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system/ports
 * Puertos en uso y conexiones de red
 */
systemRouter.get('/ports', async (req, res) => {
  try {
    const metrics = await SystemService.getFullSummary();
    res.json({
      success: true,
      ports: metrics.ports,
      networks: metrics.networks,
      total_ports: metrics.ports.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system/config
 * Configuración actual del sistema
 */
systemRouter.get('/config', async (req, res) => {
  try {
    const metrics = SystemService.getSystemMetrics();
    const ollamaConfig = await OllamaService.getConfig();
    const disk = await SystemService.getDiskUsage();

    res.json({
      success: true,
      system: {
        platform: metrics.platform,
        arch: metrics.arch,
        hostname: metrics.hostname,
        cpus: metrics.cpus,
        cpu_model: metrics.cpu_model
      },
      resources: {
        memory_total_mb: metrics.memory.total,
        disk: disk
      },
      services: {
        ollama: ollamaConfig
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/system/action
 * Ejecutar acciones (restart, logs clear, etc.)
 * Body: { action: 'restart_service', target: 'sinkia-api' }
 */
systemRouter.post('/action', async (req, res) => {
  try {
    const { action, target } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, error: 'action required' });
    }

    let result;

    switch (action) {
      case 'restart_service':
        if (!target) {
          return res.status(400).json({ success: false, error: 'target required' });
        }
        result = await PM2Service.restartProcess(target);
        break;

      case 'get_service_logs':
        if (!target) {
          return res.status(400).json({ success: false, error: 'target required' });
        }
        const logs = await PM2Service.getProcessLogs(target, 100);
        result = { success: true, logs };
        break;

      case 'search_logs':
        const { query } = req.body;
        if (!query) {
          return res.status(400).json({ success: false, error: 'query required' });
        }
        result = await LogsService.searchLogs(query);
        break;

      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system/dashboard
 * Dashboard completo - resumen de todo
 */
systemRouter.get('/dashboard', async (req, res) => {
  try {
    const pm2Status = await PM2Service.getSummary();
    const systemMetrics = SystemService.getSystemMetrics();
    const ollamaStatus = await OllamaService.getSummary();
    const ports = await SystemService.getActivePorts();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      overview: {
        services_online: pm2Status.online,
        services_total: pm2Status.total,
        cpu_usage: Math.round(systemMetrics.memory.percent),
        memory_used_mb: systemMetrics.memory.used,
        memory_total_mb: systemMetrics.memory.total,
        uptime_hours: Math.round(systemMetrics.uptime / 3600)
      },
      processes: pm2Status.processes.slice(0, 5),
      models: {
        installed: ollamaStatus.installed,
        count: ollamaStatus.total_models,
        running: ollamaStatus.running
      },
      ports_active: ports.length,
      top_ports: ports.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default systemRouter;
