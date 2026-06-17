/**
 * Sinkia Control Brain - Main Express Server
 * Centralizado dashboard y orquestación de agentes
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { db, Task } from './db.js';
import { GatewayClient } from './gateway-client.js';
import { sinkiaClient, SinkiaStatus } from './sinkia-client.js';
import { orchestrator } from './orchestrator.js';
import { metricsCollector } from './metrics.js';

dotenv.config({ path: '../../.env' });

const app: Express = express();
const PORT = process.env.CONTROL_BRAIN_PORT || 3002;
const gatewayClient = new GatewayClient();

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * GET /api/control/status
 * Estado general del sistema
 */
app.get('/api/control/status', async (req: Request, res: Response) => {
  try {
    const [gatewayHealth, sinkiaStatus, recentTasks, alerts] = await Promise.all([
      gatewayClient.getHealth(),
      sinkiaClient.getStatus(),
      db.getRecentTasks(5),
      db.getActiveAlerts(),
    ]);

    const metrics = metricsCollector.getProviderStats();

    res.json({
      success: true,
      timestamp: Date.now(),
      system: {
        gateway_alive: gatewayHealth.alive,
        sinkia_online: sinkiaStatus.online,
        gateway_online: sinkiaStatus.gateway_online,
      },
      metrics: {
        total_tasks: metricsCollector.getTotalTasks(),
        total_cost: metricsCollector.getTotalCost(),
        avg_latency_ms: metricsCollector.getAverageLatency(),
        provider_stats: metrics,
      },
      recent_tasks: recentTasks.slice(0, 3),
      active_alerts: alerts.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/control/agents
 * Lista todos los agentes y su estado
 */
app.get('/api/control/agents', async (req: Request, res: Response) => {
  try {
    const sinkiaStatus = await sinkiaClient.getStatus();

    const agents = [
      { name: 'classifier', status: sinkiaStatus.online ? 'online' : 'offline' },
      { name: 'analyzer', status: sinkiaStatus.online ? 'online' : 'offline' },
      { name: 'documentAgent', status: sinkiaStatus.online ? 'online' : 'offline' },
      { name: 'extractorAgent', status: sinkiaStatus.online ? 'online' : 'offline' },
      { name: 'learningAgent', status: sinkiaStatus.online ? 'online' : 'offline' },
    ];

    res.json({
      success: true,
      agents,
      gateway_online: sinkiaStatus.gateway_online,
      models: sinkiaStatus.models,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/control/gateway
 * Estado del gateway LiteLLM
 */
app.get('/api/control/gateway', async (req: Request, res: Response) => {
  try {
    const [health, models] = await Promise.all([
      gatewayClient.getHealth(),
      gatewayClient.listModels(),
    ]);

    res.json({
      success: true,
      health: health.alive ? 'healthy' : 'unhealthy',
      health_error: health.error,
      models_count: models.length,
      models: models.map((m) => m.id),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/control/task
 * Crear una nueva tarea orquestada
 * Body: { prompt: string, preferredAgent?: string, preferredModel?: string }
 */
app.post('/api/control/task', async (req: Request, res: Response) => {
  try {
    const { prompt, preferredAgent, preferredModel } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt requerido' });
    }

    const taskId = uuidv4();
    const startTime = Date.now();

    // Crear tarea en DB
    const task: Task = {
      id: taskId,
      prompt,
      agent: preferredAgent || 'unknown',
      model: preferredModel || 'auto',
      provider: 'gateway',
      status: 'processing',
      start_time: startTime,
    };

    await db.insertTask(task);

    // Rutear tarea
    const routing = await orchestrator.routeTask({
      prompt,
      preferredAgent,
      preferredModel,
    });

    // Ejecutar tarea
    const result = await orchestrator.executeTask(routing.agent, prompt, routing.model);

    // Actualizar en DB
    const latency = Date.now() - startTime;
    await db.updateTaskStatus(taskId, result.success ? 'completed' : 'failed', 
      JSON.stringify(result.result), latency);

    // Registrar métrica
    metricsCollector.recordTask('gateway', latency, result.cost || 0);

    res.json({
      success: result.success,
      task_id: taskId,
      result: result.result,
      routing: routing,
      latency_ms: latency,
      cost: result.cost,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/control/task/:id
 * Obtener estado y resultado de una tarea
 */
app.get('/api/control/task/:id', async (req: Request, res: Response) => {
  try {
    const task = await db.getTask(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
    }

    res.json({
      success: true,
      task,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/control/tasks
 * Obtener historial de tareas recientes
 */
app.get('/api/control/tasks', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const tasks = await db.getRecentTasks(limit);

    res.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/control/metrics
 * Obtener métricas y estadísticas
 */
app.get('/api/control/metrics', async (req: Request, res: Response) => {
  try {
    const stats = metricsCollector.getProviderStats();

    res.json({
      success: true,
      summary: {
        total_tasks: metricsCollector.getTotalTasks(),
        total_cost: metricsCollector.getTotalCost(),
        avg_latency_ms: metricsCollector.getAverageLatency(),
      },
      provider_stats: stats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/control/alerts
 * Obtener alertas activas
 */
app.get('/api/control/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await db.getActiveAlerts();

    res.json({
      success: true,
      alerts,
      count: alerts.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧠 Sinkia Control Brain Backend`);
  console.log(`📡 Running on http://localhost:${PORT}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log('Available endpoints:');
  console.log(`  GET    /api/control/status`);
  console.log(`  GET    /api/control/agents`);
  console.log(`  GET    /api/control/gateway`);
  console.log(`  POST   /api/control/task`);
  console.log(`  GET    /api/control/tasks`);
  console.log(`  GET    /api/control/task/:id`);
  console.log(`  GET    /api/control/metrics`);
  console.log(`  GET    /api/control/alerts`);
  console.log(`  GET    /health\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  db.close();
  process.exit(0);
});
