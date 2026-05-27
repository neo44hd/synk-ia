/**
 * universalProcessor.js — Orquestador universal de procesamiento de documentos
 * ==============================================================================
 * Detecta tipo de archivo y delega a procesador especializado
 * Soporta: PDF, XLSX, DOCX, PNG, JPG, CSV, TXT
 * Diseñado para procesamiento paralelo futuro
 */

import { isPDF, processPDF } from './pdfProcessor.js';
import { isExcel, processExcel } from './excelProcessor.js';
import { isDocx, processDocx } from './docxProcessor.js';
import { isImage, processImage } from './imageProcessor.js';

/**
 * Tipos de archivo soportados
 */
export const SUPPORTED_TYPES = {
  PDF: 'application/pdf',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  CSV: 'text/csv',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  PNG: 'image/png',
  JPG: 'image/jpeg',
  TIFF: 'image/tiff',
  TXT: 'text/plain',
};

/**
 * Detecta el tipo de documento basado en MIME y filename
 * @returns {'pdf' | 'excel' | 'docx' | 'image' | 'text' | 'unknown'}
 */
export function detectDocumentType(mimeType, filename) {
  if (isPDF(mimeType, filename)) return 'pdf';
  if (isExcel(mimeType, filename)) return 'excel';
  if (isDocx(mimeType, filename)) return 'docx';
  if (isImage(mimeType, filename)) return 'image';
  if (mimeType === 'text/plain' || filename?.toLowerCase().endsWith('.txt')) return 'text';
  return 'unknown';
}

/**
 * Procesa un documento universal
 * Detecta tipo y delega a procesador especializado
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} mimeType - MIME type del archivo
 * @param {string} filename - Nombre original del archivo
 * @param {Object} options - Opciones adicionales {generateMetadataOnly, savePath}
 * @returns {Promise<ProcessedDocument>}
 */
export async function processDocument(buffer, mimeType, filename, options = {}) {
  const startTime = Date.now();
  const docType = detectDocumentType(mimeType, filename);

  const baseResult = {
    filename,
    mimeType,
    documentType: docType,
    size: buffer.length,
    processingTime: 0,
    timestamp: new Date().toISOString(),
    content: {
      text: '',
      metadata: {},
    },
    status: 'pending',
    error: null,
  };

  try {
    let processorResult;

    // Delegar a procesador especializado
    switch (docType) {
      case 'pdf':
        processorResult = await processPDF(buffer, filename);
        break;

      case 'excel':
        processorResult = await processExcel(buffer, filename);
        break;

      case 'docx':
        processorResult = await processDocx(buffer, filename);
        break;

      case 'image':
        processorResult = await processImage(buffer, filename);
        break;

      case 'text':
        processorResult = {
          text: buffer.toString('utf-8'),
          metadata: { encoding: 'utf-8' },
          method: 'text-direct',
          success: true,
        };
        break;

      default:
        // Fallback: intentar como texto
        try {
          processorResult = {
            text: buffer.toString('utf-8').substring(0, 50000),
            metadata: { encoding: 'utf-8' },
            method: 'raw-buffer',
            success: buffer.toString('utf-8').trim().length > 0,
          };
        } catch {
          throw new Error(`Unsupported document type: ${docType}`);
        }
    }

    // Consolidar resultado
    baseResult.content = {
      text: processorResult.text || '',
      metadata: {
        ...processorResult.metadata,
        extractionMethod: processorResult.method,
        ...(processorResult.pages && { pages: processorResult.pages }),
        ...(processorResult.sheets && { sheets: processorResult.sheets }),
        ...(processorResult.paragraphs && { paragraphs: processorResult.paragraphs }),
      },
    };

    baseResult.status = processorResult.success ? 'success' : 'partial';
    baseResult.processingTime = Date.now() - startTime;

    // Si hay un error parcial, incluirlo
    if (processorResult.error && !processorResult.success) {
      baseResult.error = processorResult.error;
      baseResult.status = 'error';
    }

    return baseResult;
  } catch (err) {
    baseResult.status = 'error';
    baseResult.error = err.message;
    baseResult.processingTime = Date.now() - startTime;
    return baseResult;
  }
}

/**
 * Procesa múltiples documentos en paralelo (para futuro)
 * @param {Array<{buffer, mimeType, filename}>} documents - Documentos a procesar
 * @param {number} concurrency - Documentos procesados en paralelo
 */
export async function processDocumentsParallel(documents, concurrency = 4) {
  const results = [];
  const queue = [...documents];

  // Implementación simple de pool de concurrency
  const workers = Array(Math.min(concurrency, documents.length))
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const doc = queue.shift();
        if (!doc) break;

        try {
          const result = await processDocument(doc.buffer, doc.mimeType, doc.filename);
          results.push(result);
        } catch (err) {
          results.push({
            filename: doc.filename,
            status: 'error',
            error: err.message,
          });
        }
      }
    });

  await Promise.all(workers);
  return results;
}

/**
 * Valida si un buffer parece ser un documento válido
 */
export function validateDocumentBuffer(buffer, mimeType, filename) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: 'Empty or invalid buffer' };
  }

  if (buffer.length > 500 * 1024 * 1024) {
    return { valid: false, error: 'File too large (>500MB)' };
  }

  const docType = detectDocumentType(mimeType, filename);
  if (docType === 'unknown') {
    return { valid: false, error: `Unknown document type: ${mimeType}` };
  }

  // Validar magic bytes para ciertos tipos
  if (docType === 'pdf' && !buffer.toString('utf-8', 0, 4).includes('%PDF')) {
    return { valid: false, error: 'Invalid PDF file (missing PDF header)' };
  }

  return { valid: true };
}

/**
 * Genera un resumen de lo que se procesó
 */
export function generateProcessingSummary(result) {
  const summary = {
    filename: result.filename,
    documentType: result.documentType,
    status: result.status,
    processingTime: `${result.processingTime}ms`,
    textLength: result.content.text.length,
    textPreview: result.content.text.substring(0, 200),
    metadata: result.content.metadata,
  };

  return summary;
}

/**
 * Tipo de documento procesado
 * @typedef {Object} ProcessedDocument
 * @property {string} filename - Nombre del archivo
 * @property {string} mimeType - MIME type
 * @property {string} documentType - Tipo detectado (pdf|excel|docx|image|text|unknown)
 * @property {number} size - Tamaño en bytes
 * @property {number} processingTime - Tiempo en ms
 * @property {string} timestamp - ISO timestamp
 * @property {Object} content - Contenido extraído
 * @property {string} content.text - Texto extraído
 * @property {Object} content.metadata - Metadata del documento
 * @property {string} status - Estado (pending|success|partial|error)
 * @property {string|null} error - Mensaje de error si aplica
 */
