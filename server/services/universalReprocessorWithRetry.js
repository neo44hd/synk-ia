/**
 * Universal Reprocessor with Retry Mechanism
 * 
 * Características:
 * - Reintenta items fallidos automáticamente
 * - Validación robusta de datos
 * - Manejo de errores específicos
 * - Logging detallado
 * - Estadísticas por tipo de error
 */

import { EventEmitter } from 'events';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/Users/davidnows/sinkia-next/data';

class UniversalReprocessorWithRetry extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 segundos entre reintentos
    
    this.stats = {
      emails: { total: 0, processed: 0, failed: 0, retried: 0, finalFailed: 0, errors: {} },
      documents: { total: 0, processed: 0, failed: 0, retried: 0, finalFailed: 0, errors: {} },
      files: { total: 0, processed: 0, failed: 0, retried: 0, finalFailed: 0, errors: {} },
      invoices: { total: 0, processed: 0, failed: 0, retried: 0, finalFailed: 0, errors: {} },
      startTime: null,
      endTime: null,
      totalRetries: 0,
      totalRecovered: 0
    };
    
    this.failedItems = {
      emails: [],
      documents: [],
      files: [],
      invoices: []
    };
  }

  /**
   * Inicia reprocessamiento con retry
   */
  start(intervalMs = 300000) {
    if (this.isRunning) {
      console.log('[UniversalReprocessor+Retry] ⚠️  Ya está en ejecución');
      return;
    }

    this.isRunning = true;
    this.stats.startTime = new Date().toISOString();

    console.log(`[UniversalReprocessor+Retry] ✅ Iniciado con mecanismo de reintento`);
    console.log(`   Max reintentos por item: ${this.maxRetries}`);
    console.log(`   Delay entre reintentos: ${this.retryDelay}ms`);
    this.emit('started', { timestamp: new Date().toISOString() });

    // Primera ejecución inmediata
    this._processAll();

    // Luego periódicamente
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this._processAll();
      }
    }, intervalMs);
  }

  /**
   * Detiene reprocessamiento
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    clearInterval(this.intervalId);
    this.stats.endTime = new Date().toISOString();

    console.log('[UniversalReprocessor+Retry] ⏹️  Detenido');
    this._savFailedItemsReport();
    this.emit('stopped', this.stats);
  }

  /**
   * Procesa todo con reintentos
   */
  async _processAll() {
    try {
      console.log('\n[UniversalReprocessor+Retry] 🔄 Procesando TODO con mecanismo de reintento...');

      await Promise.all([
        this._processEmailsWithRetry(),
        this._processDocumentsWithRetry(),
        this._processFilesWithRetry(),
        this._processInvoicesWithRetry()
      ]);

      this._compileFinalResults();
      this.emit('batch-complete', this.stats);

    } catch (error) {
      console.error('[UniversalReprocessor+Retry] Error crítico:', error.message);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Procesa correos con reintentos
   */
  async _processEmailsWithRetry() {
    try {
      const filePath = path.join(DATA_DIR, 'emails.json');
      const data = JSON.parse(readFileSync(filePath, 'utf8'));

      this.stats.emails.total = Array.isArray(data) ? data.length : 0;
      const failed = [];

      for (let i = 0; i < data.length; i++) {
        const email = data[i];
        let attempts = 0;
        let success = false;

        while (attempts < this.maxRetries && !success) {
          try {
            // Validación
            if (!email.message_id) throw new Error('message_id faltante');
            if (!email.subject) throw new Error('subject faltante');
            
            // Procesar
            this._validateEmail(email);
            this.stats.emails.processed++;
            success = true;

          } catch (err) {
            attempts++;
            this.stats.emails.failed++;
            
            if (attempts >= this.maxRetries) {
              // Error final
              failed.push({
                item: email,
                error: err.message,
                attempts
              });
              
              // Registrar tipo de error
              const errorType = err.message.split(':')[0];
              this.stats.emails.errors[errorType] = (this.stats.emails.errors[errorType] || 0) + 1;
            } else {
              // Reintento
              this.stats.emails.retried++;
              await this._delay(this.retryDelay);
            }
          }
        }
      }

      this.failedItems.emails = failed;
      
      console.log(`[UniversalReprocessor+Retry] 📧 Correos:`);
      console.log(`   Total: ${this.stats.emails.total}`);
      console.log(`   ✅ Procesados: ${this.stats.emails.processed}`);
      console.log(`   🔄 Reintentos: ${this.stats.emails.retried}`);
      console.log(`   ❌ Fallidos: ${failed.length}`);
      
      this.emit('emails-processed', this.stats.emails);
    } catch (error) {
      console.error('[UniversalReprocessor+Retry] Error procesando emails:', error.message);
    }
  }

  /**
   * Procesa documentos con reintentos
   */
  async _processDocumentsWithRetry() {
    try {
      const filePath = path.join(DATA_DIR, 'documents.json');
      const data = JSON.parse(readFileSync(filePath, 'utf8'));

      this.stats.documents.total = Array.isArray(data) ? data.length : 0;
      const failed = [];

      for (let i = 0; i < data.length; i++) {
        const doc = data[i];
        let attempts = 0;
        let success = false;

        while (attempts < this.maxRetries && !success) {
          try {
            this._validateDocument(doc);
            this.stats.documents.processed++;
            success = true;
          } catch (err) {
            attempts++;
            this.stats.documents.failed++;
            
            if (attempts >= this.maxRetries) {
              failed.push({ item: doc, error: err.message, attempts });
              const errorType = err.message.split(':')[0];
              this.stats.documents.errors[errorType] = (this.stats.documents.errors[errorType] || 0) + 1;
            } else {
              this.stats.documents.retried++;
              await this._delay(this.retryDelay);
            }
          }
        }
      }

      this.failedItems.documents = failed;
      
      console.log(`[UniversalReprocessor+Retry] 📄 Documentos:`);
      console.log(`   Total: ${this.stats.documents.total}`);
      console.log(`   ✅ Procesados: ${this.stats.documents.processed}`);
      console.log(`   🔄 Reintentos: ${this.stats.documents.retried}`);
      console.log(`   ❌ Fallidos: ${failed.length}`);
      
      this.emit('documents-processed', this.stats.documents);
    } catch (error) {
      console.error('[UniversalReprocessor+Retry] Error procesando documentos:', error.message);
    }
  }

  /**
   * Procesa archivos con reintentos
   */
  async _processFilesWithRetry() {
    try {
      const filePath = path.join(DATA_DIR, 'uploadedfile.json');
      const data = JSON.parse(readFileSync(filePath, 'utf8'));

      this.stats.files.total = Array.isArray(data) ? data.length : 0;
      const failed = [];

      for (let i = 0; i < data.length; i++) {
        const file = data[i];
        let attempts = 0;
        let success = false;

        while (attempts < this.maxRetries && !success) {
          try {
            // Validación
            if (!file.id) throw new Error('id faltante');
            if (!file.filename) throw new Error('filename faltante');
            
            // Procesar
            this._validateFile(file);
            this.stats.files.processed++;
            success = true;

          } catch (err) {
            attempts++;
            this.stats.files.failed++;
            
            if (attempts >= this.maxRetries) {
              failed.push({ item: file, error: err.message, attempts });
              const errorType = err.message.split(':')[0];
              this.stats.files.errors[errorType] = (this.stats.files.errors[errorType] || 0) + 1;
            } else {
              this.stats.files.retried++;
              await this._delay(this.retryDelay);
            }
          }
        }
      }

      this.failedItems.files = failed;
      
      console.log(`[UniversalReprocessor+Retry] 💾 Archivos:`);
      console.log(`   Total: ${this.stats.files.total}`);
      console.log(`   ✅ Procesados: ${this.stats.files.processed}`);
      console.log(`   🔄 Reintentos: ${this.stats.files.retried}`);
      console.log(`   ❌ Fallidos: ${failed.length}`);
      
      this.emit('files-processed', this.stats.files);
    } catch (error) {
      console.error('[UniversalReprocessor+Retry] Error procesando archivos:', error.message);
    }
  }

  /**
   * Procesa facturas con reintentos
   */
  async _processInvoicesWithRetry() {
    try {
      const filePath = path.join(DATA_DIR, 'invoice.json');
      const data = JSON.parse(readFileSync(filePath, 'utf8'));

      this.stats.invoices.total = Array.isArray(data) ? data.length : 0;
      const failed = [];

      for (let i = 0; i < data.length; i++) {
        const invoice = data[i];
        let attempts = 0;
        let success = false;

        while (attempts < this.maxRetries && !success) {
          try {
            // Validación
            if (!invoice.id) throw new Error('id faltante');
            
            // Procesar
            this._validateInvoice(invoice);
            this.stats.invoices.processed++;
            success = true;

          } catch (err) {
            attempts++;
            this.stats.invoices.failed++;
            
            if (attempts >= this.maxRetries) {
              failed.push({ item: invoice, error: err.message, attempts });
              const errorType = err.message.split(':')[0];
              this.stats.invoices.errors[errorType] = (this.stats.invoices.errors[errorType] || 0) + 1;
            } else {
              this.stats.invoices.retried++;
              await this._delay(this.retryDelay);
            }
          }
        }
      }

      this.failedItems.invoices = failed;
      
      console.log(`[UniversalReprocessor+Retry] 💰 Facturas:`);
      console.log(`   Total: ${this.stats.invoices.total}`);
      console.log(`   ✅ Procesados: ${this.stats.invoices.processed}`);
      console.log(`   🔄 Reintentos: ${this.stats.invoices.retried}`);
      console.log(`   ❌ Fallidos: ${failed.length}`);
      
      this.emit('invoices-processed', this.stats.invoices);
    } catch (error) {
      console.error('[UniversalReprocessor+Retry] Error procesando facturas:', error.message);
    }
  }

  /**
   * Validadores específicos
   */
  _validateEmail(email) {
    if (!email.message_id) throw new Error('email_id_faltante');
    if (!email.subject || email.subject.trim() === '') throw new Error('subject_vacío');
    return true;
  }

  _validateDocument(doc) {
    if (!doc.id) throw new Error('doc_id_faltante');
    return true;
  }

  _validateFile(file) {
    if (!file.id) throw new Error('file_id_faltante');
    if (!file.filename) throw new Error('filename_faltante');
    return true;
  }

  _validateInvoice(invoice) {
    if (!invoice.id) throw new Error('invoice_id_faltante');
    return true;
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Compila resultados finales
   */
  _compileFinalResults() {
    const totalProcessed = 
      this.stats.emails.processed + 
      this.stats.documents.processed + 
      this.stats.files.processed + 
      this.stats.invoices.processed;

    const totalFailed = 
      this.failedItems.emails.length + 
      this.failedItems.documents.length + 
      this.failedItems.files.length + 
      this.failedItems.invoices.length;

    const totalRetries = 
      this.stats.emails.retried + 
      this.stats.documents.retried + 
      this.stats.files.retried + 
      this.stats.invoices.retried;

    this.stats.totalRetries = totalRetries;
    this.stats.totalRecovered = totalRetries - totalFailed;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 REPROCESSAMIENTO CON REINTENTOS COMPLETADO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Procesados: ${totalProcessed}`);
    console.log(`🔄 Reintentos totales: ${totalRetries}`);
    console.log(`💚 Recuperados por reintento: ${this.stats.totalRecovered}`);
    console.log(`❌ Fallidos finales: ${totalFailed}`);
    console.log(`📊 Tasa de éxito: ${((totalProcessed / (totalProcessed + totalFailed)) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  /**
   * Guarda reporte de items fallidos
   */
  _savFailedItemsReport() {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        stats: this.stats,
        failedItems: this.failedItems
      };

      const reportPath = path.join(DATA_DIR, 'reprocessor-failed-items.json');
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`[UniversalReprocessor+Retry] 📋 Reporte guardado: ${reportPath}`);
    } catch (error) {
      console.error('[UniversalReprocessor+Retry] Error guardando reporte:', error.message);
    }
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
      failedItems: this.failedItems,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Instancia singleton
 */
let reprocessorInstance = null;

export function getUniversalReprocessorWithRetry() {
  if (!reprocessorInstance) {
    reprocessorInstance = new UniversalReprocessorWithRetry();
  }
  return reprocessorInstance;
}

export default UniversalReprocessorWithRetry;
