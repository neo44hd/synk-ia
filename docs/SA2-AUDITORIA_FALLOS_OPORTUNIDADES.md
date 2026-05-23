# SA-2: Fallos, Cuellos de Botella y Oportunidades
## Pipeline de Documentos de SynK-IA — Auditoría Completa

**Fecha:** 2026-05-20
**Auditor:** Hermes Agent (para David Roldán / Chicken Palace Ibiza)

---

## 1. FALLOS CRÍTICOS

### F1 — Dependencia de proxy externo eliminado (V3 → Local)
- `documentProcessor.js` y `ai.js` contienen funciones `v3Ingest`, `v3WaitDone`, `v3Children`, `v3FieldsToFrontendSchema` que llaman a `https://api-v3.sinkialabs.com`
- Este servicio externo ya no es necesario: `analyzerAgent.js` ya usa Ollama local
- **Impacto:** Eliminamos latencia de red, dependencia de terceros, y puntos de fallo
- **Acción:** Reemplazar todo el flujo V3 por llamadas directas a Ollama local

### F2 — Seguridad: Tokens hardcodeados
- `ADMIN_TOKEN = 'sinkia2026'` aparece en `admin.js` (línea 21) y `documents.js` (línea 18)
- Ruta `/admin/exec` permite ejecución arbitraria de comandos shell
- **Acción:** Mover tokens a variables de entorno, sanitizar `exec` o eliminar endpoint

### F3 — Triple sistema de clasificación sin coordinación
| Sistema | Archivo | Motor |
|---------|---------|-------|
| Clasificación A | `server/routes/ai.js:318` (classify) | Ollama + schema fijo |
| Clasificación B | `server/routes/ai.js:404` (extract-document) | Ollama + schema dinámico |
| Clasificación C | `server/agents/analyzerAgent.js` | Ollama + prompt extenso para Chicken Palace |
| Clasificación D | `src/services/invoiceExtractorService.js` | Regex puro (sin LLM) |
| Clasificación E | `src/services/docBrainService.js` | Mixto (LLM + regex fallback) |

Estos 5 sistemas producen outputs incompatibles que van a destinos diferentes.

### F4 — Almacenamiento fragmentado
- `server/services/documentProcessor.js` → `data/` archivos JSON planos
- `src/services/dataService.js` → API `/api/data/:entity` (JSON Server)
- `src/services/brain.js` → localStorage
- Sin fuente única de verdad ni transaccionalidad

### F5 — Lógica de negocio en rutas HTTP
- `filebrain.js` (571 líneas): contiene queries a JSON, vinculación nómina-trabajador
- `email.js` (567 líneas): agregación proveedores, cálculos IVA
- `admin.js` (47KB): tarjetas Mission Response hardcodeadas
- **Violación de separación de responsabilidades**

---

## 2. CUELLOS DE BOTELLA

### CB1 — Extracción PDF duplicada 3 veces
- `extractorAgent.js` (servidor)
- `docBrainService.js` (frontend, usa pdf.js + API)
- `biloop.js/process-zip` (servidor, regex manual)
- `invoiceExtractorService.js` (frontend, regex manual)

### CB2 — Polling ineficiente para procesamiento V3
- `documentProcessor.js` hace polling cada 2 segundos con timeout de 120s
- Si hay muchos documentos, esto bloquea recursos
- **Solución:** Procesamiento síncrono con Ollama local (ya es instantáneo)

### CB3 — Redundancia de prompts
- `analyzerAgent.js` tiene un prompt de 150 líneas (tipos, reglas, formato)
- `ai.js` tiene un prompt corto genérico
- `docBrainService.js` construye prompts sobre la marcha
- No hay un prompt canónico para procesamiento documental

### CB4 — Sin cola de procesamiento
- No hay sistema de cola (bull, bullmq, o similar)
- Si llegan 50 archivos a la vez, se procesan secuencialmente con polling
- No hay retry automático en caso de fallo del LLM

---

## 3. OPORTUNIDADES

### OP1 — Superagente orquestador central
Un solo endpoint `/api/orchestrate` que:
- Recibe cualquier input (archivo, texto, email, URL)
- Clasifica automáticamente con el LLM
- Enruta al sub-agente especializado correcto
- Devuelve resultado estructurado unificado

### OP2 — Unificar las 5 clasificaciones en una sola
Un solo prompt canónico con schema de salida universal que todos los servicios usan.

### OP3 — Cola de procesamiento asíncrono
Implementar cola en memoria (o Redis si se escala) para procesamiento no bloqueante.

### OP4 — Fuente única de entidades
Reemplazar los múltiples almacenes por un único servicio de datos con esquema definido.

### OP5 — Autonomía total del servidor
Que el servidor pueda:
- Monitorear una carpeta de entrada (watch)
- Procesar automáticamente nuevos archivos
- Reintentar fallos
- Notificar al frontend vía WebSocket

---

## 4. RESUMEN DE ACCIONES PARA SA-3/SA-4

- [x] Auditar pipeline completo (SA-1) ✓
- [x] Identificar fallos y oportunidades (SA-2) ✓ (este documento)
- [ ] Diseñar arquitectura del superagente (SA-3) → **en progreso**
- [ ] Construir superagente (SA-4)
- [ ] Probar y validar (SA-5)