/**
 * extractorService.js — Cliente API para Data Extraction
 * =======================================================
 */

const API_URL = '/api/extractions';
const ADMIN_TOKEN = 'sinkia2026'; // Match with backend default

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Token': ADMIN_TOKEN,
});

/**
 * Extrae campos de un documento de texto
 */
export async function extractDocument(text, documentPath = null) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text, documentPath }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.extraction;
  } catch (error) {
    console.error('[ExtractorService] extractDocument error:', error);
    throw error;
  }
}

/**
 * Obtiene lista de extracciones
 */
export async function getExtractions(type = null) {
  try {
    let url = API_URL;
    if (type) url += `?type=${encodeURIComponent(type)}`;

    const response = await fetch(url, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.extractions || [];
  } catch (error) {
    console.error('[ExtractorService] getExtractions error:', error);
    throw error;
  }
}

/**
 * Obtiene una extracción por ID
 */
export async function getExtraction(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.extraction;
  } catch (error) {
    console.error('[ExtractorService] getExtraction error:', error);
    throw error;
  }
}

/**
 * Elimina una extracción
 */
export async function deleteExtraction(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[ExtractorService] deleteExtraction error:', error);
    throw error;
  }
}

/**
 * Exporta extracciones en JSON
 */
export async function exportAsJSON(type = null) {
  try {
    let url = `${API_URL}/export/json`;
    if (type) url += `?type=${encodeURIComponent(type)}`;

    const response = await fetch(url, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[ExtractorService] exportAsJSON error:', error);
    throw error;
  }
}

/**
 * Exporta extracciones en CSV
 */
export async function exportAsCSV(type = null) {
  try {
    let url = `${API_URL}/export/csv`;
    if (type) url += `?type=${encodeURIComponent(type)}`;

    const response = await fetch(url, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error('[ExtractorService] exportAsCSV error:', error);
    throw error;
  }
}

/**
 * Descarga una extracción en formato especificado
 */
export async function downloadExtraction(type = 'json', documentType = null) {
  try {
    let data;
    let filename;

    if (type === 'json') {
      data = await exportAsJSON(documentType);
      filename = `extractions_${documentType || 'all'}_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
    } else if (type === 'csv') {
      data = await exportAsCSV(documentType);
      filename = `extractions_${documentType || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(data, filename, 'text/csv');
    }
  } catch (error) {
    console.error('[ExtractorService] downloadExtraction error:', error);
    throw error;
  }
}

/**
 * Utilidad para descargar archivo
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export default {
  extractDocument,
  getExtractions,
  getExtraction,
  deleteExtraction,
  exportAsJSON,
  exportAsCSV,
  downloadExtraction,
};
