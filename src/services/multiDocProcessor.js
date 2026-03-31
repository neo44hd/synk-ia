/**
 * MULTI-DOCUMENT PROCESSOR
 * Handles PDFs with multiple pages/documents, ZIP/RAR archives
 * Splits multi-document PDFs into individual entries
 * Extracts files from archives before processing
 * 
 * (c) 2024 David Roldan - SYNK-IA Labs
 */
import { invoiceExtractor, DOCUMENT_TYPES } from './invoiceExtractorService';

// Patterns that indicate a new document starts on this page
const NEW_DOC_INDICATORS = [
  /factura\s*(?:n[uú]m|n[°ºo]|#)/i,
  /n[oó]mina\s+(?:de|del|mes)/i,
  /recibo\s+de\s+salario/i,
  /albar[aá]n\s*(?:n[°ºo]|de\s+entrega)/i,
  /\bCIF[:\s]+[A-Z]\d{7}[A-Z0-9]/i,
  /\bNIF[:\s]+\d{8}[A-Z]/i,
  /base\s*imponible/i,
  /total\s*(?:factura|a\s*pagar)/i,
  /devengos|deducciones|l[ií]quido\s*a\s*percibir/i,
];

// Patterns specific to payslips (nominas)
const NOMINA_INDICATORS = [
  /n[oó]mina/i,
  /recibo\s+(?:de\s+)?salario/i,
  /devengos/i,
  /deducciones/i,
  /l[ií]quido\s*(?:a\s*)?percibir/i,
  /seguridad\s*social/i,
  /IRPF/i,
  /salario\s*base/i,
];

// Patterns specific to invoices (facturas)
const FACTURA_INDICATORS = [
  /factura/i,
  /invoice/i,
  /base\s*imponible/i,
  /I\.?V\.?A/i,
  /total\s*(?:factura|a\s*pagar)/i,
  /forma\s*de\s*pago/i,
  /vencimiento/i,
];

/**
 * Analyze OCR page results to detect document boundaries
 * Returns groups of pages that belong to the same document
 */
export function detectDocumentBoundaries(pageResults) {
  if (!pageResults || pageResults.length === 0) return [];
  if (pageResults.length === 1) {
    return [{ pages: [0], text: pageResults[0].text, startPage: 1, endPage: 1 }];
  }

  const documents = [];
  let currentDoc = { pages: [0], texts: [pageResults[0].text], startPage: 1 };

  for (let i = 1; i < pageResults.length; i++) {
    const pageText = pageResults[i].text || '';
    const isNewDocument = detectNewDocument(pageText, pageResults[i - 1]?.text || '');

    if (isNewDocument) {
      // Close current document
      currentDoc.endPage = i;
      currentDoc.text = currentDoc.texts.join('\n\n');
      delete currentDoc.texts;
      documents.push(currentDoc);

      // Start new document
      currentDoc = { pages: [i], texts: [pageText], startPage: i + 1 };
    } else {
      currentDoc.pages.push(i);
      currentDoc.texts.push(pageText);
    }
  }

  // Close last document
  currentDoc.endPage = pageResults.length;
  currentDoc.text = currentDoc.texts.join('\n\n');
  delete currentDoc.texts;
  documents.push(currentDoc);

  return documents;
}

/**
 * Detect if a page starts a new document
 */
function detectNewDocument(currentPageText, previousPageText) {
  if (!currentPageText || currentPageText.trim().length < 20) return false;

  // Count how many "new document" indicators appear on this page
  let indicatorCount = 0;
  for (const pattern of NEW_DOC_INDICATORS) {
    if (pattern.test(currentPageText)) indicatorCount++;
  }

  // If 2+ indicators found, likely a new document
  if (indicatorCount >= 2) return true;

  // Check if document type changed between pages
  const prevType = classifyPageType(previousPageText);
  const currType = classifyPageType(currentPageText);
  if (prevType && currType && prevType !== currType) return true;

  // Check if there's a new CIF/NIF that's different from previous page
  const prevCIF = extractCIF(previousPageText);
  const currCIF = extractCIF(currentPageText);
  if (prevCIF && currCIF && prevCIF !== currCIF) return true;

  // Check for new invoice number pattern at start of page
  const currInvoiceNum = extractInvoiceNumber(currentPageText);
  const prevInvoiceNum = extractInvoiceNumber(previousPageText);
  if (currInvoiceNum && prevInvoiceNum && currInvoiceNum !== prevInvoiceNum) return true;

  return false;
}

/**
 * Classify what type of document a page belongs to
 */
function classifyPageType(text) {
  if (!text) return null;
  let nominaScore = 0;
  let facturaScore = 0;

  for (const p of NOMINA_INDICATORS) {
    if (p.test(text)) nominaScore++;
  }
  for (const p of FACTURA_INDICATORS) {
    if (p.test(text)) facturaScore++;
  }

  if (nominaScore >= 2) return 'nomina';
  if (facturaScore >= 2) return 'factura';
  if (nominaScore > facturaScore) return 'nomina';
  if (facturaScore > nominaScore) return 'factura';
  return null;
}

/**
 * Extract CIF/NIF from text
 */
function extractCIF(text) {
  if (!text) return null;
  const match = text.match(/\b([ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|[KLMNXYZ]\d{7}[A-Z])\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Extract invoice number from text
 */
function extractInvoiceNumber(text) {
  if (!text) return null;
  const match = text.match(/(?:factura|fact|fra|invoice|inv|n[°ºo]?)\s*[:\-#]?\s*([A-Z0-9][\w\-\/]{2,20})/i);
  return match ? match[1].trim() : null;
}

/**
 * Check if a file is an archive (ZIP, RAR, etc)
 */
export function isArchiveFile(filename, contentType) {
  const name = (filename || '').toLowerCase();
  const type = (contentType || '').toLowerCase();
  return (
    name.endsWith('.zip') ||
    name.endsWith('.rar') ||
    name.endsWith('.7z') ||
    name.endsWith('.tar') ||
    name.endsWith('.gz') ||
    name.endsWith('.tar.gz') ||
    type === 'application/zip' ||
    type === 'application/x-rar-compressed' ||
    type === 'application/x-7z-compressed' ||
    type === 'application/gzip'
  );
}

/**
 * Extract files from a ZIP archive using JSZip
 * Returns array of { name, blob, type, size }
 */
export async function extractFromZip(file) {
  try {
    // Dynamic import JSZip
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const extractedFiles = [];

    const entries = Object.entries(zip.files);
    for (const [path, zipEntry] of entries) {
      // Skip directories and hidden files
      if (zipEntry.dir) continue;
      if (path.startsWith('__MACOSX') || path.startsWith('.')) continue;

      const blob = await zipEntry.async('blob');
      const name = path.split('/').pop();
      const ext = (name.split('.').pop() || '').toLowerCase();

      // Determine content type
      let type = 'application/octet-stream';
      if (ext === 'pdf') type = 'application/pdf';
      else if (['jpg', 'jpeg'].includes(ext)) type = 'image/jpeg';
      else if (ext === 'png') type = 'image/png';
      else if (ext === 'xml') type = 'text/xml';
      else if (ext === 'csv') type = 'text/csv';
      else if (ext === 'txt') type = 'text/plain';
      else if (['doc', 'docx'].includes(ext)) type = 'application/msword';
      else if (['xls', 'xlsx'].includes(ext)) type = 'application/vnd.ms-excel';

      // Create a File object
      const extractedFile = new File([blob], name, { type });
      extractedFiles.push({
        name,
        file: extractedFile,
        type,
        size: blob.size,
        archivePath: path,
        sourceArchive: file.name || 'archive.zip'
      });
    }

    return {
      success: true,
      files: extractedFiles,
      totalFiles: extractedFiles.length
    };
  } catch (error) {
    console.error('Error extracting ZIP:', error);
    return {
      success: false,
      files: [],
      error: error.message
    };
  }
}

/**
 * Process a multi-page PDF: read each page, detect boundaries,
 * and return individual document segments with their extracted data
 */
export async function processMultiPagePDF(pageResults, filename) {
  const documents = detectDocumentBoundaries(pageResults);

  const results = documents.map((doc, idx) => {
    // Run invoiceExtractor on each document segment
    const extracted = invoiceExtractor.extractInvoiceData(doc.text);
    const docType = classifyPageType(doc.text) || extracted.documentType?.id || 'otros';

    return {
      index: idx,
      startPage: doc.startPage,
      endPage: doc.endPage,
      pageCount: doc.pages.length,
      text: doc.text,
      extracted,
      documentType: docType,
      label: `${filename} (pag ${doc.startPage}${doc.endPage !== doc.startPage ? '-' + doc.endPage : ''})`,
      confidence: extracted.confidence || 0
    };
  });

  return {
    totalDocuments: results.length,
    isMultiDocument: results.length > 1,
    documents: results
  };
}

export const multiDocProcessor = {
  detectDocumentBoundaries,
  isArchiveFile,
  extractFromZip,
  processMultiPagePDF,
  classifyPageType,
};

export default multiDocProcessor;
