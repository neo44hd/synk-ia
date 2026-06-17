/**
 * DOCUMENT AGENT — Sub-agente especializado en procesamiento de documentos
 * ======================================================================
 *
 * Recibe texto extraído + clasificación del orquestador y ejecuta:
 *   - Extracción estructurada de campos (via LLM + regex fallback)
 *   - Validación cruzada de datos
 *   - Detección de duplicados
 *   - Almacenamiento en entities/
 *   - Generación de resumen ejecutivo
 *
 * El ANALYZER AGENT existente (analyzerAgent.js) se reemplaza/integra aquí.
 */

import fs   from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(path.dirname(__dirname), '..', '..', 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(path.dirname(__dirname), '..', '..', 'uploads');

// ── Configuración — delegada al gateway centralizado ─────────────────────────
import { gatewayChat, runTask } from '../services/agentCore.js';

const GATEWAY_MODEL = process?.env?.DOC_AGENT_MODEL || 'local-reason';

// ── Prompt canónico para extracción de documentos ───────────────────────────

const EXTRACTION_PROMPT = `Eres el agente de extracción de documentos de SynK-IA para Chicken Palace Ibiza S.L.

REGLAS:
1. Analiza TODO el texto proporcionado
2. Extrae TODOS los campos del schema
3. Devuelve ÚNICAMENTE JSON válido, sin markdown ni texto adicional
4. Usa null para cualquier campo que no encuentres
5. Si hay múltiples facturas/registros en un solo PDF, inclúyelos TODOS en el array "records"
6. Los importes son números (sin símbolo €), las fechas en formato YYYY-MM-DD
7. Si el documento parece ser algo distinto al tipo indicado, corrige el tipo

Schema de salida:`;

/**
 * Procesa un documento según su clasificación.
 *
 * @param {Object} params
 * @param {string} params.text - Texto extraído del documento
 * @param {Object} params.classification - Resultado del clasificador
 * @param {string} params.filename - Nombre del archivo original
 * @param {string} [params.mimeType] - Tipo MIME
 * @returns {Promise<Object>} Resultado del procesamiento
 */
export async function process({ text, classification, filename, mimeType }) {
  const docType = classification?.docType || 'other';
  const subType = classification?.subType || null;
  const confidence = classification?.confidence || 0;

  console.log(`[DOC-AGENT] Procesando: ${filename} (tipo: ${docType}, confianza: ${(confidence * 100).toFixed(0)}%)`);

  let extracted = null;

  // ── Según el tipo, usar extracción específica ─────────────────────────
  switch (docType) {
    case 'invoice':
      extracted = await extractInvoiceFields(text, subType, confidence);
      break;

    case 'payroll':
      extracted = await extractPayrollFields(text, confidence);
      break;

    case 'receipt':
    case 'ticket':
      extracted = await extractReceiptFields(text, confidence);
      break;

    case 'delivery_note':
      extracted = await extractDeliveryNoteFields(text, confidence);
      break;

    case 'contract':
    case 'legal':
      extracted = await extractContractFields(text, docType, confidence);
      break;

    case 'bank_extract':
      extracted = await extractBankFields(text, confidence);
      break;

    case 'fiscal':
      extracted = await extractFiscalFields(text, confidence);
      break;

    case 'quote':
      extracted = await extractQuoteFields(text, confidence);
      break;

    default:
      extracted = await extractGenericFields(text, confidence);
  }

  // ── Validar datos extraídos ────────────────────────────────────────────
  const validation = validateExtractedData(extracted);

  // ── Buscar duplicados ──────────────────────────────────────────────────
  const duplicate = await checkDuplicate(extracted);

  // ── Almacenar ──────────────────────────────────────────────────────────
  const storageResult = await storeRecord(extracted, filename, docType);

  // ── Generar resumen ejecutivo ──────────────────────────────────────────
  const summary = generateExecutiveSummary(extracted, docType, confidence, duplicate);

  return {
    success: true,
    extracted,
    validation,
    isDuplicate: !!duplicate,
    duplicateOf: duplicate?.id || null,
    stored: storageResult,
    summary,
  };
}

// ── Extracción por tipo ───────────────────────────────────────────────────────

async function extractInvoiceFields(text, subType, confidence) {
  // Intentar extracción por LLM primero (alta confianza)
  if (confidence > 0.65) {
    try {
      const llmResult = await extractViaLLM(text, buildInvoiceSchema(), 'invoice');
      if (llmResult && llmResult.total != null) return llmResult;
    } catch (e) {
      console.warn('[DOC-AGENT] LLM extraction falló, usando regex:', e.message);
    }
  }

  // Fallback: regex
  return extractInvoiceViaRegex(text, subType);
}

async function extractPayrollFields(text, confidence) {
  if (confidence > 0.65) {
    try {
      const llmResult = await extractViaLLM(text, buildPayrollSchema(), 'payroll');
      if (llmResult) return llmResult;
    } catch (e) {
      console.warn('[DOC-AGENT] LLM extraction falló, usando regex:', e.message);
    }
  }
  return extractPayrollViaRegex(text);
}

async function extractReceiptFields(text, confidence) {
  if (confidence > 0.65) {
    try {
      const llmResult = await extractViaLLM(text, buildReceiptSchema(), 'receipt');
      if (llmResult) return llmResult;
    } catch (e) {}
  }
  return extractReceiptViaRegex(text);
}

async function extractDeliveryNoteFields(text, confidence) {
  if (confidence > 0.65) {
    try {
      const llmResult = await extractViaLLM(text, buildDeliveryNoteSchema(), 'delivery_note');
      if (llmResult) return llmResult;
    } catch (e) {}
  }
  return extractGenericViaRegex(text, 'delivery_note');
}

async function extractContractFields(text, docType, confidence) {
  if (confidence > 0.6) {
    try {
      const llmResult = await extractViaLLM(text, buildContractSchema(), docType);
      if (llmResult) return llmResult;
    } catch (e) {}
  }
  return extractGenericViaRegex(text, docType);
}

async function extractBankFields(text, confidence) {
  if (confidence > 0.6) {
    try {
      const llmResult = await extractViaLLM(text, buildBankSchema(), 'bank_extract');
      if (llmResult) return llmResult;
    } catch (e) {}
  }
  return extractGenericViaRegex(text, 'bank_extract');
}

async function extractFiscalFields(text, confidence) {
  if (confidence > 0.5) {
    try {
      const llmResult = await extractViaLLM(text, buildFiscalSchema(), 'fiscal');
      if (llmResult) return llmResult;
    } catch (e) {}
  }
  return extractGenericViaRegex(text, 'fiscal');
}

async function extractQuoteFields(text, confidence) {
  if (confidence > 0.65) {
    try {
      const llmResult = await extractViaLLM(text, buildQuoteSchema(), 'quote');
      if (llmResult) return llmResult;
    } catch (e) {}
  }
  return extractGenericViaRegex(text, 'quote');
}

async function extractGenericFields(text, confidence) {
  if (confidence > 0.5) {
    try {
      return await extractViaLLM(text, buildGenericSchema(), 'other');
    } catch (e) {}
  }
  return extractGenericViaRegex(text, 'other');
}

// ── Extracción vía LLM (gateway centralizado) ────────────────────────────────

async function extractViaLLM(text, schema, docType) {
  const schemaStr = JSON.stringify(schema, null, 2);
  const truncatedText = text.substring(0, 6000);
  const prompt = `${EXTRACTION_PROMPT}\n${schemaStr}\n\n---\nDOCUMENTO:\n${truncatedText}`;

  const { content } = await gatewayChat({
    system: `Eres un extractor de datos empresariales preciso. Devuelve SOLO JSON válido sin texto adicional.`,
    prompt,
    model: GATEWAY_MODEL,
    temperature: 0.1,
    maxTokens: 2048,
    json: true,
  });

  return JSON.parse(content);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

function buildInvoiceSchema() {
  return {
    type: 'object',
    properties: {
      document_type:     { type: 'string', const: 'invoice' },
      subtype:           { type: ['string', 'null'] },
      invoice_number:    { type: ['string', 'null'] },
      document_date:     { type: ['string', 'null'], format: 'date' },
      due_date:          { type: ['string', 'null'], format: 'date' },
      total:             { type: 'number' },
      base_imponible:    { type: ['number', 'null'] },
      iva_percentage:    { type: ['number', 'null'] },
      iva_total:         { type: ['number', 'null'] },
      irpf:              { type: ['number', 'null'] },
      payment_form:      { type: ['string', 'null'] },
      currency:          { type: 'string', default: 'EUR' },
      emisor: {
        type: 'object',
        properties: {
          name:    { type: ['string', 'null'] },
          cif_nif: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
          email:   { type: ['string', 'null'] },
          phone:   { type: ['string', 'null'] },
        },
      },
      receptor: {
        type: 'object',
        properties: {
          name:    { type: ['string', 'null'] },
          cif_nif: { type: ['string', 'null'] },
        },
      },
      concepts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description:  { type: ['string', 'null'] },
            quantity:     { type: 'number', default: 1 },
            unit_price:   { type: ['number', 'null'] },
            vat_percent:  { type: ['number', 'null'] },
            total:        { type: ['number', 'null'] },
          },
        },
      },
      dates: {
        type: 'object',
        properties: {
          document:   { type: ['string', 'null'] },
          due:        { type: ['string', 'null'] },
          payment:    { type: ['string', 'null'] },
        },
      },
      confidence:    { type: 'number' },
      summary:       { type: 'string' },
      tags:          { type: 'array', items: { type: 'string' } },
      recommended_action: { type: 'string' },
    },
    required: ['document_type', 'total', 'confidence', 'summary'],
  };
}

function buildPayrollSchema() {
  return {
    type: 'object',
    properties: {
      document_type:      { type: 'string', const: 'payroll' },
      employee_name:      { type: ['string', 'null'] },
      employee_dni:       { type: ['string', 'null'] },
      employee_nss:       { type: ['string', 'null'] },
      category:           { type: ['string', 'null'] },
      contract_type:      { type: ['string', 'null'] },
      group:              { type: ['string', 'null'] },
      seniority:          { type: ['string', 'null'] },
      salary_gross:       { type: 'number' },
      irpf:               { type: ['number', 'null'] },
      social_security_employee: { type: ['number', 'null'] },
      social_security_employer: { type: ['number', 'null'] },
      net_salary:         { type: 'number' },
      extra_hours:        { type: ['number', 'null'] },
      complementary_pay:  { type: ['number', 'null'] },
      period_start:       { type: ['string', 'null'] },
      period_end:         { type: ['string', 'null'] },
      payment_date:       { type: ['string', 'null'] },
      company_emitter:    { type: 'string', default: 'CHICKEN PALACE IBIZA, S.L.' },
      cif_emitter:        { type: 'string', default: 'B56908486' },
      confidence:         { type: 'number' },
      summary:            { type: 'string' },
    },
    required: ['document_type', 'employee_name', 'net_salary', 'confidence', 'summary'],
  };
}

function buildReceiptSchema() {
  return {
    type: 'object',
    properties: {
      document_type:   { type: 'string', const: 'receipt' },
      provider_name:   { type: ['string', 'null'] },
      provider_cif:    { type: ['string', 'null'] },
      receipt_number:  { type: ['string', 'null'] },
      date:            { type: ['string', 'null'] },
      total:           { type: 'number' },
      payment_form:    { type: ['string', 'null'] },
      confidence:      { type: 'number' },
      summary:         { type: 'string' },
    },
    required: ['document_type', 'total', 'confidence'],
  };
}

// ... schemas adicionales según necesidad

function buildDeliveryNoteSchema() {
  return {
    type: 'object',
    properties: {
      document_type:   { type: 'string', const: 'delivery_note' },
      provider_name:   { type: ['string', 'null'] },
      provider_cif:    { type: ['string', 'null'] },
      note_number:     { type: ['string', 'null'] },
      date:            { type: ['string', 'null'] },
      total:           { type: ['number', 'null'] },
      concepts:        { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, quantity: { type: 'number' } } } },
      confidence:      { type: 'number' },
      summary:         { type: 'string' },
    },
  };
}

function buildContractSchema() {
  return {
    type: 'object',
    properties: {
      document_type:      { type: 'string', const: 'contract' },
      contract_type:      { type: ['string', 'null'] },
      parties:            { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } } } },
      start_date:         { type: ['string', 'null'] },
      end_date:           { type: ['string', 'null'] },
      amount:             { type: ['number', 'null'] },
      currency:           { type: 'string', default: 'EUR' },
      key_clauses:        { type: 'array', items: { type: 'string' } },
      confidence:         { type: 'number' },
      summary:            { type: 'string' },
    },
  };
}

function buildFiscalSchema() {
  return {
    type: 'object',
    properties: {
      document_type:   { type: 'string', const: 'fiscal' },
      model_number:    { type: ['string', 'null'] },
      fiscal_year:     { type: ['string', 'null'] },
      period:          { type: ['string', 'null'] },
      amount:          { type: ['number', 'null'] },
      agency:          { type: ['string', 'null'] },
      deadline:        { type: ['string', 'null'] },
      is_paid:         { type: ['boolean', 'null'] },
      confidence:      { type: 'number' },
      summary:         { type: 'string' },
    },
  };
}

function buildBankSchema() {
  return {
    type: 'object',
    properties: {
      document_type:   { type: 'string', const: 'bank_extract' },
      account_number:  { type: ['string', 'null'] },
      bank_name:       { type: ['string', 'null'] },
      period_start:    { type: ['string', 'null'] },
      period_end:      { type: ['string', 'null'] },
      total_deposits:  { type: ['number', 'null'] },
      total_withdrawals:{ type: ['number', 'null'] },
      balance:         { type: ['number', 'null'] },
      transactions:    { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, description: { type: 'string' }, amount: { type: 'number' }, type: { type: 'string' } } } },
      confidence:      { type: 'number' },
      summary:         { type: 'string' },
    },
  };
}

function buildQuoteSchema() {
  return {
    type: 'object',
    properties: {
      document_type:   { type: 'string', const: 'quote' },
      provider_name:   { type: ['string', 'null'] },
      provider_cif:    { type: ['string', 'null'] },
      quote_number:    { type: ['string', 'null'] },
      date:            { type: ['string', 'null'] },
      validity_days:   { type: ['number', 'null'] },
      total:           { type: ['number', 'null'] },
      concepts:        { type: 'array', items: { type: 'object' } },
      confidence:      { type: 'number' },
      summary:         { type: 'string' },
    },
  };
}

function buildGenericSchema() {
  return {
    type: 'object',
    properties: {
      document_type:   { type: 'string' },
      confidence:      { type: 'number' },
      summary:         { type: 'string' },
      key_info:        { type: 'array', items: { type: 'string' } },
    },
    required: ['document_type', 'summary'],
  };
}

// ── Extracción vía regex (fallback) ──────────────────────────────────────────

function extractInvoiceViaRegex(text, subType) {
  const result = {
    document_type:    'invoice',
    subtype:          subType || null,
    confidence:       0.5,
    summary:          'Extracción regex — verificar datos',
    recommended_action: 'revisar',
  };

  // Número de factura
  const numMatch = text.match(/(?:factura|invoice|fra\.?|n[uú]m(?:ero)?)[.:\s#]*([A-Z0-9\/\-]{3,30})/i);
  result.invoice_number = numMatch ? numMatch[1].trim() : null;

  // Total
  const totalMatch = text.match(/(?:total(?:\s+(?:factura|a\s+pagar|iva\s+inc\w*|general))?|importe\s+total)[:\s€]*(?:\w+\s)?([0-9.,]+)/i);
  result.total = totalMatch ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.')) || null : null;

  // Base imponible
  const baseMatch = text.match(/(?:base\s+imponible|base\s+imp\.?|sujeta\s+pasiva)[:\s€]*(?:\w+\s)?([0-9.,]+)/i);
  result.base_imponible = baseMatch ? parseFloat(baseMatch[1].replace(/\./g, '').replace(',', '.')) || null : null;

  // IVA
  const ivaMatch = text.match(/(?:iva\s+(?:total|incluido|general))[:\s€]*(?:\w+\s)?([0-9.,]+)/i);
  result.iva_total = ivaMatch ? parseFloat(ivaMatch[1].replace(/\./g, '').replace(',', '.')) || null : null;

  // Fecha
  const dateMatch = text.match(/(?:fecha)[:\s]*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i);
  result.document_date = dateMatch ? normalizeDate(dateMatch[1]) : null;

  // Proveedor
  const provMatch = text.match(/^([A-ZÁÉÍÓÚÑA-Z ,.\&]{5,80})/m);
  result.emisor = {
    name:    provMatch ? provMatch[1].trim() : null,
    cif_nif: null,
  };

  result.iva_percentage = result.base_imponible && result.iva_total
    ? Math.round((result.iva_total / result.base_imponible) * 100)
    : null;

  result.irpf = null;
  result.currency = 'EUR';
  result.receptor = { name: 'CHICKEN PALACE IBIZA, S.L.', cif_nif: 'B56908486' };
  result.tags = ['factura', 'regex-extraction'];

  return result;
}

function extractPayrollViaRegex(text) {
  // Implementación simplificada — en producción usaría LLM
  return {
    document_type:      'payroll',
    employee_name:      null,
    employee_dni:       null,
    salary_gross:       null,
    net_salary:         null,
    irpf:               null,
    social_security_employee: null,
    social_security_employer: null,
    period_start:       null,
    period_end:         null,
    extra_hours:        null,
    confidence:         0.4,
    summary:            'Nómina detectada pero requiere extracción LLM',
    recommended_action: 'revisar',
    company_emitter:    'CHICKEN PALACE IBIZA, S.L.',
    cif_emitter:        'B56908486',
  };
}

function extractReceiptViaRegex(text) {
  return {
    document_type:   'receipt',
    provider_name:   null,
    provider_cif:    null,
    receipt_number:  null,
    date:            null,
    total:           null,
    payment_form:    null,
    confidence:      0.4,
    summary:         'Recibo detectado — extracción regex insuficiente',
    tags:            ['recibo'],
  };
}

function extractDeliveryNoteViaRegex(text) {
  return {
    document_type:   'delivery_note',
    provider_name:   null,
    note_number:     null,
    date:            null,
    total:           null,
    concepts:        [],
    confidence:      0.4,
    summary:         'Albarán detectado — requiere extracción LLM',
    tags:            ['albaran'],
  };
}

function extractContractViaRegex(text) {
  return {
    document_type:  'contract',
    contract_type:  null,
    parties:        [],
    start_date:     null,
    end_date:       null,
    amount:         null,
    currency:       'EUR',
    key_clauses:    [],
    confidence:     0.35,
    summary:        'Contrato detectado — requiere extracción LLM',
    tags:           ['contrato'],
  };
}

function extractBankViaRegex(text) {
  return {
    document_type:   'bank_extract',
    account_number:  null,
    transactions:    [],
    total_deposits:  null,
    total_withdrawals: null,
    balance:         null,
    confidence:      0.35,
    summary:         'Extracto bancario detectado — requiere extracción LLM',
    tags:            ['banco', 'extracto'],
  };
}

function extractGenericViaRegex(text, docType) {
  return {
    document_type:   docType,
    key_info:        [],
    confidence:      0.3,
    summary:         `Documento tipo "${docType}" — requiere extracción LLM`,
    tags:            [docType],
  };
}

// ── Validación ────────────────────────────────────────────────────────────────

function validateExtractedData(data) {
  const issues = [];

  // Validar importes
  if (data.total) {
    if (typeof data.total !== 'number' || isNaN(data.total) || data.total < 0) {
      issues.push({ field: 'total', issue: 'Importe total inválido', severity: 'error' });
    }
    if (data.base_imponible && data.base_imponible > data.total * 1.5) {
      issues.push({ field: 'base_imponible', issue: 'Base imponible superior al total (posible error)', severity: 'warning' });
    }
  }

  // Validar fechas
  if (data.document_date && data.due_date) {
    if (new Date(data.due_date) < new Date(data.document_date)) {
      issues.push({ field: 'due_date', issue: 'Fecha de vencimiento anterior a fecha de documento', severity: 'error' });
    }
  }

  // Validar proveedor
  if (data.emisor && !data.emisor.name) {
    issues.push({ field: 'emisor.name', issue: 'Proveedor no identificado', severity: 'warning' });
  }

  // Validar IVA
  if (data.iva_total && data.base_imponible) {
    const calculatedIVA = data.base_imponible * 0.21;
    if (Math.abs(data.iva_total - calculatedIVA) / calculatedIVA > 0.05) {
      issues.push({ field: 'iva_total', issue: `IVA difiere del 21% esperado`, severity: 'info' });
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
  };
}

// ── Detección de duplicados ───────────────────────────────────────────────────

async function checkDuplicate(extracted) {
  if (!extracted.invoice_number) return null;

  try {
    const invoicesPath = path.join(DATA_DIR, 'invoice.json');
    if (!await fileExists(invoicesPath)) return null;

    const data = JSON.parse(await fs.readFile(invoicesPath, 'utf8'));
    if (!Array.isArray(data)) return null;

    return data.find(inv =>
      inv.invoice_number === extracted.invoice_number &&
      inv.provider_name === extracted.emisor?.name
    ) || null;
  } catch (_) {
    return null;
  }
}

// ── Almacenamiento ────────────────────────────────────────────────────────────

async function storeRecord(extracted, filename, docType) {
  const entityMap = {
    invoice:    'invoice',
    payroll:    'payroll',
    receipt:    'invoice',  // Los recibos van con facturas
    quote:      'invoice',
  };

  const entityName = entityMap[docType] || 'document';
  const entityPath = path.join(DATA_DIR, `${entityName}.json`);

  try {
    let records = [];
    if (await fileExists(entityPath)) {
      records = JSON.parse(await fs.readFile(entityPath, 'utf8'));
    }

    const newRecord = {
      id:              `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ...extracted,
      filename,
      doc_type:        docType,
      processed_at:    new Date().toISOString(),
      source:          extracted.source || 'orchestrator',
    };

    records.push(newRecord);
    await fs.mkdir(path.dirname(entityPath), { recursive: true });
    await fs.writeFile(entityPath, JSON.stringify(records, null, 2));

    console.log(`[DOC-AGENT] Guardado como ${entityName} #${newRecord.id}`);
    return { entity: entityName, id: newRecord.id, success: true };

  } catch (err) {
    console.error(`[DOC-AGENT] Error almacenando:`, err.message);
    return { entity: entityName, success: false, error: err.message };
  }
}

// ── Resumen ejecutivo ────────────────────────────────────────────────────────

function generateExecutiveSummary(extracted, docType, confidence, duplicate) {
  const parts = [];

  switch (docType) {
    case 'invoice':
      parts.push(`Factura${extracted.invoice_number ? ` #${extracted.invoice_number}` : ''}`);
      if (extracted.emisor?.name) parts.push(`de ${extracted.emisor.name}`);
      if (extracted.total) parts.push(`por ${extracted.total}€`);
      if (extracted.document_date) parts.push(`fecha: ${extracted.document_date}`);
      break;

    case 'payroll':
      parts.push('Nómina');
      if (extracted.employee_name) parts.push(`de ${extracted.employee_name}`);
      if (extracted.net_salary) parts.push(`neto: ${extracted.net_salary}€`);
      if (extracted.period_start) parts.push(`período: ${extracted.period_start} - ${extracted.period_end}`);
      break;

    case 'receipt':
      parts.push('Recibo');
      if (extracted.total) parts.push(`por ${extracted.total}€`);
      break;

    default:
      parts.push(docType);
  }

  if (duplicate) {
    parts.push(`⚠️ POSIBLE DUPLICADO de ${duplicate.id}`);
  }

  return parts.join(' — ') || `Documento tipo ${docType}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeDate(str) {
  if (!str || typeof str !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim();

  const patterns = [
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    /^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/,
    /^(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+)?(\d{4})$/i,
  ];

  const meses = {
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
    julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
  };

  for (const p of patterns) {
    const m = str.trim().match(p);
    if (m) {
      let d, mo, y;
      if (p === patterns[2]) {
        d = parseInt(m[1]); mo = meses[m[2].toLowerCase()]; y = parseInt(m[3]);
      } else if (parseInt(m[1]) > 31) {
        y = parseInt(m[1]); mo = parseInt(m[2]); d = parseInt(m[3]);
      } else {
        d = parseInt(m[1]); mo = parseInt(m[2]); y = parseInt(m[3]);
      }
      if (y && mo && d && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

async function fileExists(path) {
  try { await fs.access(path); return true; } catch { return false; }
}