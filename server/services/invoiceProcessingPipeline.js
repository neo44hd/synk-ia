/**
 * Pipeline de Procesamiento de Facturas - Cadena de Montaje
 * 
 * Orquesta el flujo completo:
 * JSON (raw) → Normalize → Markdown → Analyze → Compare → Results
 * 
 * Cada etapa emite eventos para subscribers
 */

import { EventEmitter } from 'events';

class InvoiceProcessingPipeline extends EventEmitter {
  constructor() {
    super();
    this.stages = [
      'extracted',
      'normalized',
      'markdown_generated',
      'analyzed',
      'compared',
      'completed'
    ];
  }

  /**
   * Ejecuta el pipeline completo para una factura
   * @param {Object} invoiceJSON - Factura JSON raw
   * @param {Object} options - Opciones {generator, analyzer}
   * @returns {Promise<Object>} Resultado procesado
   */
  async processInvoice(invoiceJSON, options = {}) {
    const { generator, analyzer } = options;
    
    if (!generator || !analyzer) {
      throw new Error('Se requieren generator y analyzer en options');
    }

    const pipeline = {
      id: invoiceJSON.id || `invoice_${Date.now()}`,
      stages: {}
    };

    try {
      // ETAPA 1: Validar entrada
      this.emit('stage:start', { stage: 'extracted', data: invoiceJSON });
      pipeline.stages.extracted = {
        success: true,
        timestamp: new Date().toISOString(),
        data: invoiceJSON
      };
      this.emit('stage:complete', { stage: 'extracted' });

      // ETAPA 2: Normalizar
      this.emit('stage:start', { stage: 'normalized' });
      const normalized = this._normalizeInvoice(invoiceJSON);
      pipeline.stages.normalized = {
        success: true,
        timestamp: new Date().toISOString(),
        data: normalized
      };
      this.emit('stage:complete', { stage: 'normalized' });

      // ETAPA 3: Generar Markdown
      this.emit('stage:start', { stage: 'markdown_generated' });
      const markdown = generator.generateInvoiceMarkdown(normalized);
      pipeline.stages.markdown_generated = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          markdown,
          length: markdown.length,
          lines: markdown.split('\n').length
        }
      };
      this.emit('stage:complete', { stage: 'markdown_generated' });

      // ETAPA 4: Analizar con LLM
      this.emit('stage:start', { stage: 'analyzed' });
      // const prompt = generator.generateInvoiceAnalysisPrompt(markdown); // Para debugging
      const analysis = analyzer.simulateLLMAnalysis(markdown, 'invoice');
      const processedAnalysis = analyzer.processLLMResponse(analysis);
      pipeline.stages.analyzed = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          analysis: processedAnalysis,
          alerts: analyzer.analysisToUIAlerts(processedAnalysis)
        }
      };
      this.emit('stage:complete', { stage: 'analyzed' });

      // ETAPA 5: Comparar (preparado para futuro)
      this.emit('stage:start', { stage: 'compared' });
      pipeline.stages.compared = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          ready_for_comparison: true,
          recommended_comparisons: ['provider_prices', 'invoice_patterns']
        }
      };
      this.emit('stage:complete', { stage: 'compared' });

      // COMPLETAR
      this.emit('stage:start', { stage: 'completed' });
      pipeline.stages.completed = {
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          total_stages: Object.keys(pipeline.stages).length,
          all_successful: true,
          invoice_id: pipeline.id
        }
      };
      this.emit('stage:complete', { stage: 'completed' });

      return {
        success: true,
        pipeline,
        invoice_id: pipeline.id,
        markdown: pipeline.stages.markdown_generated.data,
        analysis: pipeline.stages.analyzed.data
      };
    } catch (error) {
      this.emit('stage:error', { error: error.message });
      return {
        success: false,
        error: error.message,
        pipeline
      };
    }
  }

  /**
   * Procesa un proveedor completo con todas sus facturas
   * @param {Object} provider - Datos del proveedor
   * @param {Array} invoices - Facturas del proveedor
   * @param {Object} options - {generator, analyzer}
   * @returns {Promise<Object>} Resultado procesado
   */
  async processProvider(provider, invoices = [], options = {}) {
    const { generator, analyzer } = options;
    
    if (!generator || !analyzer) {
      throw new Error('Se requieren generator y analyzer en options');
    }

    const pipeline = {
      id: provider.id || `provider_${Date.now()}`,
      stages: {}
    };

    try {
      // ETAPA 1: Validar
      this.emit('stage:start', { stage: 'extracted', data: { provider, invoice_count: invoices.length } });
      pipeline.stages.extracted = {
        success: true,
        timestamp: new Date().toISOString(),
        data: { provider, invoice_count: invoices.length }
      };
      this.emit('stage:complete', { stage: 'extracted' });

      // ETAPA 2: Normalizar proveedor
      this.emit('stage:start', { stage: 'normalized' });
      const normalized = this._normalizeProvider(provider);
      const normalizedInvoices = invoices.map(inv => this._normalizeInvoice(inv));
      pipeline.stages.normalized = {
        success: true,
        timestamp: new Date().toISOString(),
        data: { provider: normalized, invoice_count: normalizedInvoices.length }
      };
      this.emit('stage:complete', { stage: 'normalized' });

      // ETAPA 3: Generar Markdown del Proveedor
      this.emit('stage:start', { stage: 'markdown_generated' });
      const markdown = generator.generateProviderMarkdown(normalized, normalizedInvoices);
      pipeline.stages.markdown_generated = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          markdown,
          length: markdown.length,
          lines: markdown.split('\n').length
        }
      };
      this.emit('stage:complete', { stage: 'markdown_generated' });

      // ETAPA 4: Analizar con LLM
      this.emit('stage:start', { stage: 'analyzed' });
      const analysis = analyzer.simulateLLMAnalysis(markdown, 'provider');
      const processedAnalysis = analyzer.processLLMResponse(analysis);
      pipeline.stages.analyzed = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          analysis: processedAnalysis,
          alerts: analyzer.analysisToUIAlerts(processedAnalysis)
        }
      };
      this.emit('stage:complete', { stage: 'analyzed' });

      // ETAPA 5: Comparar
      this.emit('stage:start', { stage: 'compared' });
      pipeline.stages.compared = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          total_spend: normalizedInvoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0),
          invoice_count: normalizedInvoices.length,
          analysis_ready: true
        }
      };
      this.emit('stage:complete', { stage: 'compared' });

      // COMPLETAR
      this.emit('stage:start', { stage: 'completed' });
      pipeline.stages.completed = {
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          provider_id: pipeline.id,
          all_successful: true,
          invoices_processed: normalizedInvoices.length
        }
      };
      this.emit('stage:complete', { stage: 'completed' });

      return {
        success: true,
        pipeline,
        provider_id: pipeline.id,
        markdown: pipeline.stages.markdown_generated.data,
        analysis: pipeline.stages.analyzed.data,
        invoices_processed: normalizedInvoices.length
      };
    } catch (error) {
      this.emit('stage:error', { error: error.message });
      return {
        success: false,
        error: error.message,
        pipeline
      };
    }
  }

  /**
   * Normaliza datos de factura
   * @private
   */
  _normalizeInvoice(invoice) {
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number || 'S/N',
      provider_name: invoice.provider_name || '',
      provider_cif: invoice.provider_cif || '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      subtotal: Number(invoice.subtotal) || Number(invoice.base) || 0,
      iva: Number(invoice.iva) || 0,
      total: Number(invoice.total) || 0,
      items: (invoice.items || []).map(item => ({
        description: item.description || item.concepto,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'ud',
        unit_price: Number(item.unit_price) || Number(item.price) || 0,
        vat: item.vat || 21,
        total: Number(item.total) || 0
      })),
      status: invoice.status || 'procesada',
      category: invoice.category || 'otros'
    };
  }

  /**
   * Normaliza datos de proveedor
   * @private
   */
  _normalizeProvider(provider) {
    return {
      id: provider.id,
      nombre: provider.nombre || provider.name || '',
      cif_nif: provider.cif_nif || provider.cif || '',
      tipo_entidad: provider.tipo_entidad || 'empresa',
      direccion: provider.direccion || provider.address || '',
      email: provider.email || '',
      telefono: provider.telefono || provider.phone || '',
      status: provider.status || 'activo',
      deduplication_key: provider.deduplication_key || '',
      approved_by_user: provider.approved_by_user || false
    };
  }

  /**
   * Suscribirse a cambios de etapa
   */
  onStageComplete(stage, callback) {
    this.on(`stage:complete`, (data) => {
      if (data.stage === stage) callback(data);
    });
  }

  onStageError(callback) {
    this.on('stage:error', callback);
  }
}

export default InvoiceProcessingPipeline;
