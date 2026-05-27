/**
 * excelProcessor.js — Procesa archivos XLSX, XLS, CSV
 * =====================================================
 * Extrae datos tabulares usando xlsx library
 * Soporta múltiples sheets y preserva estructura
 */

import XLSX from 'xlsx';

/**
 * Detecta si es un archivo Excel/CSV válido
 */
export function isExcel(mimeType, filename) {
  const type = mimeType?.toLowerCase() || '';
  const fname = filename?.toLowerCase() || '';

  return (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type === 'text/csv' ||
    fname.endsWith('.xlsx') ||
    fname.endsWith('.xls') ||
    fname.endsWith('.csv') ||
    fname.endsWith('.tsv')
  );
}

/**
 * Procesa buffer de Excel y extrae datos + metadata
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} filename - Nombre original
 * @returns {Promise<{text: string, metadata: Object, sheets: Array, method: string, success: boolean, error?: string}>}
 */
export async function processExcel(buffer, filename) {
  const result = {
    text: '',
    metadata: {},
    sheets: [],
    method: 'xlsx',
    success: false,
    error: null,
  };

  try {
    // Parsear el workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    result.metadata = {
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      props: workbook.Props || {},
    };

    // Procesar cada sheet
    const sheets = [];
    let allText = '';

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Convertir a texto para búsqueda
      const sheetText = sheetData
        .map(row => Object.values(row).join(' | '))
        .join('\n');

      sheets.push({
        name: sheetName,
        rows: sheetData.length,
        columns: sheetData.length > 0 ? Object.keys(sheetData[0]).length : 0,
        data: sheetData.slice(0, 1000), // Limitar a 1000 filas en resultado
        preview: sheetText.substring(0, 2000),
      });

      allText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
    }

    result.sheets = sheets;
    result.text = allText.substring(0, 50000); // Limitar texto total
    result.success = sheets.length > 0 && allText.trim().length > 0;
  } catch (err) {
    result.error = err.message;
    result.success = false;
  }

  return result;
}

/**
 * Extrae solo los headers de una hoja específica
 * Útil para detectar estructura sin cargar datos completos
 */
export async function extractExcelHeaders(buffer, sheetIndex = 0) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[sheetIndex];

    if (!sheetName) {
      return { headers: [], error: 'Sheet not found' };
    }

    const worksheet = workbook.Sheets[sheetName];
    const firstRow = XLSX.utils.sheet_to_json(worksheet, { defval: '' })[0] || {};

    return {
      headers: Object.keys(firstRow),
      sheetName,
      sheetIndex,
    };
  } catch (err) {
    return {
      headers: [],
      error: err.message,
    };
  }
}

/**
 * Convierte un sheet a diferentes formatos
 */
export async function convertSheet(buffer, filename, toFormat = 'json') {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (toFormat === 'json') {
      return XLSX.utils.sheet_to_json(worksheet);
    } else if (toFormat === 'csv') {
      return XLSX.utils.sheet_to_csv(worksheet);
    } else if (toFormat === 'html') {
      return XLSX.utils.sheet_to_html(worksheet);
    }
    return null;
  } catch (err) {
    throw new Error(`Cannot convert to ${toFormat}: ${err.message}`);
  }
}
