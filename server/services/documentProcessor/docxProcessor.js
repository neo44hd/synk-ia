/**
 * docxProcessor.js — Procesa archivos DOCX
 * =========================================
 * Extrae texto y metadata de documentos Word
 * Fallback a zip parsing si biblioteca no está disponible
 */

import { promisify } from 'util';

/**
 * Detecta si es un archivo DOCX válido
 */
export function isDocx(mimeType, filename) {
  const type = mimeType?.toLowerCase() || '';
  const fname = filename?.toLowerCase() || '';

  return (
    type.includes('word') ||
    type.includes('officedocument') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fname.endsWith('.docx')
  );
}

/**
 * Procesa buffer DOCX y extrae texto + metadata
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} filename - Nombre original
 * @returns {Promise<{text: string, metadata: Object, paragraphs: Array, method: string, success: boolean, error?: string}>}
 */
export async function processDocx(buffer, filename) {
  const result = {
    text: '',
    metadata: {},
    paragraphs: [],
    method: 'raw',
    success: false,
    error: null,
  };

  try {
    // Intento 1: Usar mammoth.js si está instalado
    try {
      const mammoth = await import('mammoth');
      const docResult = await mammoth.extractRawText({ arrayBuffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length) });
      result.text = docResult.value;
      result.method = 'mammoth';
      result.success = result.text.trim().length > 0;
      return result;
    } catch (err) {
      if (err.message?.includes('Cannot find module')) {
        // Module not installed, try next method
      } else {
        console.warn('[DOCX] Mammoth error:', err.message);
      }
    }

    // Intento 2: Fallback manual usando adm-zip (ya disponible en dependencias)
    const AdmZip = await import('adm-zip');
    const zip = new AdmZip.default(buffer);
    const entries = zip.getEntries();

    // Buscar document.xml (contenido principal)
    let documentXml = null;
    let documentPropsXml = null;
    let documentCorePropsXml = null;

    for (const entry of entries) {
      if (entry.entryName === 'word/document.xml') {
        documentXml = entry.getData().toString('utf-8');
      } else if (entry.entryName === 'docProps/app.xml') {
        documentPropsXml = entry.getData().toString('utf-8');
      } else if (entry.entryName === 'docProps/core.xml') {
        documentCorePropsXml = entry.getData().toString('utf-8');
      }
    }

    if (!documentXml) {
      result.error = 'No se encontró document.xml en el archivo DOCX';
      result.method = 'zip-parse';
      return result;
    }

    // Extraer texto limpio de document.xml
    result.text = extractTextFromDocumentXml(documentXml);
    result.metadata = extractMetadataFromDocx(documentPropsXml, documentCorePropsXml);
    result.paragraphs = extractParagraphsFromDocumentXml(documentXml);
    result.method = 'zip-parse';
    result.success = result.text.trim().length > 0;
  } catch (err) {
    result.error = err.message;
    result.success = false;
  }

  return result;
}

/**
 * Extrae texto limpio del XML removiendo tags
 */
function extractTextFromDocumentXml(xml) {
  try {
    // Remover tags XML y preservar saltos de párrafo
    let text = xml;

    // Reemplazar ruptura de párrafo con newlines
    text = text.replace(/<\/w:p>/g, '\n');

    // Reemplazar ruptura de línea con newlines
    text = text.replace(/<w:br\/>/g, '\n');

    // Remover todos los tags XML
    text = text.replace(/<[^>]+>/g, '');

    // Decodificar entities HTML
    text = text
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&#x[0-9a-fA-F]+;/g, (match) => {
        const charCode = parseInt(match.slice(3, -1), 16);
        return String.fromCharCode(charCode);
      });

    // Limpiar espacios en blanco excesivos
    text = text.replace(/\n\s*\n/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');

    return text.trim();
  } catch (err) {
    console.warn('[DOCX] Error extracting text:', err.message);
    return '';
  }
}

/**
 * Extrae párrafos individuales del documento
 */
function extractParagraphsFromDocumentXml(xml) {
  const paragraphs = [];

  // Buscar todos los párrafos <w:p>...</w:p>
  const paragraphRegex = /<w:p[^>]*>(.*?)<\/w:p>/gs;
  let match;

  while ((match = paragraphRegex.exec(xml)) !== null) {
    const paragraphXml = match[1];

    // Extraer texto del párrafo
    let text = paragraphXml;
    text = text.replace(/<w:br\/>/g, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'");

    text = text.trim();

    if (text.length > 0) {
      paragraphs.push({
        text,
        length: text.length,
      });
    }
  }

  return paragraphs;
}

/**
 * Extrae metadata del documento
 */
function extractMetadataFromDocx(appXml, coreXml) {
  const metadata = {
    title: '',
    author: '',
    subject: '',
    keywords: '',
    created: '',
    modified: '',
    pages: 0,
    words: 0,
    characters: 0,
  };

  // Parsear app.xml para estadísticas
  if (appXml) {
    try {
      const pagesMatch = appXml.match(/<Pages>(\d+)<\/Pages>/);
      if (pagesMatch) metadata.pages = parseInt(pagesMatch[1], 10);

      const wordsMatch = appXml.match(/<Words>(\d+)<\/Words>/);
      if (wordsMatch) metadata.words = parseInt(wordsMatch[1], 10);

      const charsMatch = appXml.match(/<Characters>(\d+)<\/Characters>/);
      if (charsMatch) metadata.characters = parseInt(charsMatch[1], 10);
    } catch {
      // Error parsing
    }
  }

  // Parsear core.xml para propiedades
  if (coreXml) {
    try {
      const titleMatch = coreXml.match(/<dc:title>([^<]*)<\/dc:title>/);
      if (titleMatch) metadata.title = titleMatch[1];

      const authorMatch = coreXml.match(/<dc:creator>([^<]*)<\/dc:creator>/);
      if (authorMatch) metadata.author = authorMatch[1];

      const subjectMatch = coreXml.match(/<dc:subject>([^<]*)<\/dc:subject>/);
      if (subjectMatch) metadata.subject = subjectMatch[1];

      const keywordsMatch = coreXml.match(/<keywords>([^<]*)<\/keywords>/);
      if (keywordsMatch) metadata.keywords = keywordsMatch[1];

      const createdMatch = coreXml.match(/<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/);
      if (createdMatch) metadata.created = createdMatch[1];

      const modifiedMatch = coreXml.match(/<dcterms:modified[^>]*>([^<]*)<\/dcterms:modified>/);
      if (modifiedMatch) metadata.modified = modifiedMatch[1];
    } catch {
      // Error parsing
    }
  }

  return metadata;
}

/**
 * Extrae solo los metadatos sin procesar el contenido completo
 */
export async function extractDocxMetadata(buffer) {
  try {
    const AdmZip = await import('adm-zip');
    const zip = new AdmZip.default(buffer);
    const entries = zip.getEntries();

    let appXml = null;
    let coreXml = null;

    for (const entry of entries) {
      if (entry.entryName === 'docProps/app.xml') {
        appXml = entry.getData().toString('utf-8');
      } else if (entry.entryName === 'docProps/core.xml') {
        coreXml = entry.getData().toString('utf-8');
      }
    }

    const metadata = extractMetadataFromDocx(appXml, coreXml);
    return {
      metadata,
      success: true,
    };
  } catch (err) {
    return {
      metadata: {},
      success: false,
      error: err.message,
    };
  }
}
