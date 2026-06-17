/**
 * CLASSIFIER — Clasificador universal de inputs para SynK-IA
 * ==========================================================
 * Determina tipo, prioridad, agente destino y confianza de
 * cualquier input que entre al sistema (archivo, texto, email).
 *
 * Uso:
 *   const result = await classify({ text, filename, mimeType, source });
 *   → { docType, subType, priority, confidence, targetAgent }
 */

import { Router } from 'express';
import { gatewayChat } from '../services/agentCore.js';

const GATEWAY_URL = process?.env?.LMSTUDIO_URL || 'http://127.0.0.1:4000/v1';
const GATEWAY_MODEL = process?.env?.CLASSIFY_MODEL || 'local-fast';

// ── Tipos y mapeos ────────────────────────────────────────────────────────────

/** Tipos de documento reconocidos */
export const DOC_TYPES = {
  INVOICE:          'invoice',
  PAYROLL:          'payroll',
  RECEIPT:          'receipt',
  DELIVERY_NOTE:    'delivery_note',
  CONTRACT:         'contract',
  BANK_EXTRACT:     'bank_extract',
  LEGAL:            'legal',
  FISCAL:           'fiscal',
  TICKET:           'ticket',
  QUOTE:            'quote',
  EMAIL:            'email',
  SPAM:             'spam',
  OTHER:            'other',
};

/** Subtipos específicos para enriquecer la clasificación */
const SUBTYPES = {
  invoice: [
    'food_supplier', 'utility', 'delivery_platform', 'cleaning',
    'maintenance', 'rent', 'insurance', 'software', 'professional_service',
    'tax_advisory', 'office_supplies', 'other',
  ],
  payroll: ['regular', 'severance', 'extra_pay', 'adjustment'],
  email:   ['invoice_notification', 'order_confirmation', 'complaint',
            'quote_request', 'payment_reminder', 'newsletter', 'internal'],
  legal:   ['contract', 'clause_review', 'notification', 'court_summons'],
};

/** Agentes destino disponibles */
export const TARGET_AGENTS = {
  DOCUMENT:    'document',     // Analizador de documentos (analyzerAgent)
  EMAIL:       'email',        // Procesador de emails (emailAgent)
  ACCOUNTING:  'accounting',   // Conciliación contable
  LEGAL:       'legal',        // Revisión legal
  ANALYTICS:   'analytics',    // Dashboards y reportes
  REVIEW:      'review',       // Cola de revisión humana
};

/** Umbral de confianza mínimo para procesamiento automático */
const AUTO_PROCESS_THRESHOLD = 0.60;

// ── Prompt del sistema canónico ───────────────────────────────────────────────

const SYSTEM_CLASSIFY = `Eres el clasificador universal de SynK-IA, el sistema de gestión de Chicken Palace Ibiza S.L.

TU MISIÓN: Analizar el input recibido y clasificarlo con precisión.

REGLAS:
1. Analiza TODO el texto antes de clasificar
2. Devuelve ÚNICAMENTE JSON válido, sin texto adicional
3. Sé conservador con la confianza — si dudas, baja la confianza
4. El campo "targetAgent" determina qué agente especializado procesará el input
5. Para emails, prioriza la acción sugerida sobre la clasificación

FORMATO DE RESPUESTA (JSON estricto):
{
  "docType": "invoice|payroll|receipt|delivery_note|contract|bank_extract|legal|fiscal|ticket|quote|email|spam|other",
  "subType": "food_supplier|utility|delivery_platform|... o null si no aplica",
  "priority": "urgent|high|normal|low",
  "confidence": 0.0-1.0,
  "targetAgent": "document|email|accounting|legal|analytics|review",
  "requiresHumanReview": true|false,
  "summary": "Una frase describiendo el contenido",
  "reasoning": "Breve explicación de por qué se asigna esta clasificación"
}

REGLAS DE PRIORIDAD:
- "urgent": multas, notificaciones hacienda, embargos, plazos inminentes (< 7 días)
- "high": facturas vencidas, nóminas con error, contratos próximos a expirar
- "normal": documentos rutinarios sin acción inmediata
- "low": informativos, newsletters, confirmaciones sin acción

REGLAS DE AGENTE DESTINO:
- invoice, receipt, delivery_note, quote → "document" (extracción + almacenamiento)
- payroll, bank_extract, fiscal → "accounting" (contabilidad + conciliación)
- contract, legal docs, notifications → "legal" (revisión jurídica)
- email → "email" (procesamiento de correo)
- ticket → "document" (almacenamiento)
- Si confidence < ${AUTO_PROCESS_THRESHOLD} → "review" (revisión humana)

REGLAS DE CONFIANZA:
- 0.9+ = Seguro (documento claro, sin ambigüedad)
- 0.7-0.89 = Razonable (posibles detalles menores)
- 0.5-0.69 = Dudoso (mejor revisión humana)
- < 0.5 = Inseguro (revisión humana obligatoria)
`;

// ── Parser robusto de JSON ────────────────────────────────────────────────────

/** Fallback cuando no se puede clasificar */
function buildFallback(reason) {
  return {
    docType:          'other',
    subType:          null,
    priority:         'normal',
    confidence:       0,
    targetAgent:      'review',
    requiresHumanReview: true,
    summary:          reason,
    reasoning:        reason,
  };
}

/**
 * Intenta múltiples estrategias para extraer JSON válido de la respuesta del LLM.
 * NUNCA devuelve null — siempre tiene un fallback.
 */
export function parseClassification(raw, textLength = 0) {
  if (!raw || typeof raw !== 'string') {
    return buildFallback('respuesta vacía');
  }

// Limpiar artefactos del LLM
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/<Chain_of_Thought>[\s\S]*?<\/Chain_of_Thought>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    // qwen36-tools: "Here's a thinking process:" + lista numerada antes del JSON
    .replace(/Here's a (?:deep )?thinking process:[\s\S]*?(?=\n\s*\n\s*\{)/gi, '')
    .replace(/Thought process:[\s\S]*?(?=\n\s*\n\s*\{)/gi, '')
    .replace(/Let me think[\s\S]*?(?=\n\s*\n\s*\{)/gi, '')
    .replace(/Reasoning:[\s\S]*?(?=\n\s*\n\s*\{)/gi, '')
    .trim();

  // Estrategia 1: parseo directo
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return validateAndNormalize(parsed, textLength);
  } catch (_) {}

  // Estrategia 2: encontrar primer { ... } balanceado
  const block = extractJSONBlock(cleaned);
  if (block) {
    try {
      const parsed = JSON.parse(block);
      if (parsed && typeof parsed === 'object') return validateAndNormalize(parsed, textLength);
    } catch (_) {}

    // Estrategia 3: reparar y reintentar
    const repaired = repairJSON(block);
    try {
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object') return validateAndNormalize(parsed, textLength);
    } catch (_) {}
  }

  // Estrategia 4: regex para campos clave
  const extracted = extractFieldsFromText(cleaned);
  if (extracted) return validateAndNormalize(extracted, textLength);

  // Último recurso
  return buildFallback('parseo fallido');
}

function extractJSONBlock(text) {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function repairJSON(str) {
  let s = str.trim();
  s = s.replace(/,\s*([}\]])/g, '$1');
  s = s.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  // Cerrar bloques pendientes
  const opens = (s.match(/\{/g) || []).length;
  const closes = (s.match(/\}/g) || []).length;
  return s + '}'.repeat(Math.max(0, opens - closes));
}

function extractFieldsFromText(text) {
  const result = {};

  const typeMatch = text.match(/(?:tipo|type|document_type)\s*[:=]\s*"?(\w+)"?/i);
  if (typeMatch) result.docType = typeMatch[1].toLowerCase();

  const confMatch = text.match(/(?:confianza|confidence)\s*[:=]\s*([\d.]+)/i);
  if (confMatch) result.confidence = parseFloat(confMatch[1]);

  const prioMatch = text.match(/(?:prioridad|priority)\s*[:=]\s*"?(\w+)"?/i);
  if (prioMatch) result.priority = prioMatch[1].toLowerCase();

  const summaryMatch = text.match(/(?:resumen|summary)\s*[:=]\s*"?([^"\n]+)"?/i);
  if (summaryMatch) result.summary = summaryMatch[1].trim();

  return Object.keys(result).length >= 2 ? result : null;
}

// ── Validación y normalización ────────────────────────────────────────────────

const VALID_DOC_TYPES = Object.values(DOC_TYPES);
const VALID_PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const VALID_AGENTS = Object.values(TARGET_AGENTS);

function validateAndNormalize(obj, textLength) {
  const result = { ...obj };

  // docType — validar o inferir
  if (!result.docType || !VALID_DOC_TYPES.includes(result.docType)) {
    result.docType = inferDocType(result, textLength);
  }

  // confidence — forzar rango [0, 1]
  result.confidence = Math.min(1, Math.max(0, parseFloat(result.confidence) || 0.5));

  // priority — validar
  if (!VALID_PRIORITIES.includes(result.priority)) {
    result.priority = inferPriority(result);
  }

  // targetAgent — validar o derivar
  if (!result.targetAgent || !VALID_AGENTS.includes(result.targetAgent)) {
    result.targetAgent = deriveAgent(result);
  }

  // requiresHumanReview — si confidence < threshold
  if (result.requiresHumanReview == null) {
    result.requiresHumanReview = result.confidence < AUTO_PROCESS_THRESHOLD;
  }

  // summary — generar si falta
  if (!result.summary) {
    result.summary = generateSummary(result);
  }

  // reasoning — requerido
  if (!result.reasoning) {
    result.reasoning = `Clasificado como ${result.docType} con confianza ${(result.confidence * 100).toFixed(0)}%`;
  }

  return result;
}

function inferDocType(obj) {
  const keywords = {
    invoice:   ['factura', 'invoice', 'fra.', 'número factura', 'importe total'],
    payroll:   ['nómina', 'payroll', 'payslip', 'salario', 'base imponible', 'irpf'],
    receipt:   ['recibo', 'receipt', 'ticket'],
    delivery_note: ['albarán', 'delivery note', 'entrega'],
    contract:  ['contrato', 'contract', 'cláusula', 'firmado'],
    bank_extract: ['extracto bancario', 'bank statement', 'movimiento'],
    legal:     ['notificación', 'notification', 'juzgado', 'sentencia', 'acta'],
    fiscal:    ['modelo 303', 'iva trimestral', 'declaración', 'aeat'],
    ticket:    ['ticket', 'tique', 'factura simplificada'],
    quote:     ['presupuesto', 'quote', 'cotización', 'proforma'],
    email:     ['de:', 'asunto:', 'email', 'correo'],
    spam:      ['spam', 'publicidad', 'marketing', 'newsletter'],
  };

  const text = JSON.stringify(obj).toLowerCase();
  let bestMatch = 'other';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(keywords)) {
    const score = keywords.reduce((s, kw) => s + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  return bestScore > 0 ? bestMatch : 'other';
}

function inferPriority(obj) {
  const urgentKeywords = ['multa', 'fine', 'urgent', 'embargo', 'imminent', 'vencido', 'overdue'];
  const highKeywords = ['vencimiento', 'due date', 'pendiente', 'overdue', 'error', 'incidencia'];

  const text = JSON.stringify(obj).toLowerCase();
  if (urgentKeywords.some(k => text.includes(k))) return 'urgent';
  if (highKeywords.some(k => text.includes(k))) return 'high';
  if (obj.docType === 'email' && obj.subType === 'newsletter') return 'low';
  return 'normal';
}

function deriveAgent(obj) {
  const agentMap = {
    invoice:       'document',
    receipt:       'document',
    delivery_note: 'document',
    quote:         'document',
    ticket:        'document',
    contract:      'legal',
    payroll:       'accounting',
    bank_extract:  'accounting',
    fiscal:        'accounting',
    legal:         'legal',
    email:         'email',
    spam:          'review',
    other:         'review',
  };

  const agent = agentMap[obj.docType];
  return obj.confidence < AUTO_PROCESS_THRESHOLD ? 'review' : (agent || 'review');
}

function generateSummary(obj) {
  const parts = [];
  if (obj.docType) parts.push(`Tipo: ${obj.docType}`);
  if (obj.summary) parts.push(obj.summary);
  else if (obj.reasoning) parts.push(obj.reasoning.slice(0, 100));
  return parts.join(' — ') || 'Documento sin resumen';
}

// ── Clasificación por LLM ─────────────────────────────────────────────────────

async function llmClassify(prompt) {
  // Delega en el servicio central (gateway). El modelo se resuelve por env CLASSIFY_MODEL.
  const { content } = await gatewayChat({
    system: SYSTEM_CLASSIFY,
    prompt,
    model: process?.env?.CLASSIFY_MODEL || 'local-fast',
    temperature: 0.1,
    maxTokens: 512,
    json: true,
  });
  return content;
}

// ── Clasificación directa por LLM ─────────────────────────────────────────────

/**
 * Clasifica un input usando Ollama o LM Studio según configuración.
 * @param {Object} params
 * @param {string} [params.text] - Texto del documento
 * @param {string} [params.filename] - Nombre del archivo
 * @param {string} [params.mimeType] - Tipo MIME
 * @param {string} [params.source] - 'upload', 'email', 'api', 'auto'
 * @returns {Promise<Object>} Resultado de clasificación
 */
export async function classify({ text = '', filename = 'desconocido', mimeType, source = 'api' }) {
  // Preparar prompt
  const truncatedText = text.substring(0, 4000);
  const prompt = `Clasifica este input del sistema SynK-IA (Chicken Palace Ibiza):

ARCHIVO: ${filename}
FUENTE: ${source}
CONTENIDO:
${truncatedText}

Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional.`;

  try {
    const rawContent = await llmClassify(prompt);
    console.log(`[CLASSIFIER] Respuesta cruda: ${rawContent.substring(0, 200)}...`);
    return parseClassification(rawContent, truncatedText.length);

  } catch (err) {
    console.error('[CLASSIFIER] Error en clasificación:', err.message);
    return {
      docType: 'other',
      subType: null,
      priority: 'normal',
      confidence: 0.0,
      targetAgent: 'review',
      requiresHumanReview: true,
      summary: `Error de clasificación: ${err.message}`,
      reasoning: `Error al conectar con LLM: ${err.message}`,
      _error: true,
    };
  }
}

// ── Endpoint Express ──────────────────────────────────────────────────────

export const classifierRouter = Router();

classifierRouter.post('/classify', async (req, res) => {
  const { text, filename, mimeType, source } = req.body;

  if (!text && !req.files?.length) {
    return res.status(400).json({ error: 'Se requiere "text" o un archivo adjunto' });
  }

  try {
    const inputText = text || (req.files?.[0]?.text || '');
    const result = await classify({
      text: inputText,
      filename: filename || (req.files?.[0]?.originalname || 'desconocido'),
      mimeType: mimeType || (req.files?.[0]?.mimetype),
      source: source || 'api',
    });
    res.json({ success: true, classification: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

classifierRouter.get('/test', async (_req, res) => {
  try {
    const r = await fetch(`${GATEWAY_URL}/models`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Gateway ${r.status}`);
    const data = await r.json();
    const models = (data.data || []).map(m => m.id || m);
    res.json({ success: true, models, engine: 'gateway', active_model: GATEWAY_MODEL });
  } catch (err) {
    res.json({ success: false, error: err.message, engine: 'gateway' });
  }
});
