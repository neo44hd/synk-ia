/**
 * pdfProcessor.js — Procesa archivos PDF
 * =====================================
 * Extrae texto, metadata y páginas usando pdf-parse (ya disponible)
 * Fallback a herramientas del sistema si pdftotext está disponible
 */

import { execSync } from 'child_process';
import PDFParse from 'pdf-parse';

/**
 * Detecta si es un archivo PDF válido
 */
export function isPDF(mimeType, filename) {
  return (
    mimeType === 'application/pdf' ||
    filename?.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Procesa un buffer de PDF y extrae metadata + texto
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} filename - Nombre original del archivo
 * @returns {Promise<{text: string, metadata: Object, pages: number, method: string, success: boolean, error?: string}>}
 */
export async function processPDF(buffer, filename) {
  const result = {
    text: '',
    metadata: {},
    pages: 0,
    method: 'raw',
    success: false,
    error: null,
  };

  try {
    // Intenta con pdftotext primero (más rápido)
    try {
      // Usar pdftotext si está disponible en el sistema
      const tempFile = `/tmp/pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
      const { writeFileSync, unlinkSync } = await import('fs');
      writeFileSync(tempFile, buffer);

      try {
        const text = execSync(`pdftotext '${tempFile}' - 2>/dev/null`, {
          encoding: 'utf-8',
          maxBuffer: 100 * 1024 * 1024, // 100MB buffer
          timeout: 30000,
        });
        result.text = text;
        result.method = 'pdftotext-system';
        result.success = text.trim().length > 0;
        unlinkSync(tempFile);
        return result;
      } catch {
        // pdftotext no disponible o falló, continuar con pdf-parse
        try { unlinkSync(tempFile); } catch {}
      }
    } catch {
      // No intentar pdftotext, continuar con pdf-parse
    }

    // Fallback: usar pdf-parse (npm library)
    const data = await PDFParse(buffer);
    result.pages = data.numpages || data.info?.Pages || 0;
    result.metadata = {
      producer: data.info?.Producer,
      creator: data.info?.Creator,
      creationDate: data.info?.CreationDate,
      modDate: data.info?.ModDate,
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      keywords: data.info?.Keywords,
    };

    // Extraer texto de todas las páginas
    result.text = (data.text || '').trim();
    result.method = 'pdf-parse';
    result.success = result.text.length > 10;

    // Si no hay texto pero hay metadatos, es un éxito parcial
    if (!result.success && Object.keys(result.metadata).some(k => result.metadata[k])) {
      result.success = true;
    }
  } catch (err) {
    result.error = err.message;
    result.success = false;
  }

  return result;
}

/**
 * Extrae solo metadata sin procesar el texto completo
 * Útil para operaciones rápidas
 */
export async function extractPDFMetadata(buffer) {
  try {
    const data = await PDFParse(buffer);
    return {
      pages: data.numpages || 0,
      metadata: {
        producer: data.info?.Producer,
        creator: data.info?.Creator,
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
      },
    };
  } catch (err) {
    return {
      pages: 0,
      metadata: {},
      error: err.message,
    };
  }
}
