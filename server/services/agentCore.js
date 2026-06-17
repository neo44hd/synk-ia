/**
 * agentCore.js — Servicio central de LLM para los agentes de SynK-IA.
 * ====================================================================
 * Un ÚNICO cliente OpenAI-compatible hacia el gateway (LiteLLM en :4000),
 * con prompts dinámicos por contexto, registro de tareas y parseo JSON
 * robusto. Los agentes (classifier, hr, accounting, legal, analyzer, ...)
 * delegan aquí en vez de duplicar la lógica de proveedor/modelo.
 *
 * El gateway ya enruta cada alias al backend real (LM Studio, Ollama, nube)
 * y aplica fallbacks; aquí solo hablamos OpenAI chat-completions.
 */

const GATEWAY_URL = process?.env?.LMSTUDIO_URL || 'http://127.0.0.1:4000/v1';
const GATEWAY_KEY = process?.env?.LMSTUDIO_API_KEY || 'gateway-local';
const NUM_CTX     = parseInt(process?.env?.NUM_CTX || '8192', 10);

// ── Registro de tareas: modelo (alias del gateway), límites y env override ──
const TASKS = {
  classify:       { envModel: 'CLASSIFY_MODEL',       model: 'local-fast',   maxTokens: 512,  temperature: 0.1   },
  classify_email: { envModel: 'CLASSIFY_MODEL',       model: 'local-fast',   maxTokens: 256,  temperature: 0.1   },
  extract:        { envModel: 'EXTRACT_MODEL',        model: 'local-fast',   maxTokens: 2048, temperature: 0.1   },
  deep:           { envModel: 'DEEP_MODEL',           model: 'local-reason', maxTokens: 2048, temperature: 0.1   },
  analyze:        { envModel: 'ANALYZER_MODEL',       model: 'local-reason', maxTokens: 2000, temperature: 0.05  },
  document:       { envModel: 'DOC_AGENT_MODEL',      model: 'local-reason', maxTokens: 2048, temperature: 0.1   },
  learning:       { envModel: 'CHAT_MODEL',           model: 'local-fast',   maxTokens: 1000, temperature: 0.5   },
  chat:           { envModel: 'CHAT_MODEL',           model: 'local-fast',   maxTokens: 1024, temperature: 0.1   },
  accounting:     { envModel: 'ACCOUNTING_MODEL',     model: 'local-reason', maxTokens: 2048, temperature: 0.1   },
  legal:          { envModel: 'LEGAL_MODEL',          model: 'local-reason', maxTokens: 1536, temperature: 0.1   },
  hr:             { envModel: 'HR_MODEL',             model: 'local-fast',   maxTokens: 2048, temperature: 0.1   },
};

function resolveTask(task) {
  const def = TASKS[task] || TASKS.classify;
  const model = (def.envModel && process?.env?.[def.envModel]) || def.model;
  return { ...def, model };
}

/** Parseo JSON robusto: quita ```json y bloques <think>, y extrae el {…}. */
export function safeParseJSON(str) {
  if (!str || typeof str !== 'string') return null;
  const cleaned = str
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  try { return JSON.parse(cleaned); } catch { /* continúa */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
  return null;
}

/**
 * Llamada única al gateway (OpenAI chat completions), con reintentos.
 * @returns {Promise<{content:string, model:string}>}
 */
export async function gatewayChat({ system, prompt, model = 'local-fast', temperature = 0.1, maxTokens = 2048, json = false } = {}) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  return gatewayChatMessages({ messages, model, temperature, maxTokens, json });
}

/**
 * Llamada al gateway con array de mensajes completo (soporta multi-turn, vision, etc).
 * @returns {Promise<{content:string, model:string}>}
 */
export async function gatewayChatMessages({ messages, model = 'local-fast', temperature = 0.1, maxTokens = 2048, json = false } = {}) {
  const body = { model, messages, stream: false, temperature, max_tokens: maxTokens, num_ctx: NUM_CTX };
  if (json) body.response_format = { type: 'json_object' };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GATEWAY_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text().catch(() => res.statusText)).slice(0, 200)}`);
      const data = await res.json();
      return { content: data.choices?.[0]?.message?.content || '', model: data.model || model };
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Ejecuta una tarea del registro: resuelve modelo (alias del gateway) y
 * parámetros, llama al gateway y devuelve también el JSON parseado.
 * Los prompts (system/prompt) los construye dinámicamente cada agente según
 * su contexto y se pasan aquí; este servicio centraliza la ejecución.
 * @returns {Promise<{content:string, model:string, parsed:any}>}
 */
export async function runTask(task, { system, prompt, json = true, temperature, maxTokens } = {}) {
  const def = resolveTask(task);
  const { content, model } = await gatewayChat({
    system,
    prompt,
    model: def.model,
    temperature: temperature ?? def.temperature,
    maxTokens: maxTokens ?? def.maxTokens,
    json,
  });
  return { content, model, parsed: json ? safeParseJSON(content) : null };
}

export default { gatewayChat, gatewayChatMessages, runTask, safeParseJSON };
