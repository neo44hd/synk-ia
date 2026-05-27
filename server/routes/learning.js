/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEARNING ROUTES — Endpoints para Learning Engine
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Endpoints:
 * GET  /api/learning/metrics           - Obtener métricas actuales
 * GET  /api/learning/history           - Historial de correcciones
 * GET  /api/learning/training-data     - Datos para reentrenamiento
 * GET  /api/learning/insights          - Insights generados
 * GET  /api/learning/report            - Reporte completo
 * 
 * POST /api/learning/record            - Registrar predicción
 * POST /api/feedback                   - Registrar feedback/corrección
 * POST /api/feedback/batch             - Registrar múltiples feedbacks
 */

import express from 'express';
import learningEngine from '../services/learningEngine.js';
import learningAgent from '../agents/learningAgent.js';

export const learningRouter = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning/metrics
// Obtener métricas actuales de precisión y desempeño
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.get('/metrics', async (req, res) => {
  try {
    const metrics = await learningEngine.calculateMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    console.error('[LEARNING] /metrics error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning/history
// Historial de correcciones y mejoras
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.get('/history', async (req, res) => {
  try {
    const { limit = 50, type, agent, startDate, endDate } = req.query;

    const history = await learningEngine.getImprovalHistory({
      limit: parseInt(limit, 10),
      type,
      agentName: agent,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    console.error('[LEARNING] /history error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning/training-data
// Datos preparados para reentrenamiento incremental
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.get('/training-data', async (req, res) => {
  try {
    const { type, minSamples = 5, onlyCorrect = false } = req.query;

    const trainingData = await learningEngine.getTrainingData({
      type,
      minSamples: parseInt(minSamples, 10),
      onlyCorrect: onlyCorrect === 'true',
    });

    res.json({
      success: true,
      data: trainingData,
    });
  } catch (err) {
    console.error('[LEARNING] /training-data error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning/insights
// Insights generados por el Learning Agent
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.get('/insights', async (req, res) => {
  try {
    const insights = await learningAgent.generateInsights();

    res.json({
      success: true,
      data: insights,
    });
  } catch (err) {
    console.error('[LEARNING] /insights error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning/recommendations
// Recomendaciones de optimización
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.get('/recommendations', async (req, res) => {
  try {
    const recommendations = await learningAgent.getOptimizationRecommendations();

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (err) {
    console.error('[LEARNING] /recommendations error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning/report
// Reporte completo de aprendizaje
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.get('/report', async (req, res) => {
  try {
    const report = await learningAgent.generateLearningReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    console.error('[LEARNING] /report error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning/search
// Buscar registros de aprendizaje
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" es requerido',
      });
    }

    const results = await learningEngine.searchRecords(q);

    res.json({
      success: true,
      query: q,
      count: results.length,
      data: results.slice(0, 50),
    });
  } catch (err) {
    console.error('[LEARNING] /search error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/learning/record
// Registrar una nueva predicción
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.post('/record', async (req, res) => {
  try {
    const { type, prediction, confidence, rawInput, agentName } = req.body;

    if (!type || !agentName) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: type, agentName',
      });
    }

    const record = await learningEngine.recordPrediction({
      type,
      prediction,
      confidence: confidence || 0.5,
      rawInput,
      agentName,
    });

    res.json({
      success: true,
      data: record,
    });
  } catch (err) {
    console.error('[LEARNING] /record error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback
// Registrar corrección o feedback del usuario
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.post('/feedback', async (req, res) => {
  try {
    const {
      predictionId,
      correction,
      reason,
      quality,
      usefulness,
      suggestion,
      userEmail,
    } = req.body;

    if (!predictionId) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: predictionId',
      });
    }

    let result;

    // Si hay corrección → registrar como corrección
    if (correction !== undefined) {
      result = await learningEngine.recordCorrection({
        predictionId,
        correction,
        reason,
        userEmail: userEmail || 'anonymous',
      });
    }

    // Si hay feedback (quality/usefulness) → registrar feedback
    if (quality !== undefined || usefulness !== undefined || suggestion) {
      const feedback = await learningEngine.recordFeedback({
        predictionId,
        quality,
        usefulness,
        suggestion,
        userEmail: userEmail || 'anonymous',
      });

      if (!result) result = feedback;
    }

    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere al menos: correction, quality, usefulness o suggestion',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[LEARNING] /feedback error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback/batch
// Registrar múltiples feedbacks en un lote
// ─────────────────────────────────────────────────────────────────────────────

learningRouter.post('/feedback/batch', async (req, res) => {
  try {
    const { feedbacks = [] } = req.body;

    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de feedbacks',
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < feedbacks.length; i++) {
      try {
        const fb = feedbacks[i];

        let result;
        if (fb.correction !== undefined) {
          result = await learningEngine.recordCorrection({
            predictionId: fb.predictionId,
            correction: fb.correction,
            reason: fb.reason,
            userEmail: fb.userEmail || 'batch',
          });
        }

        if (fb.quality !== undefined || fb.usefulness !== undefined) {
          const feedback = await learningEngine.recordFeedback({
            predictionId: fb.predictionId,
            quality: fb.quality,
            usefulness: fb.usefulness,
            suggestion: fb.suggestion,
            userEmail: fb.userEmail || 'batch',
          });
          if (!result) result = feedback;
        }

        if (result) results.push(result);
      } catch (err) {
        errors.push({
          index: i,
          error: err.message,
        });
      }
    }

    res.json({
      success: errors.length === 0,
      processed: results.length,
      errors: errors.length > 0 ? errors : undefined,
      data: results,
    });
  } catch (err) {
    console.error('[LEARNING] /feedback/batch error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default learningRouter;
