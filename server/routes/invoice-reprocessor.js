/**
 * API Routes: Invoice Reprocessor
 * 
 * Endpoints para controlar el reprocessamiento automático de facturas antiguas
 * - Detecta facturas sin análisis o análisis obsoletos
 * - Reprocessa con nuevas directrices automáticamente
 * - Usa OpenRouter Free o Ollama como fallback
 */

import express from 'express';
import { getReprocessor } from '../services/invoiceReprocessor.js';

const router = express.Router();
const reprocessor = getReprocessor();

/**
 * POST /api/invoice/reprocessor/start
 * Inicia el reprocessamiento automático en background
 * 
 * Body: {
 *   intervalMs: number (default 60000),
 *   lookbackDays: number (default 30),
 *   maxAge: number (default 86400000),
 *   batchSize: number (default 2),
 *   useOpenRouter: boolean (default true),
 *   guidelines: object (nuevas directrices personalizadas)
 * }
 */
router.post('/start', async (req, res) => {
  try {
    const {
      intervalMs = 60000,
      lookbackDays = 30,
      maxAge = 86400000,
      batchSize = 2,
      useOpenRouter = true,
      guidelines = {}
    } = req.body;

    // Configurar data source (debe venir en el contexto del app)
    const dataSource = {
      // Métodos que deben ser proporcionados por la aplicación
      getReprocessingCandidates: async (opts) => {
        // Implementar según tu BD
        // Debe retornar array de facturas candidatas para reprocessamiento
        console.log('[DataSource] getReprocessingCandidates llamado con:', opts);
        return [];
      },
      updateAnalysis: async (data) => {
        // Implementar según tu BD
        // Guardar análisis actualizado
        console.log('[DataSource] updateAnalysis llamado para:', data.invoice_id);
      }
    };

    reprocessor.start(dataSource, intervalMs, {
      lookbackDays,
      maxAge,
      batchSize,
      useOpenRouter,
      guidelines
    });

    res.json({
      success: true,
      message: 'Reprocessador iniciado',
      config: {
        intervalMs,
        lookbackDays,
        batchSize,
        useOpenRouter
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/invoice/reprocessor/stop
 * Detiene el reprocessamiento automático
 */
router.post('/stop', async (req, res) => {
  try {
    reprocessor.stop();

    res.json({
      success: true,
      message: 'Reprocessador detenido',
      stats: reprocessor.getStats()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/invoice/reprocessor/stats
 * Obtiene estadísticas del reprocessador
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = reprocessor.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/invoice/reprocessor/status
 * Obtiene estado actual (corriendo o no)
 */
router.get('/status', async (req, res) => {
  try {
    const stats = reprocessor.getStats();

    res.json({
      success: true,
      isRunning: stats.isRunning,
      reprocessedCount: stats.reprocessedCount,
      failedCount: stats.failedCount,
      queueSize: stats.reprocessing || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/invoice/reprocessor/reprocess-now
 * Fuerza reprocessamiento inmediato de una factura específica
 * 
 * Body: { invoice_id: string, useOpenRouter: boolean }
 */
router.post('/reprocess-now', async (req, res) => {
  try {
    const { invoice_id, useOpenRouter = true } = req.body;

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere invoice_id'
      });
    }

    // Simular reprocessamiento (necesitaría implementación real con DB)
    res.json({
      success: true,
      message: `Reprocessamiento iniciado para factura ${invoice_id}`,
      note: 'Requiere implementación con BD real'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/invoice/reprocessor/update-guidelines
 * Actualiza las directrices de reprocessamiento
 * 
 * Body: {
 *   guidelines: {
 *     detectInflation: boolean,
 *     checkCompliance: boolean,
 *     evaluateESG: boolean,
 *     compareBenchmarks: boolean,
 *     findAutomation: boolean,
 *     customRules: [...]
 *   }
 * }
 */
router.post('/update-guidelines', async (req, res) => {
  try {
    const { guidelines = {} } = req.body;

    // Actualizar opciones del reprocessador
    if (reprocessor.options) {
      reprocessor.options.guidelines = guidelines;
    }

    res.json({
      success: true,
      message: 'Directrices actualizadas',
      guidelines: reprocessor.options?.guidelines || {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Event listeners para logging/debugging
 */
reprocessor.on('started', (data) => {
  console.log('[Reprocessor API] ✅ Iniciado:', data);
});

reprocessor.on('stopped', (stats) => {
  console.log('[Reprocessor API] ⏹️  Detenido. Stats:', stats);
});

reprocessor.on('candidates-detected', (data) => {
  console.log('[Reprocessor API] 🔍 Detectadas', data.count, 'facturas');
});

reprocessor.on('invoice-reprocessed', (data) => {
  console.log('[Reprocessor API] ✅ Reprocessada:', data.invoice_id);
});

reprocessor.on('reprocessing-failed', (data) => {
  console.log('[Reprocessor API] ❌ Error:', data.invoice_id, '-', data.error);
});

reprocessor.on('batch-complete', (stats) => {
  console.log('[Reprocessor API] 🎉 Lote completo:', stats);
});

reprocessor.on('error', (data) => {
  console.error('[Reprocessor API] 💥 Error:', data.error);
});

export default router;
