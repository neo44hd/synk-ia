/**
 * API Routes: Invoice Analysis Pipeline
 * 
 * Endpoints automáticos para procesamiento de facturas
 * JSON → Markdown → Analyze → Results
 */

import express from 'express';
import InvoiceProcessingPipeline from '../services/invoiceProcessingPipeline.js';
import * as generator from '../services/invoiceMarkdownGenerator.js';
import * as analyzer from '../services/invoiceMarkdownAnalyzer.js';

const router = express.Router();

// Instancia global del pipeline
const pipeline = new InvoiceProcessingPipeline();

/**
 * POST /api/invoice/analyze
 * Procesa una factura individual
 * 
 * Body: { invoice: {...} }
 * Returns: { success, invoice_id, markdown, analysis, alerts }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { invoice } = req.body;
    
    if (!invoice || !invoice.id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere invoice con id'
      });
    }

    const result = await pipeline.processInvoice(invoice, {
      generator,
      analyzer
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Retornar resultado formateado
    res.json({
      success: true,
      invoice_id: result.invoice_id,
      markdown: result.markdown.markdown,
      markdown_stats: {
        lines: result.markdown.lines,
        length: result.markdown.length
      },
      analysis: {
        validacion: result.analysis.analysis.validacion,
        anomalias: result.analysis.analysis.anomalias,
        alertas: result.analysis.analysis.alertas,
        insights: result.analysis.analysis.insights,
        recomendaciones: result.analysis.analysis.recomendaciones,
        score_calidad: result.analysis.analysis.score_calidad,
        confianza: result.analysis.analysis.confianza
      },
      ui_alerts: result.analysis.alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/provider/analyze
 * Procesa un proveedor completo con todas sus facturas
 * 
 * Body: { provider: {...}, invoices: [...] }
 * Returns: { success, provider_id, markdown, analysis, alerts, invoices_processed }
 */
router.post('/provider/analyze', async (req, res) => {
  try {
    const { provider, invoices = [] } = req.body;
    
    if (!provider || !provider.id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere provider con id'
      });
    }

    const result = await pipeline.processProvider(provider, invoices, {
      generator,
      analyzer
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Retornar resultado formateado
    res.json({
      success: true,
      provider_id: result.provider_id,
      invoices_processed: result.invoices_processed,
      markdown: result.markdown.markdown,
      markdown_stats: {
        lines: result.markdown.lines,
        length: result.markdown.length
      },
      analysis: {
        clasificacion: result.analysis.analysis.clasificacion,
        tendencias: result.analysis.analysis.tendencias,
        riesgos: result.analysis.analysis.riesgos,
        oportunidades: result.analysis.analysis.oportunidades,
        recomendaciones_estrategicas: result.analysis.analysis.recomendaciones_estrategicas,
        alertas_especiales: result.analysis.analysis.alertas_especiales,
        score_relacion: result.analysis.analysis.score_relacion,
        confianza: result.analysis.analysis.confianza
      },
      ui_alerts: result.analysis.alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/invoice/batch-analyze
 * Procesa múltiples facturas en paralelo
 * 
 * Body: { invoices: [...] }
 * Returns: { success, processed, failed, results }
 */
router.post('/batch-analyze', async (req, res) => {
  try {
    const { invoices = [] } = req.body;
    
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de invoices'
      });
    }

    // Procesar en paralelo con límite
    const BATCH_SIZE = 5;
    const results = [];
    const failed = [];

    for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
      const batch = invoices.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(inv =>
          pipeline.processInvoice(inv, { generator, analyzer })
        )
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.success) {
          results.push({
            invoice_id: result.value.invoice_id,
            success: true,
            alerts_count: result.value.analysis.alerts.length,
            quality_score: result.value.analysis.analysis.score_calidad
          });
        } else {
          failed.push({
            invoice_id: batch[idx]?.id || 'unknown',
            error: result.reason?.message || 'Error desconocido'
          });
        }
      });
    }

    res.json({
      success: true,
      processed: results.length,
      failed: failed.length,
      total: invoices.length,
      results,
      failed_items: failed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/invoice/:id/markdown
 * Obtiene solo el markdown de una factura procesada
 * (asume que ya fue procesada y guardada)
 */
router.get('/:id/markdown', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Aquí iría lectura de DB
    // Por ahora retornar instrucción
    res.json({
      success: false,
      error: 'Endpoint requiere implementación de DB',
      message: 'GET /api/invoice/:id/markdown está listo para DB'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Pipeline Event Listeners (para logging/debugging)
 */
pipeline.on('stage:complete', (data) => {
  console.log(`[Pipeline] ✅ ${data.stage} completado`);
});

pipeline.on('stage:error', (data) => {
  console.error(`[Pipeline] ❌ Error: ${data.error}`);
});

export default router;
