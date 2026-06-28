/**
 * Invoice Auto Processor
 * 
 * Servicio que automáticamente procesa facturas pendientes en background
 * - Detecta facturas sin análisis
 * - Genera markdown y análisis
 * - Guarda resultados
 * - Emite eventos para UI
 */

import InvoiceProcessingPipeline from './invoiceProcessingPipeline.js';
import * as generator from './invoiceMarkdownGenerator.js';
import * as analyzer from './invoiceMarkdownAnalyzer.js';
import { EventEmitter } from 'events';

class InvoiceAutoProcessor extends EventEmitter {
  constructor() {
    super();
    this.pipeline = new InvoiceProcessingPipeline();
    this.isRunning = false;
    this.processedCount = 0;
    this.failedCount = 0;
    this.queueSize = 0;
  }

  /**
   * Inicia procesamiento automático periódico
   * @param {Object} dataSource - Objeto con métodos para obtener/guardar datos
   * @param {number} intervalMs - Intervalo en ms (default 30000 = 30s)
   */
  start(dataSource, intervalMs = 30000) {
    if (this.isRunning) {
      console.log('[AutoProcessor] Ya está en ejecución');
      return;
    }

    this.isRunning = true;
    this.dataSource = dataSource;
    
    console.log(`[AutoProcessor] ✅ Iniciado (intervalo: ${intervalMs}ms)`);
    this.emit('started');

    // Primera ejecución inmediata
    this._processPendingInvoices();

    // Luego periódicamente
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this._processPendingInvoices();
      }
    }, intervalMs);
  }

  /**
   * Detiene procesamiento automático
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    clearInterval(this.intervalId);
    
    console.log('[AutoProcessor] ⏹️  Detenido');
    this.emit('stopped');
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      queueSize: this.queueSize,
      uptime: new Date().toISOString()
    };
  }

  /**
   * Procesa facturas pendientes (privado)
   * @private
   */
  async _processPendingInvoices() {
    try {
      // Obtener facturas sin análisis
      const pendingInvoices = await this.dataSource.getPendingInvoices?.();
      
      if (!pendingInvoices || pendingInvoices.length === 0) {
        this.queueSize = 0;
        this.emit('no-pending');
        return;
      }

      this.queueSize = pendingInvoices.length;
      this.emit('queue-updated', { size: this.queueSize });

      console.log(`[AutoProcessor] 📋 Procesando ${pendingInvoices.length} factura(s) pendiente(s)`);

      // Procesar en lotes
      const BATCH_SIZE = 3;
      for (let i = 0; i < pendingInvoices.length; i += BATCH_SIZE) {
        const batch = pendingInvoices.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.allSettled(
          batch.map(inv => this._processSingleInvoice(inv))
        );

        // Procesar resultados
        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            this.processedCount++;
            this.emit('invoice-processed', {
              invoice_id: batch[idx].id,
              success: true,
              alerts: result.value.alerts?.length || 0
            });
          } else {
            this.failedCount++;
            this.emit('invoice-failed', {
              invoice_id: batch[idx].id,
              error: result.reason?.message || 'Error desconocido'
            });
          }
        });
      }

      this.queueSize = 0;
      this.emit('batch-complete', {
        processed: this.processedCount,
        failed: this.failedCount
      });

    } catch (error) {
      console.error('[AutoProcessor] Error procesando lote:', error.message);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Procesa una factura individual
   * @private
   */
  async _processSingleInvoice(invoice) {
    try {
      // Procesar con pipeline
      const result = await this.pipeline.processInvoice(invoice, {
        generator,
        analyzer
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Guardar resultado
      if (this.dataSource.saveAnalysis) {
        await this.dataSource.saveAnalysis({
          invoice_id: result.invoice_id,
          markdown: result.markdown.markdown,
          analysis: result.analysis.analysis,
          alerts: result.analysis.alerts,
          processed_at: new Date().toISOString()
        });
      }

      return {
        invoice_id: result.invoice_id,
        alerts: result.analysis.alerts
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Procesa una factura manual (on-demand)
   */
  async processNow(invoice) {
    console.log(`[AutoProcessor] 🔄 Procesando factura ${invoice.id} (on-demand)`);
    
    try {
      const result = await this._processSingleInvoice(invoice);
      this.emit('manual-process-success', result);
      return result;
    } catch (error) {
      this.emit('manual-process-error', { error: error.message });
      throw error;
    }
  }
}

/**
 * Instancia singleton
 */
let processorInstance = null;

export function getAutoProcessor() {
  if (!processorInstance) {
    processorInstance = new InvoiceAutoProcessor();
  }
  return processorInstance;
}

export default InvoiceAutoProcessor;
