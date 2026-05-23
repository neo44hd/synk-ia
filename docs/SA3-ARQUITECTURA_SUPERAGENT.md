# Arquitectura del Superagente Orquestador — SynK-IA

> **Principio rector:** Un archivo/documento/correo entra al sistema → el superagente decide qué hacer → lo hace → devuelve resultado. Sin intervención humana necesaria. "Magia".

---

## 1. Visión general

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR AGENT                               │
│  Punto único de entrada para TODO procesamiento de documentos/datos     │
│                                                                         │
│  RECIBE ─────► CLASIFICA ─────► ENRUTA ─────► EJECUTA ─────► DEVUELVE  │
│  (file/texto/email/URL)  (LLM)   (sub-agent)  (sub-agent)  (resultado) │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────────┬──────────────┐
              ▼           ▼               ▼              ▼
        ┌─────────┐ ┌─────────┐   ┌──────────┐  ┌───────────┐
        │ DOCUMENT│ │ EMAIL   │   │ ACCOUNT- │  │ ANALYTICS │
        │  AGENT  │ │ AGENT   │   │  ING     │  │  AGENT    │
        │         │ │         │   │          │  │           │
        │- Clasif │ │- Clasif │   │- Facturas│  │- Dashboard│
        │- Extrae │ │- Prior. │   │- Nóminas │  │- KPIs     │
        │- Valida │ │- Reply  │   │- Pagos   │  │- Alerts   │
        │- Almacé │ │- Reenví │   │- Taxes   │  │- Trends   │
        └─────────┘ └─────────┘   └──────────┘  └───────────┘
              │           │               │              │
              ▼           ▼               ▼              ▼
         ┌─────────────────────────────────────────────────┐
         │            DATA LAYER (unificado)               │
         │  entities/ (Invoice, Provider, Employee...)     │
         │  documents/ (archivos procesados)               │
         │  queue/ (cola de procesamiento)                 │
         │  logs/ (auditoría)                              │
         └─────────────────────────────────────────────────┘
```

---

## 2. Componentes principales

### 2.1 Orchestrator Agent (`server/agents/orchestrator.js`)
**El cerebro central.** Recibe cualquier input y decide qué hacer.

**Responsabilidades:**
- Aceptar input: archivo, texto, email raw, URL
- Clasificar automáticamente el tipo de contenido
- Decidir qué sub-agente ejecutar
- Orquestar la ejecución
- Unificar el formato de respuesta

**Endpoint API:**
```
POST /api/orchestrator/process    → Procesar un input
POST /api/orchestrator/batch      → Procesar múltiple inputs
GET  /api/orchestrator/status/:id → Estado de un procesamiento
```

**Flujo de procesamiento:**
```
1. Input recibido (file upload / texto raw / email JSON / URL)
2. Pre-procesamiento (extraer texto si es PDF/imagen)
3. Clasificación por LLM (tipo + prioridad + sub-agente destino)
4. Si confianza > umbral → enrutar a sub-agente
5. Si confianza < umbral → enviar a cola de "revisión humana"
6. Sub-agente procesa (extrae datos, almacena, etc.)
7. Resultado unificado → BD + WebSocket al frontend
8. Log de auditoría
```

### 2.2 Classification Module (`server/agents/classifier.js`)
**Clasificador universal.** Usa el LLM con un prompt canónico.

**Tipos de salida:**
```json
{
  "docType": "invoice|payroll|contract|email|receipt|bank_extract|legal|other",
  "subType": "food_supplier|utility|delivery|nomina|finiquito|...",
  "priority": "urgent|high|normal|low",
  "confidence": 0.95,
  "targetAgent": "document|email|accounting|legal",
  "actions": ["extract", "store", "notify"]
}
```

### 2.3 Sub-agentes especializados

#### Document Agent (`server/agents/subagents/documentAgent.js`)
Procesa todo tipo de documentos no-email:
- Facturas (recibidas y emitidas)
- Nóminas y finiquitos
- Albaranes
- Contratos
- Recibos y tickets
- Extractos bancarios
- Documentos legales

**Capacidades:**
- Extracción de campos estructurados vía LLM
- Validación cruzada (suma de líneas vs total)
- Detección de duplicados
- Generación de resumen ejecutivo
- Almacenamiento en entities/

#### Email Agent (`server/agents/subagents/emailAgent.js`)
Ya existe (`emailAgent.js`) — se adapta.

#### Accounting Agent (`server/agents/subagents/accountingAgent.js`)
- Conciliación de facturas vs pagos
- Detección de duplicados
- Generación de asientos contables
- Informes de IVA
- Comparación de precios entre proveedores

#### Legal Agent (`server/agents/subagents/legalAgent.js`)
- Clasificación de contratos
- Alertas de vencimiento
- Detección de cláusulas relevantes
- Gestión de notificaciones oficiales

### 2.4 Data Layer — Fuente única de verdad
**Estructura de almacenamiento unificada:**

```
data/
  entities/
    invoices.json        → Todas las facturas
    providers.json       → Proveedores
    employees.json       → Empleados
    contracts.json       → Contratos
    emails.json          → Emails procesados
    documents.json       → Documentos genéricos
  queue/
    pending.json         → Cola de procesamiento
    processing.json      → En proceso
    failed.json          → Fallos (con retry)
    review.json          → Esperando revisión humana
  logs/
    process.log          → Log de procesamiento
    audit.log            → Auditoría
```

### 2.5 Unified Response Schema
**Todo sub-agente devuelve el mismo formato:**
```json
{
  "id": "uuid",
  "timestamp": "2026-05-20T10:30:00Z",
  "source": "email|upload|manual|auto",
  "classification": { ... },
  "extracted": { ... },
  "actions_taken": ["stored", "indexed", "notified"],
  "entities_created": ["invoice_123"],
  "confidence": 0.95,
  "status": "completed|pending_review|failed",
  "metadata": { ... }
}
```

---

## 3. Reemplazo de Base44

`base44Client.js` era un wrapper local que mapeaba a:
- `base44.entities.X` → `dataService.X` (API `/api/data/:entity`)
- `base44.auth` → `authService` (JWT API)
- `base44.functions` → `functionsService` (LLM, email, sync)
- `base44.integrations` → `integrationsService` (upload, extract, classify)

**Plan de reemplazo:**

| Antes (`import { base44 }`) | Ahora (importación directa) |
|------------------------------|-----------------------------|
| `base44.entities.Invoice` | `import { Invoice } from '@/services/dataService'` |
| `base44.auth.login()` | `import { authService } from '@/services/authService'` |
| `base44.functions.invoke('...')` | `import { functionsService } from '@/services/functionsService'` |
| `base44.integrations.ExtractData(...)` | `import { integrationsService } from '@/services/integrationsService'` |

**50 archivos afectados** — se reemplazan los imports de `base44Client` por imports directos.

---

## 4. Eliminación de V3 Proxy

Se eliminan del backend:
- `v3Ingest()`, `v3WaitDone()`, `v3Children()`, `v3FieldsToFrontendSchema()` — `server/routes/ai.js`
- `V3_API`, `metodo_extraccion`, `v3-proxy`, `v3-split` — `server/services/documentProcessor.js`
- El procesamiento de PDFs externos pasa a ser 100% local vía Ollama

---

## 5. Nueva API Surface

```
# Entrada principal — El punto de acceso único
POST   /api/orchestrator/process        → Procesa cualquier input
POST   /api/orchestrator/batch          → Procesa lote de inputs
GET    /api/orchestrator/status/:id     → Estado de procesamiento
GET    /api/orchestrator/queue          → Cola pendiente
POST   /api/orchestrator/reprocess/:id  → Reprocesar un documento

# Sub-agentes (también accesibles directo si se necesita)
POST   /api/agents/classify             → Solo clasificación
POST   /api/agents/documents/extract    → Solo extracción documental
POST   /api/agents/email/process        → Solo procesamiento email
POST   /api/agents/accounting/concile   → Solo conciliación contable

# Legacy — mantener compatibilidad
POST   /api/ai/classify                 → (deprecated, wrapper a classifier)
POST   /api/ai/extract-document         → (deprecated, wrapper a documentAgent)
POST   /api/ai/classify-email           → (deprecated, wrapper a emailAgent)
POST   /api/documents/upload            → (deprecated, wrapper a orchestrator/process)
```

---

## 6. Flujo de vida de un documento

```
1. Usuario sube PDF a /api/orchestrator/process
2. Orchestrator recibe { file, mimetype, filename }
3. Pre-procesamiento:
   a. Si es PDF → extraer texto (pdf-parse o Tesseract si escaneado)
   b. Si es imagen → OCR (Tesseract)
   c. Si es texto puro → usar directamente
4. Clasificación:
   a. Enviar texto a LLM con prompt SYSTEM_CLASSIFY
   b. Obtener { docType, subType, priority, confidence }
   c. Decidir sub-agente destino
5. Si confidence >= 0.7 → procesamiento automático
   Si confidence < 0.7 → cola de revisión humana
6. Sub-agente ejecuta:
   a. Extrae campos estructurados (con regex + LLM según complejidad)
   b. Valida datos (sumas, coherencia)
   c. Busca duplicados
   d. Almacena en entities/
   e. Genera resumen
7. Respuesta al usuario:
   { status, classification, extracted_data, actions_taken, entities_created }
8. WebSocket → frontend actualizado en tiempo real
9. Log de auditoría
```

---

## 7. Stack técnico (sin cambios a la infraestructura)

- **Runtime:** Node.js (ESM)
- **LLM:** Ollama local (qwen3.5) — agnóstico al modelo
- **BD:** JSON files + JSON Server API `/api/data/`
- **Cola:** In-memory (escalable a bullmq si se necesita)
- **WebSockets:** ws (ya instalado)
- **PDF:** pdf-parse + Tesseract (ya instalados)
- **Framework:** Express 5 (ya instalado)

---

## 8. Metodología: Subagent-Driven Development

Cada sub-agente se construirá con:
1. **Spec** — Definición de inputs, outputs, prompt system, edge cases
2. **Implementación** — Código del agente
3. **Revisión de calidad** — Tests con documentos reales
4. **Integración** — Conexión con el orquestador

Siguiente paso inmediato: construir el `orchestrator.js` y el `classifier.js` como cimiento.