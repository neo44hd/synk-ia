/**
 * Intelligence Routes - API de Clasificación Automática
 * 
 * POST /api/classify              - Clasificar texto/documento
 * POST /api/classify/feedback     - Registrar feedback del usuario
 * GET /api/classify/stats         - Estadísticas del clasificador
 * GET /api/classify/history       - Historial de clasificaciones
 */

import express from 'express';
import aiClassifier from '../services/aiClassifier.js';

const router = express.Router();

// ── Auth ────────────────────────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const DEV_MODE = process.env.DISABLE_TAILSCALE_AUTH === 'true';
const auth = (req, res, next) => {
  if (DEV_MODE) return next();
  if (req.fromTailscale) return next();
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t !== ADMIN_TOKEN) return res.status(401).json({ error: 'No autorizado' });
  next();
};

/**
 * POST /api/classify
 * Clasificar un documento/texto
 * 
 * Body: {
 *   "text": "string - texto a clasificar",
 *   "documentId": "optional - ID del documento",
 *   "filename": "optional - nombre del archivo",
 *   "mimeType": "optional - tipo MIME"
 * }
 * 
 * Response: {
 *   "id": "cls_...",
 *   "classification": {
 *     "tipo": { "value": "Factura", "confidence": 85 },
 *     "departamento": { "value": "Finanzas", "confidence": 90 },
 *     "urgencia": { "value": "Normal", "confidence": 70 },
 *     "estado": { "value": "Nuevo", "confidence": 95 }
 *   },
 *   "metadata": { ... },
 *   "ollamaUsed": true,
 *   "timestamp": "2026-05-27T..."
 * }
 */
router.post('/', auth, async (req, res) => {
  try {
    const { text, documentId, filename, mimeType } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Clasificar
    const result = await aiClassifier.classify(text, {
      documentId,
      filename,
      mimeType
    });

    res.json({ ok: true, result });
  } catch (err) {
    console.error('[Intelligence] Classification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/classify/feedback
 * Registrar correcciones del usuario para mejorar el modelo
 * 
 * Body: {
 *   "classificationId": "cls_...",
 *   "corrected": {
 *     "tipo": "Presupuesto",
 *     "departamento": "Compras",
 *     "urgencia": "Urgente",
 *     "estado": "Procesado"
 *   }
 * }
 * 
 * Response: {
 *   "ok": true,
 *   "message": "Feedback recorded"
 * }
 */
router.post('/feedback', auth, async (req, res) => {
  try {
    const { classificationId, corrected } = req.body;

    if (!classificationId || !corrected) {
      return res.status(400).json({ 
        error: 'classificationId and corrected are required' 
      });
    }

    const success = aiClassifier.recordFeedback(classificationId, corrected);

    if (!success) {
      return res.status(404).json({ 
        error: 'Classification not found' 
      });
    }

    res.json({ 
      ok: true, 
      message: 'Feedback recorded successfully' 
    });
  } catch (err) {
    console.error('[Intelligence] Feedback error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/classify/stats
 * Obtener estadísticas del clasificador
 * 
 * Response: {
 *   "total_classifications": 42,
 *   "correct_classifications": 38,
 *   "accuracy_percentage": 90,
 *   "classifications_per_category": {
 *     "tipo": { "Factura": 20, "Presupuesto": 15, ... },
 *     "departamento": { "Finanzas": 25, "Compras": 17, ... },
 *     ...
 *   }
 * }
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = aiClassifier.getStats();
    res.json({ ok: true, stats });
  } catch (err) {
    console.error('[Intelligence] Stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/classify/history
 * Obtener historial de clasificaciones
 * Query params:
 *   - limit: número de resultados (default 50)
 *   - offset: para paginación (default 0)
 *   - tipo: filtrar por tipo
 *   - departamento: filtrar por departamento
 * 
 * Response: {
 *   "ok": true,
 *   "total": 42,
 *   "history": [
 *     {
 *       "id": "cls_...",
 *       "timestamp": "2026-05-27T...",
 *       "classification": { ... },
 *       "metadata": { ... },
 *       "feedback": null or { ... }
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/history', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, tipo, departamento } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 500);
    const offsetNum = parseInt(offset) || 0;

    const classifications = aiClassifier.classifications.feedback || [];

    // Filtrar si se especifica
    let filtered = classifications;
    if (tipo) {
      filtered = filtered.filter(c => c.classification.tipo.value === tipo);
    }
    if (departamento) {
      filtered = filtered.filter(c => c.classification.departamento.value === departamento);
    }

    // Ordenar descendente por timestamp
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Paginar
    const history = filtered.slice(offsetNum, offsetNum + limitNum);

    res.json({
      ok: true,
      total: filtered.length,
      limit: limitNum,
      offset: offsetNum,
      history
    });
  } catch (err) {
    console.error('[Intelligence] History error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/classify/breakdown
 * Desglose de clasificaciones por categoría
 * 
 * Response: {
 *   "ok": true,
 *   "breakdown": {
 *     "tipo": { "Factura": 20, "Presupuesto": 15, ... },
 *     "departamento": { "Finanzas": 25, "Compras": 17, ... },
 *     "urgencia": { "Normal": 35, "Urgente": 7, ... },
 *     "estado": { "Nuevo": 30, "Procesado": 12, ... }
 *   }
 * }
 */
router.get('/breakdown', auth, async (req, res) => {
  try {
    const breakdown = aiClassifier.getBreakdown();
    res.json({ ok: true, breakdown });
  } catch (err) {
    console.error('[Intelligence] Breakdown error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
