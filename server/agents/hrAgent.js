/**
 * HR AGENT — Sub-agente especializado en recursos humanos y nominas
 * Soporte dual: Ollama + LM Studio
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(path.dirname(__dirname), '..', '..', 'data');

const OLLAMA_URL = process?.env?.OLLAMA_URL || 'http://localhost:11434';
const LMSTUDIO_URL = process?.env?.LMSTUDIO_URL || 'http://localhost:1234/v1';
const LMSTUDIO_KEY = process?.env?.LMSTUDIO_API_KEY || '';

function getProvider() {
  return process?.env?.HR_PROVIDER || 'ollama';
}

function getModel() {
  const provider = getProvider();
  if (provider === 'lmstudio') {
    return process?.env?.HR_MODEL || 'harmonic-hermes-9b:latest';
  }
  return process?.env?.HR_MODEL || 'harmonic-hermes-9b:latest';
}

function safeParseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
  catch { const m = (str || '').match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} }
  return null;
}

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
    const provider = getProvider();
    let url, body, headers;

    if (provider === 'lmstudio') {
      url = LMSTUDIO_URL + '/chat/completions';
      body = {
        model: getModel(),
        messages: [
          { role: 'system', content: 'Responde SOLO con JSON valido.' },
          { role: 'user', content: prompt }
        ],
        stream: false,
        max_tokens: 2048,
        temperature: 0.1,
        num_ctx: parseInt(process.env.NUM_CTX || '8192', 10),
      };
      headers = { 'Content-Type': 'application/json' };
      if (LMSTUDIO_KEY) headers['Authorization'] = `Bearer ${LMSTUDIO_KEY}`;
    } else {
      url = OLLAMA_URL + '/api/generate';
      body = {
        model: getModel(),
        prompt,
        system: 'Responde SOLO con JSON valido.',
        stream: false,
        options: { temperature: 0.1, num_predict: 2048, num_ctx: parseInt(process.env.NUM_CTX || '8192', 10) },
      };
      headers = { 'Content-Type': 'application/json' };
    }

    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`${provider} ${r.status}`);
    const data = await r.json();

    let content;
    if (provider === 'lmstudio') {
      content = data.choices?.[0]?.message?.content || '';
    } else {
      content = (data.message || data).content || '';
    }
    return safeParseJSON(content) || fallbackPayroll(text);
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
  console.log('[HR-AGENT] Procesando: ' + fName + ' (tipo: ' + docType + ') provider=' + getProvider());

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