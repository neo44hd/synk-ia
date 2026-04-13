import { Router } from 'express';

export const ollamaRouter = Router();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

// Helper to call Ollama API
async function ollamaCall(endpoint, body = null, method = 'GET') {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${OLLAMA_URL}${endpoint}`, opts);
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}`);
  return res.json();
}

// Test connection + list models
ollamaRouter.get('/test', async (req, res) => {
  try {
    const data = await ollamaCall('/api/tags');
    const models = (data.models || []).map(m => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
      family: m.details?.family
    }));
    res.json({ success: true, models, count: models.length });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// List available models
ollamaRouter.get('/models', async (req, res) => {
  try {
    const data = await ollamaCall('/api/tags');
    res.json({ success: true, models: data.models || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate completion (for classification, extraction, etc)
ollamaRouter.post('/generate', async (req, res) => {
  try {
    const { model, prompt, system, temperature = 0.1, format } = req.body;
    if (!model || !prompt) {
      return res.status(400).json({ success: false, error: 'model and prompt required' });
    }
    const body = { model, prompt, stream: false, options: { temperature } };
    if (system) body.system = system;
    if (format === 'json') body.format = 'json';
    const data = await ollamaCall('/api/generate', body, 'POST');
    res.json({
      success: true,
      response: data.response,
      model: data.model,
      eval_duration: data.eval_duration,
      total_duration: data.total_duration
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Classify document using Ollama
ollamaRouter.post('/classify', async (req, res) => {
  try {
    const { text, filename, model } = req.body;
    const useModel = model || process.env.OLLAMA_CLASSIFY_MODEL || process.env.OLLAMA_MODEL || 'codegemma:7b';
    const systemPrompt = `Eres un asistente de clasificacion de documentos empresariales.
Analiza el texto y devuelve SOLO un JSON con:
{
  "type": "factura|nomina|albaran|contrato|recibo|presupuesto|fiscal|otro",
  "confidence": 0-100,
  "provider": "nombre del proveedor/emisor",
  "provider_cif": "CIF/NIF si aparece",
  "invoice_number": "numero de factura/documento",
  "date": "YYYY-MM-DD",
  "total": numero_total,
  "summary": "resumen breve en 1 linea"
}`;
    const data = await ollamaCall('/api/generate', {
      model: useModel,
      prompt: `Clasifica este documento (archivo: ${filename || 'desconocido'}):\n\n${(text || '').substring(0, 4000)}`,
      system: systemPrompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 }
    }, 'POST');
    let parsed = {};
    try { parsed = JSON.parse(data.response); } catch { parsed = { raw: data.response }; }
    res.json({ success: true, classification: parsed, model: useModel, duration: data.total_duration });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Classify email using Ollama
ollamaRouter.post('/classify-email', async (req, res) => {
  try {
    const { subject, body: emailBody, from, model } = req.body;
    const useModel = model || process.env.OLLAMA_CLASSIFY_MODEL || process.env.OLLAMA_MODEL || 'codegemma:7b';
    const systemPrompt = `Eres un asistente de clasificacion de emails empresariales.
Clasifica el email y devuelve SOLO un JSON con:
{
  "category": "factura|proveedor|cliente|rrhh|gestoria|marketing|interno|otro",
  "priority": "alta|media|baja",
  "confidence": 0-100,
  "summary": "resumen en 1 linea",
  "action": "accion sugerida o null",
  "has_invoice": true/false
}`;
    const data = await ollamaCall('/api/generate', {
      model: useModel,
      prompt: `De: ${from || '?'}\nAsunto: ${subject || '?'}\nContenido: ${(emailBody || '').substring(0, 2000)}`,
      system: systemPrompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 }
    }, 'POST');
    let parsed = {};
    try { parsed = JSON.parse(data.response); } catch { parsed = { raw: data.response }; }
    res.json({ success: true, classification: parsed, model: useModel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
