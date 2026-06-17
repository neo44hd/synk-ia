/**
 * HR AGENT — Sub-agente especializado en recursos humanos y nominas
 * Soporte dual: Ollama + LM Studio
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTask } from '../services/agentCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(path.dirname(__dirname), '..', '..', 'data');

function extractNumberAfter(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  const after = text.substring(m.index + m[0].length, m.index + 200);
  const n = after.match(/[\d.,]+/);
  return n ? parseFloat(n[0].replace(/\./g, '').replace(',', '.')) : null;
}

function extractDate(text) {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

function fallbackPayroll(text) {
  return { gross_salary: extractNumberAfter(text, /salario\s*bruto|base\s*cotizaci/i),
    net_salary: extractNumberAfter(text, /salario\s*neto|l.iq.uido/i),
    irpf: extractNumberAfter(text, /irpf/i),
    employee_name: null };
}

async function extractPayrollFields(text) {
  const prompt = [
    'Eres el agente RRHH de SynK-IA. Extrae los campos de la nomina.',
    'Responde SOLO JSON valido: employee_name, employee_dni, category, gross_salary, net_salary,',
    'irpf, social_security_employee, period_start, period_end.',
    '',
    'DOCUMENTO:',
    '```',
    (text || '').substring(0, 6000),
    '```',
  ].join('\n');

  try {
    const { parsed } = await runTask('hr', {
      system: 'Responde SOLO con JSON valido.',
      prompt,
      json: true,
    });
    return parsed || fallbackPayroll(text);
  } catch (err) {
    console.error('[HR-AGENT] Error LLM: ' + err.message);
    return fallbackPayroll(text);
  }
}

function extractSettlementFields(text) {
  return { settlement_type: (text || '').toLowerCase().includes('finiquito') ? 'finiquito' : 'liquidacion',
    employee_name: null, termination_date: extractDate(text || ''), total_liquidation: null };
}

export async function process(params) {
  const { text, classification, filename } = params || {};
  const fName = filename || 'desconocido';
  const docType = (classification || {}).docType || '';
  console.log('[HR-AGENT] Procesando: ' + fName + ' (tipo: ' + docType + ') via gateway');

  let hrData;
  if (docType === 'payroll' || docType === 'fiscal') {
    hrData = await extractPayrollFields(text || '');
  } else if ((text || '').toLowerCase().includes('finiquit') || (text || '').toLowerCase().includes('liquidaci')) {
    hrData = await extractSettlementFields(text || '');
  } else { hrData = fallbackPayroll(text || ''); }

  return { type: 'hr', hrData, confidence: (classification || {}).confidence || 0,
           filename: fName, processed_at: new Date().toISOString() };
}

const express = await import('express');
export const hrRouter = express.Router();
hrRouter.post('/analyze', async (req, res) => {
  try {
    if (!req.body.text) return res.status(400).json({ error: 'Se requiere "text"' });
    const result = await process({ text: req.body.text, classification: req.body.classification || {}, filename: req.body.filename });
    res.json({ success: true, result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});