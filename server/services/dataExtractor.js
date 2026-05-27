/**
 * dataExtractor.js — Extractor de campos de documentos
 * ======================================================
 * Regex/heurísticas primero + Ollama local para enriquecimiento.
 * Soporta: Factura, Contrato, PO
 * Confianza por campo.
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');
const EXTRACTIONS_DB = join(DATA_DIR, 'extractions.json');

mkdirSync(DATA_DIR, { recursive: true });

// ─── DB LOW-LEVEL ────────────────────────────────────────────────────
function _loadDB() {
  try {
    if (existsSync(EXTRACTIONS_DB)) {
      return JSON.parse(readFileSync(EXTRACTIONS_DB, 'utf-8'));
    }
  } catch (e) {
    console.error('[DataExtractor] Error loading DB:', e.message);
  }
  return { extractions: [] };
}

function _saveDB(db) {
  writeFileSync(EXTRACTIONS_DB, JSON.stringify(db, null, 2), 'utf-8');
}

function _nextId() {
  const db = _loadDB();
  const max = db.extractions.reduce((m, e) => {
    const n = parseInt((e.id || '').replace('ext_', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `ext_${max + 1}_${Date.now().toString(36)}`;
}

// ─── REGEX PATTERNS ──────────────────────────────────────────────────
const PATTERNS = {
  // Números de documento
  invoiceNumber: /(?:factura|invoice|nº|no\.?|número)[\s:]*[#]?([A-Z0-9\-\/]+)/i,
  poNumber: /(?:po|purchase order|order|pedido)[\s:]*[#]?([A-Z0-9\-\/]+)/i,
  
  // Fechas (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  date: /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/g,
  
  // Montos (12345.67, 12,345.67, 12345,67)
  amount: /(?:total|subtotal|amount|monto|importe|suma)[\s:]*[€$£]?\s*([\d.,]+)/i,
  
  // NIF/CIF/VAT
  nif: /(?:nif|cif|vat|vat id|tax id)[\s:]*([A-Z0-9]{8,})/i,
  
  // Email
  email: /\b([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/,
  
  // Teléfono
  phone: /(?:\+|00)?\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,4}/,
  
  // Empresa/proveedor (después de palabras clave)
  supplier: /(?:proveedor|supplier|emisor|from|empresa|company|vendedor)[\s:]*([^\n,]+)/i,
  recipient: /(?:cliente|buyer|receptor|to|destinatario)[\s:]*([^\n,]+)/i,
  
  // IVA
  iva: /(?:iva|vat|tax)[\s:]*[€$£]?\s*([\d.,]+)/i,
  
  // Condiciones de pago
  paymentTerms: /(?:términos|terms|plazo|payment|condiciones)[\s:]*([^\n]+)/i,
  
  // Líneas de items (cantidad x precio)
  lineItems: /(\d+)\s*x?\s*(?:de|of)?\s*([^\d]+)\s*[\s€$£]*([\d.,]+)/gi,
};

// ─── CONFIDENCE SCORES ───────────────────────────────────────────────
function calculateConfidence(matched, pattern = null) {
  if (!matched) return 0;
  if (pattern === 'regex') return 0.85; // regex direct match
  if (pattern === 'heuristic') return 0.65; // heuristic/fuzzy
  return 0.5; // fallback
}

// ─── DOCUMENT TYPE DETECTION ─────────────────────────────────────────
function detectDocumentType(text) {
  const lower = text.toLowerCase();
  
  if (/(?:factura|invoice|comprobante)/.test(lower)) {
    return { type: 'factura', confidence: 0.9 };
  }
  if (/(?:contrato|agreement|contract)/.test(lower)) {
    return { type: 'contrato', confidence: 0.9 };
  }
  if (/(?:pedido|purchase order|po|orden de compra)/.test(lower)) {
    return { type: 'po', confidence: 0.9 };
  }
  
  // Heurística: si tiene 'total', probablemente factura
  if (/total/.test(lower) && /(?:proveedor|supplier|emisor)/.test(lower)) {
    return { type: 'factura', confidence: 0.65 };
  }
  
  // Heurística: si tiene 'partes' y 'fecha inicio', probablemente contrato
  if (/(?:partes|acuerdan)/.test(lower) && /(?:vigencia|inicio|validez)/.test(lower)) {
    return { type: 'contrato', confidence: 0.70 };
  }
  
  return { type: 'unknown', confidence: 0 };
}

// ─── EXTRACT FACTURA ─────────────────────────────────────────────────
function extractFactura(text) {
  const result = {
    type: 'factura',
    fields: {
      numero: { value: null, confidence: 0, method: 'none' },
      fecha: { value: null, confidence: 0, method: 'none' },
      total: { value: null, confidence: 0, method: 'none' },
      proveedor: { value: null, confidence: 0, method: 'none' },
      nif: { value: null, confidence: 0, method: 'none' },
      items: { value: [], confidence: 0, method: 'none' },
      precios: { value: [], confidence: 0, method: 'none' },
      cantidades: { value: [], confidence: 0, method: 'none' },
      iva: { value: null, confidence: 0, method: 'none' },
      base_imponible: { value: null, confidence: 0, method: 'none' },
    }
  };

  // Número de factura
  const invoiceMatch = text.match(PATTERNS.invoiceNumber);
  if (invoiceMatch) {
    result.fields.numero = { 
      value: invoiceMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // Fecha
  const dateMatches = text.match(PATTERNS.date);
  if (dateMatches && dateMatches.length > 0) {
    result.fields.fecha = { 
      value: dateMatches[0], 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // Total
  const amountMatch = text.match(PATTERNS.amount);
  if (amountMatch) {
    result.fields.total = { 
      value: amountMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // Proveedor/emisor
  const supplierMatch = text.match(PATTERNS.supplier);
  if (supplierMatch) {
    result.fields.proveedor = { 
      value: supplierMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // NIF
  const nifMatch = text.match(PATTERNS.nif);
  if (nifMatch) {
    result.fields.nif = { 
      value: nifMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // IVA
  const ivaMatch = text.match(PATTERNS.iva);
  if (ivaMatch) {
    result.fields.iva = { 
      value: ivaMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // Líneas de items (cantidad, descripción, precio)
  const items = [];
  const quantities = [];
  const prices = [];
  const lineMatches = text.matchAll(PATTERNS.lineItems);
  for (const match of lineMatches) {
    quantities.push(match[1]);
    items.push(match[2].trim());
    prices.push(match[3].trim());
  }
  
  if (items.length > 0) {
    result.fields.items = { value: items, confidence: 0.75, method: 'regex' };
    result.fields.cantidades = { value: quantities, confidence: 0.75, method: 'regex' };
    result.fields.precios = { value: prices, confidence: 0.75, method: 'regex' };
  }

  return result;
}

// ─── EXTRACT CONTRATO ────────────────────────────────────────────────
function extractContrato(text) {
  const result = {
    type: 'contrato',
    fields: {
      partes: { value: [], confidence: 0, method: 'none' },
      fecha_inicio: { value: null, confidence: 0, method: 'none' },
      fecha_fin: { value: null, confidence: 0, method: 'none' },
      monto: { value: null, confidence: 0, method: 'none' },
      condiciones_clave: { value: [], confidence: 0, method: 'none' },
      duracion: { value: null, confidence: 0, method: 'none' },
    }
  };

  // Partes (busca después de "partes")
  const partesMatch = text.match(/partes[\s:]*([^\n]+)/i);
  if (partesMatch) {
    const parts = partesMatch[1].split(/y|,|;/).map(p => p.trim()).filter(p => p);
    result.fields.partes = { 
      value: parts, 
      confidence: calculateConfidence(true, 'heuristic'),
      method: 'heuristic' 
    };
  }

  // Fechas (inicio/fin)
  const dateMatches = text.match(PATTERNS.date);
  if (dateMatches && dateMatches.length >= 1) {
    result.fields.fecha_inicio = { 
      value: dateMatches[0], 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
    if (dateMatches.length >= 2) {
      result.fields.fecha_fin = { 
        value: dateMatches[1], 
        confidence: calculateConfidence(true, 'regex'),
        method: 'regex' 
      };
    }
  }

  // Monto
  const amountMatch = text.match(PATTERNS.amount);
  if (amountMatch) {
    result.fields.monto = { 
      value: amountMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // Duración (años, meses)
  const durationMatch = text.match(/(?:duración|plazo|validez)[\s:]*([^\n.]+)/i);
  if (durationMatch) {
    result.fields.duracion = { 
      value: durationMatch[1].trim(), 
      confidence: calculateConfidence(true, 'heuristic'),
      method: 'heuristic' 
    };
  }

  // Condiciones clave (busca "condiciones", "cláusulas")
  const conditionsMatch = text.match(/(?:condiciones|cláusulas|términos)[\s:]*([^\n.]+)/i);
  if (conditionsMatch) {
    result.fields.condiciones_clave = { 
      value: [conditionsMatch[1].trim()], 
      confidence: calculateConfidence(true, 'heuristic'),
      method: 'heuristic' 
    };
  }

  return result;
}

// ─── EXTRACT PO ──────────────────────────────────────────────────────
function extractPO(text) {
  const result = {
    type: 'po',
    fields: {
      numero: { value: null, confidence: 0, method: 'none' },
      proveedor: { value: null, confidence: 0, method: 'none' },
      items: { value: [], confidence: 0, method: 'none' },
      cantidades: { value: [], confidence: 0, method: 'none' },
      precios: { value: [], confidence: 0, method: 'none' },
      total: { value: null, confidence: 0, method: 'none' },
    }
  };

  // Número de PO
  const poMatch = text.match(PATTERNS.poNumber);
  if (poMatch) {
    result.fields.numero = { 
      value: poMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // Proveedor
  const supplierMatch = text.match(PATTERNS.supplier);
  if (supplierMatch) {
    result.fields.proveedor = { 
      value: supplierMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  // Líneas de items
  const items = [];
  const quantities = [];
  const prices = [];
  const lineMatches = text.matchAll(PATTERNS.lineItems);
  for (const match of lineMatches) {
    quantities.push(match[1]);
    items.push(match[2].trim());
    prices.push(match[3].trim());
  }
  
  if (items.length > 0) {
    result.fields.items = { value: items, confidence: 0.75, method: 'regex' };
    result.fields.cantidades = { value: quantities, confidence: 0.75, method: 'regex' };
    result.fields.precios = { value: prices, confidence: 0.75, method: 'regex' };
  }

  // Total
  const amountMatch = text.match(PATTERNS.amount);
  if (amountMatch) {
    result.fields.total = { 
      value: amountMatch[1].trim(), 
      confidence: calculateConfidence(true, 'regex'),
      method: 'regex' 
    };
  }

  return result;
}

// ─── OLLAMA ENRICHMENT ────────────────────────────────────────────────
async function enrichWithOllama(text, extraction) {
  try {
    // Verificar si Ollama está disponible
    const { stdout } = await execAsync('which ollama 2>/dev/null', { timeout: 2000 });
    if (!stdout) {
      console.log('[DataExtractor] Ollama no disponible, saltando enriquecimiento');
      return extraction;
    }

    const model = process.env.OLLAMA_MODEL || 'llama2';
    const prompt = `
Analiza este documento y extrae información estructurada en JSON.

Documento:
${text.substring(0, 2000)}

Devuelve SOLO un JSON válido sin explicación adicional:
{
  "tipo_documento": "factura|contrato|po",
  "campos_encontrados": {
    "nombre_empresa": "...",
    "monto_total": "...",
    "fecha_documento": "...",
    "condiciones_especiales": "..."
  }
}
`;

    const { stdout: response } = await execAsync(
      `echo '${prompt.replace(/'/g, "'\\''")}' | ollama run ${model} 2>/dev/null`,
      { timeout: 10000, maxBuffer: 10 * 1024 * 1024 }
    );

    // Intentar parsear respuesta JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const ollamaData = JSON.parse(jsonMatch[0]);
      console.log('[DataExtractor] Ollama enriquecimiento exitoso');
      return {
        ...extraction,
        ollama_enrichment: ollamaData,
      };
    }
  } catch (err) {
    console.log('[DataExtractor] Ollama enriquecimiento falló (fallback robusto):', err.message);
  }

  return extraction;
}

// ─── MAIN EXTRACTION FUNCTION ────────────────────────────────────────
async function extract(text, documentPath = null) {
  const id = _nextId();
  const timestamp = new Date().toISOString();

  // 1. Detectar tipo de documento
  const { type, confidence: typeConfidence } = detectDocumentType(text);

  let extraction;
  if (type === 'factura') {
    extraction = extractFactura(text);
  } else if (type === 'contrato') {
    extraction = extractContrato(text);
  } else if (type === 'po') {
    extraction = extractPO(text);
  } else {
    extraction = { type: 'unknown', fields: {} };
  }

  // 2. Enriquecer con Ollama (fallback silencioso)
  if (type !== 'unknown') {
    extraction = await enrichWithOllama(text, extraction);
  }

  // 3. Construir respuesta
  const result = {
    id,
    documentPath,
    type,
    typeConfidence,
    timestamp,
    textLength: text.length,
    extraction,
  };

  // 4. Persistir
  const db = _loadDB();
  db.extractions.push(result);
  _saveDB(db);

  return result;
}

// ─── GET ALL EXTRACTIONS ─────────────────────────────────────────────
function getExtractions(filter = {}) {
  const db = _loadDB();
  let results = db.extractions;

  if (filter.type) {
    results = results.filter(e => e.type === filter.type);
  }
  if (filter.id) {
    results = results.filter(e => e.id === filter.id);
  }

  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ─── GET SINGLE EXTRACTION ───────────────────────────────────────────
function getExtraction(id) {
  const db = _loadDB();
  return db.extractions.find(e => e.id === id) || null;
}

// ─── DELETE EXTRACTION ───────────────────────────────────────────────
function deleteExtraction(id) {
  const db = _loadDB();
  const idx = db.extractions.findIndex(e => e.id === id);
  if (idx < 0) return false;
  db.extractions.splice(idx, 1);
  _saveDB(db);
  return true;
}

// ─── EXPORT FUNCTIONS ────────────────────────────────────────────────
function toJSON(extractions) {
  return JSON.stringify(extractions, null, 2);
}

function toCSV(extractions) {
  if (extractions.length === 0) return '';

  // Headers
  const headers = ['ID', 'Type', 'Timestamp', 'TextLength', 'Fields'];
  const rows = [headers.join(',')];

  for (const ext of extractions) {
    const fieldsStr = Object.entries(ext.extraction.fields || {})
      .filter(([_, f]) => f.value !== null && f.value !== undefined)
      .map(([k, f]) => `${k}=${f.value}`)
      .join(';');

    rows.push([
      ext.id,
      ext.type,
      ext.timestamp,
      ext.textLength,
      `"${fieldsStr}"`,
    ].join(','));
  }

  return rows.join('\n');
}

// ─── EXPORTS ─────────────────────────────────────────────────────────
export {
  extract,
  getExtractions,
  getExtraction,
  deleteExtraction,
  toJSON,
  toCSV,
};

export default {
  extract,
  getExtractions,
  getExtraction,
  deleteExtraction,
  toJSON,
  toCSV,
};
