/**
 * documentProcessor.js — SYNK-IA Local Processor
 * =================================================
 * Reemplaza el antiguo proxy hacia api-v3.sinkialabs.com.
 * Ahora todo el procesamiento es local vía Classifier + Document Agent.
 *
 * Firma de API compatible: processDocument(filePath, mimeType, originalName)
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '..', '..', 'data');

// Delegar al orquestador local
export async function processDocument(filePath, mimeType, originalName) {
  const { readFile } = await import('fs/promises');
  const buffer = await readFile(filePath);

  const { extractText } = await import('../agents/documentAgent.js');
  const text = await extractText(buffer, mimeType, originalName);

  if (!text) {
    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nombre_archivo: originalName,
      mime_type: mimeType,
      procesado: new Date().toISOString(),
      estado: 'error',
      analisis: { tipo: 'otro', resumen: 'No se pudo extraer texto del archivo' },
    };
  }

  const { classify } = await import('../agents/classifier.js');
  const classification = await classify({
    text,
    filename: originalName,
    mimeType,
    source: 'upload',
  });

  const { process: docProcess } = await import('../agents/documentAgent.js');
  const result = await docProcess({
    text,
    classification,
    filename: originalName,
    mimeType,
  });

  return {
    id: result.processId || `doc_${Date.now()}`,
    nombre_archivo: originalName,
    mime_type: mimeType,
    procesado: new Date().toISOString(),
    tiempo_ms: result.durationMs || 0,
    metodo_extraccion: 'local-llm',
    paginas: 1,
    chars_extraidos: text.length,
    texto_preview: text.substring(0, 800),
    analisis: {
      tipo: result.classification?.docType || 'otro',
      subtipo: result.classification?.subType || null,
      fecha: null,
      fecha_vencimiento: null,
      numero_documento: null,
      emisor: null,
      receptor: null,
      conceptos: [],
      base_imponible: null,
      iva_total: null,
      total: null,
      moneda: 'EUR',
      forma_pago: null,
      resumen: result.classification?.summary || '',
      confianza: result.classification?.confidence || 0,
    },
    estado: result.success ? 'procesado' : 'error',
    ...result.subAgentResult,
  };
}

// Mantener compatibilidad con lectores anteriores
export const getDocuments  = () => Promise.resolve([]);
export const getEntities   = () => Promise.resolve({ clientes: [], proveedores: [], trabajadores: [] });
export const getDocument   = async () => null;
export const deleteDocument = async () => ({ ok: true });
export const getStats      = async () => ({ total: 0, last_24h: 0, by_type: {}, motor: 'synkia-local' });
export const extractText   = async () => ({ text: '', method: 'local', ok: true, pages: 1 });