/**
 * ACCOUNTING AGENT — Sub-agente especializado en contabilidad
 * Soporte dual: Ollama + LM Studio
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTask } from '../services/agentCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(path.dirname(__dirname), '..', '..', 'data');

function extractFallbackFields(text) {
  const t = text || '';
  const result = {
    base_imponible: null, iva_porcentaje: null, importe_iva: null,
    total_factura: null, forma_pago: null, plazo_pago: null,
    numero_factura: null, fecha_emision: null, fecha_vencimiento: null,
    proveedor_nombre: null, proveedor_cif: null, conceptos: [],
    retencion: null, tipo_retencion: null,
    es_rectificativa: t.toLowerCase().includes('rectificativa'),
  };
  const nm = t.match(/(?:factura|fact\.|n\.\s*o)\s*[:.]?\s*(\w[\w\s\-]*\w)/i);
  if (nm) result.numero_factura = nm[1].trim();
  const dm = t.match(/(\d{2})\/(\d{2})\/(\d{4})/g);
  if (dm) result.fecha_emision = dm[0].replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
  const tm = t.match(/total\s*[:.]?\s*([\d.,]+)/i);
  if (tm) result.total_factura = parseFloat(tm[1].replace(/\./g, '').replace(',', '.'));
  const bm = t.match(/base\s*imponible\s*[:.]?\s*([\d.,]+)/i);
  if (bm) result.base_imponible = parseFloat(bm[1].replace(/\./g, '').replace(',', '.'));
  const im = t.match(/iva\s*\(?\s*(\d+)\s*%?\)?/i);
  if (im) result.iva_porcentaje = parseInt(im[1]);
  const rm = t.match(/(?:retenci[oo]n|ret\.?)\s*(?:irpf)?\s*[:.]?\s*(\d+)\s*%/i);
  if (rm) { result.retencion = parseInt(rm[1]); result.tipo_retencion = 'IRPF'; }
  return result;
}

async function extractAccountingFields(text, classification) {
  const prompt = [
    'Eres el agente contable de SynK-IA. Extrae los campos contables del documento.',
    'Responde SOLO JSON valido con: base_imponible, iva_porcentaje, importe_iva, total_factura,',
    'forma_pago, numero_factura, fecha_emision, proveedor_nombre, proveedor_cif, conceptos, retencion.',
    '',
    'DOCUMENTO:',
    '```',
    (text || '').substring(0, 6000),
    '```',
  ].join('\n');

  try {
    const { parsed } = await runTask('accounting', {
      system: 'Responde SOLO con JSON valido.',
      prompt,
      json: true,
    });
    return parsed || extractFallbackFields(text);
  } catch (err) {
    console.error('[ACCOUNTING-AGENT] Error LLM: ' + err.message);
    return extractFallbackFields(text);
  }
}

export async function process(params) {
  const { text, classification, filename } = params || {};
  const fName = filename || 'desconocido';
  const docType = (classification || {}).docType || '?';
  console.log('[ACCOUNTING-AGENT] Procesando: ' + fName + ' (tipo: ' + docType + ') via gateway');

  const accounting = await extractAccountingFields(text || '', classification || {});

  let reconciliation = null;
  if (accounting && (accounting.proveedor_nombre || accounting.proveedor_cif)) {
    try {
      const entitiesData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'entities.json'), 'utf8'));
      reconciliation = await reconcileInvoice(accounting, entitiesData);
    } catch (err) { console.warn('[ACCOUNTING-AGENT] Error conciliar: ' + err.message); }
  }

  return {
    type: 'accounting',
    accounting,
    reconciliation,
    confidence: (classification || {}).confidence || 0,
    filename: fName,
    processed_at: new Date().toISOString(),
  };
}

async function reconcileInvoice(invoiceData, entities) {
  const result = { matched: false, provider_match: null, discrepancies: [], warnings: [] };
  if (!invoiceData) return result;
  const providers = (entities || {}).proveedores || [];
  if (invoiceData.proveedor_nombre) {
    const nl = invoiceData.proveedor_nombre.toLowerCase().trim();
    result.provider_match = providers.find(p => p.nombre.toLowerCase().includes(nl) || nl.includes(p.nombre.toLowerCase()));
  }
  if (invoiceData.proveedor_cif && !result.provider_match) {
    result.provider_match = providers.find(p => p.cif_nif === invoiceData.proveedor_cif);
  }
  if (result.provider_match) result.matched = true;
  else result.warnings.push('Proveedor no encontrado en entities');
  return result;
}

const express = await import('express');
export const accountingRouter = express.Router();
accountingRouter.post('/analyze', async (req, res) => {
  try {
    if (!req.body.text) return res.status(400).json({ error: 'Se requiere "text"' });
    const result = await process({ text: req.body.text, classification: req.body.classification || {}, filename: req.body.filename });
    res.json({ success: true, result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});