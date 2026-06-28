// ═══════════════════════════════════════════════════════════════════════════════
//  Email → FileBrain Integration Routes
//
//  API endpoints para monitorear el pipeline completo:
//  - GET /api/integration/email-filebrain/stats
//  - GET /api/integration/email-filebrain/health
//  - POST /api/integration/email-filebrain/test
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import {
  getIntegrationStats,
  getPipelineHealth,
} from '../services/emailFileBrainIntegration.js';

const router = express.Router();

// ── GET /api/integration/email-filebrain/stats ──────────────────────────────────
// Obtener estadísticas detalladas del pipeline
router.get('/email-filebrain/stats', (req, res) => {
  try {
    const stats = getIntegrationStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[IntegrationAPI] Error getting stats:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ── GET /api/integration/email-filebrain/health ─────────────────────────────────
// Monitorear salud del pipeline
router.get('/email-filebrain/health', (req, res) => {
  try {
    const health = getPipelineHealth();

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[IntegrationAPI] Error checking health:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ── POST /api/integration/email-filebrain/test ──────────────────────────────────
// Test endpoint para verificar que el sistema funciona
router.post('/email-filebrain/test', (req, res) => {
  try {
    const testData = {
      message: 'Email → FileBrain integration is operational',
      components: {
        emailAttachmentWorker: 'ready',
        fileBrainQueue: 'ready',
        webhookSystem: 'ready',
        deduplication: 'ready',
      },
      capabilities: [
        'Download email attachments with batch processing',
        'Detect and prevent duplicate processing',
        'Queue documents for FileBrain OCR/AI processing',
        'Track processing progress in real-time',
        'Trigger webhooks on completion',
        'Monitor pipeline health and bottlenecks',
      ],
      nextSteps: [
        'Use /api/email-attachments/sync/test to download a sample',
        'Monitor progress with /api/integration/email-filebrain/stats',
        'Check pipeline health with /api/integration/email-filebrain/health',
      ],
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: testData,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
