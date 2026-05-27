/**
 * Classifier Service - Cliente para el motor de clasificación automática
 * 
 * Interactúa con /api/classify en el backend para:
 * - Clasificar documentos/textos
 * - Registrar feedback del usuario
 * - Obtener estadísticas
 * - Consultar historial
 */

const API_BASE = '/api/classify';

/**
 * Wrapper para llamadas API con manejo de errores
 */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  
  return res.json();
}

/**
 * Clasificar un documento/texto
 * 
 * @param {string} text - Texto a clasificar (requerido)
 * @param {Object} metadata - Metadata opcional: { documentId, filename, mimeType }
 * @returns {Promise<Object>} Resultado con clasificación y confianza
 */
export async function classify(text, metadata = {}) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required');
  }

  const result = await apiFetch(API_BASE, {
    method: 'POST',
    body: JSON.stringify({
      text: text.trim(),
      ...metadata
    })
  });

  return result.result;
}

/**
 * Registrar feedback del usuario sobre una clasificación
 * 
 * @param {string} classificationId - ID de la clasificación
 * @param {Object} corrected - Valores corregidos: { tipo, departamento, urgencia, estado }
 * @returns {Promise<Object>} Respuesta del servidor
 */
export async function recordFeedback(classificationId, corrected) {
  if (!classificationId || !corrected) {
    throw new Error('classificationId and corrected are required');
  }

  return apiFetch(`${API_BASE}/feedback`, {
    method: 'POST',
    body: JSON.stringify({
      classificationId,
      corrected
    })
  });
}

/**
 * Obtener estadísticas del clasificador
 * 
 * @returns {Promise<Object>} Estadísticas: total, correct, accuracy, breakdown
 */
export async function getStats() {
  const result = await apiFetch(`${API_BASE}/stats`);
  return result.stats;
}

/**
 * Obtener historial de clasificaciones
 * 
 * @param {number} limit - Máximo de resultados (default 50)
 * @param {number} offset - Para paginación (default 0)
 * @param {string} tipo - Filtrar por tipo (opcional)
 * @param {string} departamento - Filtrar por departamento (opcional)
 * @returns {Promise<Object>} { total, limit, offset, history }
 */
export async function getHistory(limit = 50, offset = 0, tipo = null, departamento = null) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (tipo) params.set('tipo', tipo);
  if (departamento) params.set('departamento', departamento);

  const result = await apiFetch(`${API_BASE}/history?${params}`);
  return result;
}

/**
 * Obtener desglose de clasificaciones por categoría
 * 
 * @returns {Promise<Object>} Breakdown: { tipo: {...}, departamento: {...}, ... }
 */
export async function getBreakdown() {
  const result = await apiFetch(`${API_BASE}/breakdown`);
  return result.breakdown;
}

/**
 * Extraer texto de un archivo para clasificación
 * 
 * Nota: Esta función es un helper para extraer texto antes de clasificar.
 * En producción, el texto debería provenir de un servicio de OCR/extracción.
 * 
 * @param {File} file - Archivo a procesar
 * @returns {Promise<string>} Texto extraído
 */
export async function extractTextFromFile(file) {
  if (file.type === 'text/plain') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // Para otros tipos, retornar placeholder
  // El servidor debe tener un endpoint de extracción para PDFs, etc.
  throw new Error(`File type ${file.type} not yet supported in classifier`);
}

/**
 * Clasificar un archivo directamente
 * 
 * @param {File} file - Archivo a clasificar
 * @param {boolean} extractText - Si true, extrae texto antes de clasificar
 * @returns {Promise<Object>} Resultado con clasificación
 */
export async function classifyFile(file, extractText = true) {
  if (!file) {
    throw new Error('File is required');
  }

  let text;
  if (extractText) {
    text = await extractTextFromFile(file);
  } else {
    // Si no extraemos texto, enviamos el nombre del archivo como contexto
    text = file.name;
  }

  return classify(text, {
    filename: file.name,
    mimeType: file.type
  });
}

/**
 * Validar que una clasificación contiene todos los campos requeridos
 * 
 * @param {Object} classification - Objeto con { tipo, departamento, urgencia, estado }
 * @returns {boolean} True si es válida
 */
export function isValidClassification(classification) {
  if (!classification) return false;

  const requiredFields = ['tipo', 'departamento', 'urgencia', 'estado'];
  for (const field of requiredFields) {
    if (!classification[field] || !classification[field].value) {
      return false;
    }
  }

  return true;
}

/**
 * Obtener etiqueta legible para una categoría
 * 
 * @param {string} value - Valor de la categoría
 * @returns {Object} { label, color, icon }
 */
export function getCategoryLabel(value) {
  const labels = {
    // Tipos
    'Factura': { label: 'Factura', color: 'bg-blue-100 text-blue-800', icon: '📄' },
    'Presupuesto': { label: 'Presupuesto', color: 'bg-purple-100 text-purple-800', icon: '💰' },
    'Contrato': { label: 'Contrato', color: 'bg-red-100 text-red-800', icon: '📋' },
    'PO': { label: 'Orden de Compra', color: 'bg-green-100 text-green-800', icon: '📦' },
    'Recibo': { label: 'Recibo', color: 'bg-yellow-100 text-yellow-800', icon: '🧾' },
    'Otro': { label: 'Otro', color: 'bg-gray-100 text-gray-800', icon: '❓' },
    
    // Departamentos
    'Compras': { label: 'Compras', color: 'bg-blue-100 text-blue-800', icon: '🛒' },
    'RRHH': { label: 'RRHH', color: 'bg-pink-100 text-pink-800', icon: '👥' },
    'Legal': { label: 'Legal', color: 'bg-red-100 text-red-800', icon: '⚖️' },
    'Finanzas': { label: 'Finanzas', color: 'bg-green-100 text-green-800', icon: '💵' },
    'IT': { label: 'IT', color: 'bg-cyan-100 text-cyan-800', icon: '💻' },
    
    // Urgencia
    'Critical': { label: 'Crítico', color: 'bg-red-100 text-red-800', icon: '🔴' },
    'Urgente': { label: 'Urgente', color: 'bg-orange-100 text-orange-800', icon: '🟠' },
    'Normal': { label: 'Normal', color: 'bg-gray-100 text-gray-800', icon: '⚪' },
    
    // Estado
    'Nuevo': { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: '✨' },
    'Procesado': { label: 'Procesado', color: 'bg-green-100 text-green-800', icon: '✅' },
    'Archivado': { label: 'Archivado', color: 'bg-gray-100 text-gray-800', icon: '📦' }
  };

  return labels[value] || { label: value, color: 'bg-gray-100 text-gray-800', icon: '?' };
}

/**
 * Objeto principal de servicio exportado
 */
export const classifierService = {
  classify,
  recordFeedback,
  getStats,
  getHistory,
  getBreakdown,
  extractTextFromFile,
  classifyFile,
  isValidClassification,
  getCategoryLabel
};

export default classifierService;
