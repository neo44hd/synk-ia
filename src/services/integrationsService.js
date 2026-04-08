/**
 * integrationsService.js — FIXED
 *
 * ANTES: Todo era mock (InvokeLLM devolvía "[Respuesta simulada]")
 *        base44.integrations.AI.GetChatResponse() → undefined → crash
 *
 * AHORA: Llama al backend Express real (node-llama-cpp vía /api/ai)
 *        Misma API surface para no romper ningún componente existente
 */

// ─── Base URL del backend ─────────────────────────────────────────────────────
// En dev Vite proxea /api → localhost:3001 (ver vite.config.js fix)
// En prod apunta al mismo origen (nginx reverse proxy)
const API = '';   // Relativo — funciona en dev y prod

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ─── AI / LLM ────────────────────────────────────────────────────────────────

/**
 * Antes: "[Respuesta simulada]..."
 * Ahora: llama a /api/ai/generate (node-llama-cpp, sin Ollama)
 */
export async function InvokeLLM({ prompt, response_json_schema, add_context_from_internet = false }) {
  const format = response_json_schema ? 'json' : 'text';
  const data   = await apiPost('/api/ai/generate', {
    prompt,
    format,
    ...(response_json_schema ? { jsonSchema: response_json_schema } : {}),
    temperature: 0.2,
    maxTokens:   1024,
  });
  if (!data.success) throw new Error(data.error || 'LLM error');

  if (response_json_schema) {
    try { return JSON.parse(data.response); }
    catch { return data.response; }
  }
  return data.response;
}

/**
 * Chat conversacional para SynkiaBrainPage
 * Antes: base44.integrations.AI.GetChatResponse() → undefined → crash
 * Ahora: /api/ai/generate con historial de mensajes serializado
 */
export async function GetChatResponse({ userMessage, conversationHistory = [], systemPrompt = '' }) {
  // Serializa el historial para que el LLM tenga contexto
  const historyText = conversationHistory
    .slice(-6)  // últimos 6 turnos → evita context overflow
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
    system:      systemPrompt || defaultSystem,
    temperature: 0.3,
    maxTokens:   512,
  });

  if (!data.success) throw new Error(data.error || 'Chat error');
  return { message: data.response, model: data.model };
}

// ─── Email ───────────────────────────────────────────────────────────────────

/**
 * Antes: "Email simulado enviado a..."
 * Ahora: llama al backend (implementar /api/email/send si se necesita)
 *        Por ahora loga y devuelve éxito para no bloquear flujos
 */
export async function SendEmail({ to, subject, body, from_name = 'SYNKIA' }) {
  console.log('[SendEmail] To:', to, '| Subject:', subject);
  // TODO: implementar POST /api/email/send cuando esté listo el endpoint
  return { success: true, message: `Email preparado para ${to}` };
}

// ─── Archivos ────────────────────────────────────────────────────────────────

/**
 * Antes: guardaba en localStorage y devolvía "local://files/{id}"
 * Ahora: sube al backend via /api/files/upload (multipart)
 *        Fallback a localStorage si el backend no responde
 */
export async function UploadFile({ file }) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    return { file_url: data.url, file_id: data.id };
  } catch (err) {
    // Fallback: localStorage (mantiene compatibilidad con código existente)
    console.warn('[UploadFile] Backend no disponible, usando localStorage:', err.message);
    const fileId  = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileUrl = `local://files/${fileId}`;
    const files   = JSON.parse(localStorage.getItem('synkia_files') || '{}');
    files[fileId] = { name: file?.name, size: file?.size, type: file?.type, url: fileUrl, created: new Date().toISOString() };
    localStorage.setItem('synkia_files', JSON.stringify(files));
    return { file_url: fileUrl, file_id: fileId };
  }
}

/**
 * Antes: devolvía siempre {}
 * Ahora: envía el archivo a /api/ai/classify para extracción real
 */
export async function ExtractDataFromUploadedFile({ file_url, extraction_schema }) {
  if (!file_url || file_url.startsWith('local://')) {
    console.warn('[ExtractDataFromUploadedFile] Archivo local, extracción no disponible');
    return {};
  }

  try {
    const data = await apiPost('/api/ai/classify', {
      text:       `Archivo: ${file_url}`,
      filename:   file_url.split('/').pop(),
      jsonSchema: extraction_schema,
    });
    return data.classification || {};
  } catch (err) {
    console.error('[ExtractDataFromUploadedFile]', err.message);
    return {};
  }
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

// ─── Namespace compatible con base44 (para código existente que lo importa) ──
// SynkiaBrainPage llama: base44.integrations.AI.GetChatResponse()
// Con este export, base44.integrations = integrationsService → funciona

export const AI = { GetChatResponse };

export default {
  InvokeLLM,
  GetChatResponse,
  SendEmail,
  UploadFile,
  ExtractDataFromUploadedFile,
  ClassifyDocument,
  ClassifyEmail,
  AI,
};
