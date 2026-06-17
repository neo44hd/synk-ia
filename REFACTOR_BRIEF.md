# Refactor: servicio central de agentes con prompts dinámicos por contexto

## Objetivo
Unificar la lógica LLM duplicada de los agentes de IA en UN único servicio central, con prompts construidos dinámicamente según el contexto. NO cambiar las rutas HTTP ni el formato JSON de respuesta de ningún endpoint (compatibilidad total con el frontend).

## 1. Crear `server/services/agentCore.js` (ESM)
Debe exportar:
- `gatewayChat({ system, prompt, model, schema, temperature = 0.1, maxTokens = 2048 })`
  - Una sola función que llama al gateway OpenAI-compatible en `process.env.LMSTUDIO_URL || 'http://127.0.0.1:4000/v1'`, haciendo `POST /chat/completions` (formato OpenAI: messages con system+user).
  - 2 reintentos, timeout 120s, y parseo JSON robusto cuando se pide `schema`/JSON (reutiliza una función tipo `safeParseJSON`).
  - Devuelve `{ content, model }`.
- `TASKS`: registro de tareas. Cada entrada:
  `{ model, temperature, maxTokens, schema, buildSystem(ctx), buildPrompt(ctx) }`
  donde `buildSystem` y `buildPrompt` construyen los textos DINÁMICAMENTE a partir del contexto (`ctx`: p. ej. `docType`, `source`, `filename`, `text`, `schema`...).
  - Tareas requeridas: `classify`, `classify_email`, `extract`, `deep`, `analyze`, `accounting`, `legal`, `hr`.
- `runTask(taskName, ctx)`: resuelve la tarea del registro, construye system+prompt desde `ctx`, llama a `gatewayChat` con el alias de modelo de la tarea, parsea/valida contra `schema` y devuelve el resultado normalizado.

### Alias de modelo por tarea (configurable por env con estos defaults)
- `classify`, `classify_email`, `extract` → `local-fast`
- `deep`, `analyze`, `accounting`, `legal`, `hr` → `local-reason`
(Lee el alias de `process.env.<TAREA>_MODEL` si existe; si no, usa el default anterior.)

## 2. Refactorizar módulos para DELEGAR en agentCore
En cada uno de estos, ELIMINA su `getProvider`/`getModel` y las ramas duplicadas `ollama*/lmstudio*`, y reemplaza la llamada al LLM por `await runTask('<tarea>', ctx)`. MANTÉN intactos sus routers Express, rutas y el shape EXACTO de la respuesta JSON:
- `server/agents/classifier.js` → tarea `classify`
- `server/agents/hrAgent.js` → tarea `hr`
- `server/agents/accountingAgent.js` → tarea `accounting`
- `server/agents/legalAgent.js` → tarea `legal`
- `server/agents/analyzerAgent.js` → tarea `analyze`
- `server/agents/documentAgent.js` → tarea `extract`/`analyze` según corresponda
- `server/agents/extractorAgent.js` → tarea `extract`
- `server/routes/ai.js` → su función `generate()` debe usar `agentCore.gatewayChat` (un solo camino, por el gateway). Mantén todos los endpoints (`/classify`, `/classify-email`, `/extract-document`, `/generate`, `/status`, `/models`, `/test`, `/ocr`) y sus respuestas.

## 3. Reglas
- Copia los **system prompts y esquemas JSON existentes** de cada módulo al registro `TASKS` (NO los inventes; tómalos del código actual).
- NO toques Telegram, tokens ni secretos. NO modifiques ningún `.env`.
- El endpoint `/ocr` de `ai.js` (pdftoppm/tesseract) se mantiene igual (no es LLM).
- Código ESM, limpio y comentado. No rompas imports existentes.

## 4. Verificación (al terminar)
- Lista los ficheros modificados/creados.
- Indica cómo probar cada endpoint, p. ej.:
  `curl -s -X POST http://localhost:3001/api/ai/classify -H 'Content-Type: application/json' -d '{"text":"Factura de prueba"}'`
  y equivalentes para `/api/hr/analyze`, `/api/accounting/analyze`, `/api/legal/analyze`, `/api/extractions/...`.
- Recuerda que tras editar hay que reiniciar: `pm2 restart sinkia-api`.
