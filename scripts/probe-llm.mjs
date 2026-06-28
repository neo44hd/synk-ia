// Sonda: prueba qué proveedor cloud responde (sin imprimir las claves).
import '../server/env-loader.mjs';

const probes = [
  {
    name: 'NVIDIA',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: process.env.NVIDIA_API_KEY,
    model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: (process.env.OPENROUTER_API_KEY || '').replace(/^openrouter:/, ''),
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  },
  {
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: process.env.GOOGLE_GEMINI_API_KEY,
    model: 'gemini-1.5-flash',
  },
];

for (const p of probes) {
  if (!p.key) { console.log(`${p.name}: (sin clave en .env)`); continue; }
  try {
    const res = await fetch(p.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: 'responde solo: OK' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(15000),
    });
    const txt = await res.text();
    let content = '';
    try { content = JSON.parse(txt).choices?.[0]?.message?.content || ''; } catch {}
    console.log(`${p.name}: HTTP ${res.status} | model=${p.model} | resp="${content.slice(0, 30)}"${res.ok ? '' : ' | ' + txt.slice(0, 120)}`);
  } catch (e) {
    console.log(`${p.name}: ERROR ${e.message}`);
  }
}
