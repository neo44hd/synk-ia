/**
 * integrationsService.js — FIXED v2
 *
 * CORRECCIONES EN ESTA VERSIÓN:
 * 1. UploadFile — guarda el objeto File en _pendingFiles (módulo en memoria) cuando
 *    el backend /api/files/upload no está disponible y se usa el fallback local://.
 *    Esto permite que ExtractDataFromUploadedFile acceda al archivo original.
 *
 * 2. ExtractDataFromUploadedFile — pipeline completo de extracción:
 *    a) Recupera el archivo de _pendingFiles (o hace fetch si es URL real)
 *    b) Extrae texto del PDF con PDF.js (client-side, sin backend)
 *    c) Intenta extracción estructurada con LLM → /api/ai/extract-document
 *    d) Fallback regex → invoiceExtractorService (sin LLM, 100% offline)
 *
 * ANTES: apiPost('/api/ai/classify', { text: `Archivo: ${file_url}` })
 *        → LLM solo veía la URL, nunca el contenido → resultado vacío
 * AHORA: Extrae texto real del PDF → LLM/regex → JSON estructurado
 *
 * 3. getPendingFile(url) — exportado para que useDocBrain.js pueda
 *    recuperar el File object cuando trabaja con URLs local://
 */

const API = '';

// ─── Mapa en memoria: file_url → File object ─────────────────────────────────
// Se rellena en UploadFile y se vacía al extraer.
// Exportamos el getter para que otros servicios (useDocBrain) puedan usarlo.
const _pendingFiles = new Map();

export function getPendingFile(url) {
  return _pendingFiles.get(url) || null;
}

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────
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

// ─── AI / LLM ─────────────────────────────────────────────────────────────────
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

// ─── Email ─────────────────────────────────────────────────────────────────────
export async function SendEmail({ to, subject, body, from_name = 'SYNKIA' }) {
  console.log('[SendEmail] To:', to, '| Subject:', subject);
  return { success: true, message: `Email preparado para ${to}` };
}

// ─── PDF.js loader (lazy, una sola vez) ───────────────────────────────────────
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

// ─── Extracción de texto de un File/Blob (client-side) ───────────────────────
/**
 * Extrae texto de un archivo PDF (o texto plano) en el navegador.
 * Para PDFs: usa PDF.js para leer el texto embebido.
 * Para otros tipos: usa File.text().
 * @param {File|Blob} fileOrBlob
 * @returns {Promise<string>}
 */
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

// ─── Mapeo regex → schema biloopSchema (invoices array) ─────────────────────
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

// ─── Mapeo regex → schema genérico de DocumentArchive ────────────────────────
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

// ─── Archivos ─────────────────────────────────────────────────────────────────
export async function UploadFile({ file }) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    // Guardamos también en memoria para que ExtractDataFromUploadedFile
    // pueda acceder al contenido del archivo si lo necesita
    if (data.url) _pendingFiles.set(data.url, file);
    return { file_url: data.url, file_id: data.id };
  } catch (err) {
    console.warn('[UploadFile] Backend no disponible, usando localStorage:', err.message);
    const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileUrl = `local://files/${fileId}`;
    const files = JSON.parse(localStorage.getItem('synkia_files') || '{}');
    files[fileId] = { name: file?.name, size: file?.size, type: file?.type, url: fileUrl, created: new Date().toISOString() };
    localStorage.setItem('synkia_files', JSON.stringify(files));
    // ← CLAVE: guardamos el File real para usar en ExtractDataFromUploadedFile
    _pendingFiles.set(fileUrl, file);
    return { file_url: fileUrl, file_id: fileId };
  }
}

export async function ExtractDataFromUploadedFile({ file_url, json_schema, extraction_schema }) {
  const schema = json_schema || extraction_schema;

  // 1. Intentar obtener el archivo real desde el mapa en memoria
  let file = _pendingFiles.get(file_url);

  // 2. Si no está en memoria y la URL es accesible, hacer fetch
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

  // 3. Sin archivo disponible → error con mensaje claro
  if (!file) {
    console.warn('[ExtractDataFromUploadedFile] Archivo no disponible:', file_url);
    return {
      status: 'error',
      output: null,
      details: 'Archivo no disponible en memoria. Sube el archivo de nuevo para extraer datos.',
    };
  }

  // 4. Extraer texto del PDF con PDF.js (client-side)
  const text = await extractTextFromFile(file);
  _pendingFiles.delete(file_url); // liberar memoria

  if (!text || text.trim().length < 20) {
    console.warn('[ExtractDataFromUploadedFile] PDF sin texto seleccionable');
    return {
      status: 'error',
      output: null,
      details: 'El PDF no contiene texto seleccionable (puede estar escaneado). Prueba a usar OCR.',
    };
  }

  // 5. Intentar extracción estructurada con LLM (si el backend está disponible)
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

  // 6. Fallback regex con invoiceExtractorService
  try {
    const { invoiceExtractor } = await import('./invoiceExtractorService.js');
    const regexResult = invoiceExtractor.extractInvoiceData(text);
    if (regexResult?.success) {
      // Si el schema espera { invoices: [...] }, usamos ese mapping; si no, el genérico
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

// ─── Clasificación de documentos ─────────────────────────────────────────────
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

// ─── Namespace compatible con base44 ─────────────────────────────────────────
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
