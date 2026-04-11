/**
 * integrationsService.js — FIXED v3
 *
 * Migrado parcialmente: mantiene localStorage como fallback para archivos
 * cuando el backend /api/files/upload no está disponible, pero registra
 * un warning en consola. El fallback es temporal y se loggea.
 */

const API = '';

// Mapa en memoria: file_url → File object
const _pendingFiles = new Map();

export function getPendingFile(url) {
  return _pendingFiles.get(url) || null;
}

// Helpers HTTP
async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// AI / LLM
export async function InvokeLLM({ prompt, response_json_schema, add_context_from_internet = false }) {
  const format = response_json_schema ? 'json' : 'text';
  const data = await apiPost('/api/ai/generate', {
    prompt,
    format,
    ...(response_json_schema ? { jsonSchema: response_json_schema } : {}),
    temperature: 0.2,
    maxTokens: 2048,
  });
  if (!data.success) throw new Error(data.error || 'LLM error');
  if (response_json_schema) {
    try { return JSON.parse(data.response); }
    catch { return data.response; }
  }
  return data.response;
}

export async function GetChatResponse({ userMessage, conversationHistory = [], systemPrompt = '' }) {
  const historyText = conversationHistory
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'Usuario' : 'SYNKIA'}: ${m.content}`)
    .join('\n');
  const prompt = historyText
    ? `${historyText}\nUsuario: ${userMessage}`
    : userMessage;
  const defaultSystem = `Eres SYNKIA Brain, el asistente de gestión empresarial de Chicken Palace Ibiza.
Ayudas con facturas, empleados, documentos, ventas Revo y contabilidad Biloop.
Responde SIEMPRE en español. Sé conciso y directo. Si no tienes datos exactos, dilo claramente.`;
  const data = await apiPost('/api/ai/generate', {
    prompt,
    system: systemPrompt || defaultSystem,
    temperature: 0.3,
    maxTokens: 512,
  });
  if (!data.success) throw new Error(data.error || 'Chat error');
  return { message: data.response, model: data.model };
}

// Email
export async function SendEmail({ to, subject, body, from_name = 'SYNKIA' }) {
  console.log('[SendEmail] To:', to, '| Subject:', subject);
  return { success: true, message: `Email preparado para ${to}` };
}

// PDF.js loader (lazy)
let _pdfJsLoading = null;
async function _loadPdfJs() {
  if (window.pdfjsLib) return;
  if (_pdfJsLoading) return _pdfJsLoading;
  _pdfJsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = () => reject(new Error('No se pudo cargar PDF.js'));
    document.head.appendChild(script);
  });
  return _pdfJsLoading;
}

// Extracción de texto de un File/Blob (client-side)
export async function extractTextFromFile(fileOrBlob) {
  if (!fileOrBlob) return '';

  const isPDF =
    fileOrBlob.type === 'application/pdf' ||
    (fileOrBlob.name || '').toLowerCase().endsWith('.pdf');

  if (!isPDF) {
    try { return await fileOrBlob.text(); } catch { return ''; }
  }

  try {
    await _loadPdfJs();
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText.trim();
  } catch (err) {
    console.error('[extractTextFromFile] PDF.js error:', err.message);
    return '';
  }
}

// Mapeo regex → schema biloopSchema (invoices array)
function _regexToInvoices(r) {
  return {
    invoices: [{
      provider_name:  r.provider?.name   || null,
      provider_cif:   r.provider?.cif?.value || null,
      invoice_number: r.invoiceNumber?.value || null,
      invoice_date:   r.invoiceDate?.value   || null,
      due_date:       r.dueDate?.value        || null,
      subtotal:       r.subtotal?.value       || null,
      iva:            r.iva?.value            || null,
      total:          r.total?.value          || null,
      status:         'pendiente',
      category:       r.documentType?.id     || 'otros',
    }],
  };
}

// Mapeo regex → schema genérico de DocumentArchive
function _regexToGeneric(r) {
  return {
    document_type:       r.documentType?.label || 'Otros',
    has_multiple_records: false,
    records:             [],
    provider_name:       r.provider?.name       || null,
    provider_cif:        r.provider?.cif?.value || null,
    invoice_number:      r.invoiceNumber?.value  || null,
    document_date:       r.invoiceDate?.value    || null,
    due_date:            r.dueDate?.value         || null,
    subtotal:            r.subtotal?.value        || null,
    iva:                 r.iva?.value             || null,
    amount:              r.total?.value           || null,
    summary: `${r.documentType?.label || 'Documento'} — extraído por análisis de texto`,
  };
}

// Archivos — mantiene localStorage como fallback con warning
export async function UploadFile({ file }) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    if (data.url) _pendingFiles.set(data.url, file);
    return { file_url: data.url, file_id: data.id };
  } catch (err) {
    // Fallback: localStorage con warning (temporal, se mantiene por compatibilidad)
    console.warn('[UploadFile] Backend no disponible, usando fallback localStorage temporal:', err.message);
    const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileUrl = `local://files/${fileId}`;
    try {
      const files = JSON.parse(localStorage.getItem('synkia_files') || '{}');
      files[fileId] = { name: file?.name, size: file?.size, type: file?.type, url: fileUrl, created: new Date().toISOString() };
      localStorage.setItem('synkia_files', JSON.stringify(files));
    } catch (storageErr) {
      console.warn('[UploadFile] Fallback localStorage también falló:', storageErr.message);
    }
    _pendingFiles.set(fileUrl, file);
    return { file_url: fileUrl, file_id: fileId };
  }
}

export async function ExtractDataFromUploadedFile({ file_url, json_schema, extraction_schema }) {
  const schema = json_schema || extraction_schema;

  let file = _pendingFiles.get(file_url);

  if (!file && file_url && !file_url.startsWith('local://')) {
    try {
      const response = await fetch(file_url);
      if (response.ok) {
        const blob = await response.blob();
        const name = file_url.split('/').pop() || 'document.pdf';
        file = new File([blob], name, { type: blob.type || 'application/pdf' });
      }
    } catch (e) {
      console.warn('[ExtractDataFromUploadedFile] fetch URL error:', e.message);
    }
  }

  if (!file) {
    console.warn('[ExtractDataFromUploadedFile] Archivo no disponible:', file_url);
    return {
      status: 'error',
      output: null,
      details: 'Archivo no disponible en memoria. Sube el archivo de nuevo para extraer datos.',
    };
  }

  const text = await extractTextFromFile(file);
  _pendingFiles.delete(file_url);

  if (!text || text.trim().length < 20) {
    console.warn('[ExtractDataFromUploadedFile] PDF sin texto seleccionable');
    return {
      status: 'error',
      output: null,
      details: 'El PDF no contiene texto seleccionable (puede estar escaneado). Prueba a usar OCR.',
    };
  }

  try {
    const data = await apiPost('/api/ai/extract-document', {
      text: text.substring(0, 8000),
      json_schema: schema,
      filename: file.name,
    });
    if (data.status === 'success' && data.output && typeof data.output === 'object') {
      console.log('[ExtractDataFromUploadedFile] LLM extraction OK');
      return { status: 'success', output: data.output };
    }
  } catch (llmErr) {
    console.warn('[ExtractDataFromUploadedFile] LLM no disponible, usando regex:', llmErr.message);
  }

  try {
    const { invoiceExtractor } = await import('./invoiceExtractorService.js');
    const regexResult = invoiceExtractor.extractInvoiceData(text);
    if (regexResult?.success) {
      const hasInvoicesKey = schema?.properties?.invoices;
      const output = hasInvoicesKey ? _regexToInvoices(regexResult) : _regexToGeneric(regexResult);
      if (output) {
        console.log('[ExtractDataFromUploadedFile] regex fallback OK');
        return { status: 'success', output, source: 'regex' };
      }
    }
  } catch (regexErr) {
    console.error('[ExtractDataFromUploadedFile] regex error:', regexErr.message);
  }

  return {
    status: 'error',
    output: null,
    details: 'No se pudo extraer información estructurada del documento.',
  };
}

// Clasificación de documentos
export async function ClassifyDocument({ text, filename }) {
  const data = await apiPost('/api/ai/classify', { text, filename });
  if (!data.success) throw new Error(data.error || 'Classification error');
  return data.classification;
}

export async function ClassifyEmail({ subject, body, from }) {
  const data = await apiPost('/api/ai/classify-email', { subject, body, from });
  if (!data.success) throw new Error(data.error || 'Email classification error');
  return data.classification;
}

// Namespace compatible con base44
export const AI = { GetChatResponse };
export const Core = { UploadFile, ExtractDataFromUploadedFile, InvokeLLM, UploadPrivateFile: UploadFile };

export default {
  InvokeLLM,
  GetChatResponse,
  SendEmail,
  UploadFile,
  ExtractDataFromUploadedFile,
  ClassifyDocument,
  ClassifyEmail,
  AI,
  Core,
};

export const integrationsService = {
  InvokeLLM,
  GetChatResponse,
  SendEmail,
  UploadFile,
  ExtractDataFromUploadedFile,
  ClassifyDocument,
  ClassifyEmail,
  AI,
  Core,
};
