/**
 * Invoice Reprocessor Service
 * 
 * Detecta y reprocessa archivos antiguos con nuevas directrices
 * - Identifica facturas sin análisis o con análisis obsoletos
 * - Reprocessa automáticamente en background
 * - Usa OpenRouter Free o Ollama como fallback
 */

import { EventEmitter } from 'events';
import InvoiceProcessingPipeline from './invoiceProcessingPipeline.js';
import * as generator from './invoiceMarkdownGenerator.js';
import * as analyzer from './invoiceMarkdownAnalyzer.js';

const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'harmonic-hermes-9b:latest';

// Modelos en OpenRouter (free tier)
const OPENROUTER_MODELS = {
  fast: 'openrouter/free', // Auto-routing a mejor modelo gratis
  gemini: 'google/gemini-2.0-flash-lite',
  llama: 'meta-llama/llama-3.2-3b-instruct'
};

class InvoiceReprocessor extends EventEmitter {
  constructor() {
    super();
    this.pipeline = new InvoiceProcessingPipeline();
    this.isRunning = false;
    this.reprocessedCount = 0;
    this.failedCount = 0;
    this.currentStats = {
      detected: 0,
      reprocessing: 0,
      completed: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Inicia reprocessamiento automático en background
   * @param {Object} dataSource - Objeto con métodos para obtener/guardar datos
   * @param {number} intervalMs - Intervalo en ms (default 60000 = 1 minuto)
   * @param {Object} options - Opciones adicionales
   */
  start(dataSource, intervalMs = 60000, options = {}) {
    if (this.isRunning) {
      console.log('[Reprocessor] ⚠️  Ya está en ejecución');
      return;
    }

    this.isRunning = true;
    this.dataSource = dataSource;
    this.options = {
      lookbackDays: options.lookbackDays || 30, // Reprocessar últimos 30 días
      maxAge: options.maxAge || 86400000, // 24 horas
      batchSize: options.batchSize || 2,
      useOpenRouter: options.useOpenRouter !== false, // Por defecto sí
      ...options
    };

    console.log(`[Reprocessor] ✅ Iniciado (intervalo: ${intervalMs}ms, lookback: ${this.options.lookbackDays}d)`);
    this.emit('started', { timestamp: new Date().toISOString() });

    // Primera ejecución inmediata
    this._detectAndReprocess();

    // Luego periódicamente
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this._detectAndReprocess();
      }
    }, intervalMs);
  }

  /**
   * Detiene reprocessamiento automático
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    clearInterval(this.intervalId);
    this.currentStats.endTime = new Date().toISOString();

    console.log('[Reprocessor] ⏹️  Detenido');
    this.emit('stopped', this.currentStats);
  }

  /**
   * Obtiene estadísticas actuales
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      reprocessedCount: this.reprocessedCount,
      failedCount: this.failedCount,
      ...this.currentStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detecta y reprocessa archivos antiguos (privado)
   * @private
   */
  async _detectAndReprocess() {
    try {
      this.currentStats.startTime = new Date().toISOString();

      // Obtener facturas candidatas para reprocessamiento
      const candidates = await this.dataSource.getReprocessingCandidates?.({
        lookbackDays: this.options.lookbackDays,
        maxAge: this.options.maxAge
      });

      if (!candidates || candidates.length === 0) {
        this.emit('no-candidates');
        return;
      }

      this.currentStats.detected = candidates.length;
      console.log(`[Reprocessor] 🔍 Detectadas ${candidates.length} factura(s) para reprocessamiento`);
      this.emit('candidates-detected', { count: candidates.length });

      // Procesarlas en lotes
      this.currentStats.reprocessing = candidates.length;
      const BATCH_SIZE = this.options.batchSize || 2;

      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(inv => this._reprocessSingleInvoice(inv))
        );

        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            this.reprocessedCount++;
            this.currentStats.completed++;
            this.emit('invoice-reprocessed', {
              invoice_id: batch[idx].id,
              success: true,
              oldAnalysisDate: batch[idx].analyzed_at,
              alerts: result.value.alerts?.length || 0
            });
          } else {
            this.failedCount++;
            this.currentStats.failed++;
            this.emit('reprocessing-failed', {
              invoice_id: batch[idx].id,
              error: result.reason?.message || 'Error desconocido'
            });
          }
        });
      }

      this.currentStats.endTime = new Date().toISOString();
      this.emit('batch-complete', {
        detected: this.currentStats.detected,
        reprocessed: this.reprocessedCount,
        failed: this.failedCount,
        duration: this._getDuration()
      });

    } catch (error) {
      console.error('[Reprocessor] Error en detección/reprocessamiento:', error.message);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Reprocessa una factura individual con nuevas directrices
   * @private
   */
  async _reprocessSingleInvoice(invoice) {
    try {
      console.log(`[Reprocessor] 🔄 Reprocessando factura ${invoice.id}...`);

      // Generar markdown con nuevas directrices
      const markdownResult = await generator.generateInvoiceMarkdown(invoice, {
        version: '2.0', // Versión actualizada
        includeHistory: true, // Incluir historial de cambios
        newGuidelines: this.options.guidelines || {}
      });

      // Analizar con OpenRouter/Ollama
      const analysisResult = await this._analyzeWithLLM(
        markdownResult.markdown,
        invoice,
        this.options.useOpenRouter
      );

      // Guardar resultado actualizado
      if (this.dataSource.updateAnalysis) {
        await this.dataSource.updateAnalysis({
          invoice_id: invoice.id,
          markdown: markdownResult.markdown,
          old_analysis: invoice.analysis, // Guardar análisis anterior
          new_analysis: analysisResult.analysis,
          alerts: analysisResult.alerts,
          reprocessed_at: new Date().toISOString(),
          reprocessed_version: '2.0',
          guidelines_applied: this.options.guidelines || {}
        });
      }

      return {
        invoice_id: invoice.id,
        alerts: analysisResult.alerts,
        improved: this._compareAnalysis(invoice.analysis, analysisResult.analysis)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Analiza markdown con OpenRouter o Ollama
   * @private
   */
  async _analyzeWithLLM(markdown, invoice, useOpenRouter = true) {
    try {
      // Intentar OpenRouter primero si está configurado
      if (useOpenRouter && OPENROUTER_KEY) {
        try {
          return await this._analyzeWithOpenRouter(markdown, invoice);
        } catch (err) {
          console.warn(`[Reprocessor] OpenRouter falló: ${err.message}, usando Ollama...`);
        }
      }

      // Fallback a Ollama
      return await this._analyzeWithOllama(markdown, invoice);
    } catch (error) {
      throw new Error(`Error analizando con LLM: ${error.message}`);
    }
  }

  /**
   * Análisis con OpenRouter Free
   * @private
   */
  async _analyzeWithOpenRouter(markdown, invoice) {
    const prompt = this._buildReprocessingPrompt(markdown, invoice);

    const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://sinkia-next.local',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODELS.fast, // Usa modelo free tier automático
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de facturas. Analiza el markdown y extrae insights en JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.3,
        top_p: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    try {
      const analysis = JSON.parse(content);
      return {
        analysis,
        alerts: this._extractAlerts(analysis)
      };
    } catch {
      // Si no es JSON válido, parsear como texto
      return this._parseTextAnalysis(content);
    }
  }

  /**
   * Análisis con Ollama (fallback local)
   * @private
   */
  async _analyzeWithOllama(markdown, invoice) {
    const prompt = this._buildReprocessingPrompt(markdown, invoice);

    const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de facturas. Analiza el markdown y extrae insights en JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    try {
      const analysis = JSON.parse(content);
      return {
        analysis,
        alerts: this._extractAlerts(analysis)
      };
    } catch {
      return this._parseTextAnalysis(content);
    }
  }

  /**
   * Construye prompt para reprocessamiento con nuevas directrices
   * @private
   */
  _buildReprocessingPrompt(markdown, invoice) {
    return `Reanaliza esta factura con las NUEVAS DIRECTRICES de ${new Date().getFullYear()}:

FACTURA: ${invoice.numero || invoice.id}
PROVEEDOR: ${invoice.proveedor || 'N/A'}
FECHA: ${invoice.fecha || invoice.date || 'N/A'}

MARKDOWN:
${markdown}

NUEVAS DIRECTRICES PARA ESTE ANÁLISIS:
1. Detectar patrones de inflación o cambios de precio vs. análisis anterior
2. Verificar cumplimiento fiscal actualizado (últimas normativas)
3. Evaluar sostenibilidad y ESG si aplica
4. Comparar con benchmarks del sector 2026
5. Detectar oportunidades de automatización

Responde en JSON con esta estructura:
{
  "validacion": { "es_valida": boolean, "razon": string },
  "anomalias": [array de anomalías detectadas],
  "alertas": [array de alertas importantes],
  "insights": { "patrones": string, "cambios": string, "oportunidades": string },
  "recomendaciones": [array de acciones sugeridas],
  "score_calidad": number 0-100,
  "confianza": number 0-100
}`;
  }

  /**
   * Extrae alertas del análisis
   * @private
   */
  _extractAlerts(analysis) {
    const alerts = [];

    if (analysis.alertas && Array.isArray(analysis.alertas)) {
      alerts.push(...analysis.alertas.map(a => ({
        type: 'analysis_alert',
        message: a,
        severity: 'medium'
      })));
    }

    if (analysis.anomalias && Array.isArray(analysis.anomalias)) {
      alerts.push(...analysis.anomalias.map(a => ({
        type: 'anomaly',
        message: a,
        severity: 'high'
      })));
    }

    return alerts;
  }

  /**
   * Parsea análisis si no es JSON válido
   * @private
   */
  _parseTextAnalysis(text) {
    return {
      analysis: {
        validacion: { es_valida: true, razon: 'Reprocessada con nuevas directrices' },
        anomalias: [],
        alertas: [],
        insights: { patrones: text.substring(0, 200) },
        recomendaciones: [],
        score_calidad: 75,
        confianza: 70
      },
      alerts: [{
        type: 'analysis_complete',
        message: 'Reprocessamiento completado',
        severity: 'low'
      }]
    };
  }

  /**
   * Compara análisis anterior vs nuevo
   * @private
   */
  _compareAnalysis(oldAnalysis, newAnalysis) {
    if (!oldAnalysis) return true;

    const oldScore = oldAnalysis.score_calidad || 0;
    const newScore = newAnalysis.score_calidad || 0;

    return newScore > oldScore + 5; // Mejora significativa
  }

  /**
   * Calcula duración
   * @private
   */
  _getDuration() {
    if (!this.currentStats.startTime || !this.currentStats.endTime) return null;
    const start = new Date(this.currentStats.startTime);
    const end = new Date(this.currentStats.endTime);
    return end - start; // ms
  }
}

/**
 * Instancia singleton
 */
let reprocessorInstance = null;

export function getReprocessor() {
  if (!reprocessorInstance) {
    reprocessorInstance = new InvoiceReprocessor();
  }
  return reprocessorInstance;
}

export default InvoiceReprocessor;
