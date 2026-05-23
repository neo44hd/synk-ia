/**
 * LEGAL AGENT — Sub-agente especializado en analisis juridico
 * Soporte dual: Ollama + LM Studio
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OLLAMA_URL = process?.env?.OLLAMA_URL || 'http://localhost:11434';
const LMSTUDIO_URL = process?.env?.LMSTUDIO_URL || 'http://localhost:1234/v1';
const LMSTUDIO_KEY = process?.env?.LMSTUDIO_API_KEY || '';

function getProvider() {
  return process?.env?.LEGAL_PROVIDER || 'ollama';
}

function getModel() {
  const provider = getProvider();
  if (provider === 'lmstudio') {
    return process?.env?.LEGAL_MODEL || 'negentropy-claude-opus-4.7-9b';
  }
  return process?.env?.LEGAL_MODEL || 'harmonic-hermes-9b:latest';
}

function safeParseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
  catch { const m = (str || '').match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function extractBasicLegalFields(text) {
  const t = text || '';
  const result = { document_type: 'legal', parties: [], key_dates: [], obligations: [],
    penalties_or_liabilities: null, termination_conditions: null,
    risk_level: 'medium', summary: 'Documento legal - extraccion parcial', recommended_action: 'Revision manual' };
  const tl = t.toLowerCase();
  if (tl.includes('contrato')) result.document_type = 'contract';
  if (tl.includes('notificaci') || tl.includes('notificion')) result.document_type = 'notification';
  if (tl.includes('juzgado') || tl.includes('sentencia')) result.document_type = 'court_summons';
  const dates = t.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
  result.key_dates = dates.map(d => ({ date: d.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'), event: 'fecha' }));
  if (tl.includes('penaliz') || tl.includes('multa') || tl.includes('indemniz')) {
    result.penalties_or_liabilities = ['Penalizacion detectada']; result.risk_level = 'high';
  }
  return result;
}

async function analyzeLegalDocument(text) {
  const prompt = [
    'Eres el agente legal de SynK-IA. Analiza el documento legal y responde SOLO JSON valido.',
    'Campos: document_type, parties, key_dates, obligations, penalties_or_liabilities,',
    'termination_conditions, risk_level (high/medium/low), summary, recommended_action.',
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
        options: { temperature: 0.1, num_predict: 1536, num_ctx: parseInt(process.env.NUM_CTX || '8192', 10) },
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
    return safeParseJSON(content) || extractBasicLegalFields(text);
  } catch (err) {
    console.error('[LEGAL-AGENT] Error: ' + err.message);
    return extractBasicLegalFields(text);
  }
}

export async function process(params) {
  const { text, classification, filename } = params || {};
  console.log('[LEGAL-AGENT] Procesando: ' + (filename || '?') + ' provider=' + getProvider());
  const analysis = await analyzeLegalDocument(text || '');
  return { type: 'legal', analysis, confidence: (classification || {}).confidence || 0,
           filename: filename || '?', processed_at: new Date().toISOString() };
}

const express = await import('express');
export const legalRouter = express.Router();
legalRouter.post('/analyze', async (req, res) => {
  try {
    if (!req.body.text) return res.status(400).json({ error: 'Se requiere "text"' });
    const result = await process({ text: req.body.text, classification: req.body.classification || {}, filename: req.body.filename });
    res.json({ success: true, result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});