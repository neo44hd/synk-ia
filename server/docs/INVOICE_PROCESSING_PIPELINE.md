# Pipeline de Procesamiento de Facturas - Cadena de Montaje

## Resumen Ejecutivo

Prototipo implementado de **cadena de montaje inteligente** que transforma facturas JSON brutas en markdown estructurado, analiza con prompts optimizados para LLM, y extrae insights automáticos.

**Objetivo**: Maximizar la comprensión por modelos de IA mientras se reduce errores y facilita análisis posterior.

---

## Arquitectura

```
┌─────────────────┐
│ JSON Factura    │ Raw data de invoice.json
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ ETAPA 1: Extract     │ Validar entrada
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ ETAPA 2: Normalize   │ Estandarizar campos
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ ETAPA 3: Markdown    │ Generar markdown estructurado
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ ETAPA 4: Analyze     │ Procesar con LLM (prompts)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ ETAPA 5: Compare     │ Comparativas futuras
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Resultados JSON      │ Insights + Alertas + Recomendaciones
└──────────────────────┘

Cada etapa emite eventos → Escalable y auditable
```

---

## Componentes Principales

### 1. **invoiceMarkdownGenerator.js**

Convierte datos JSON a markdown legible y estructurado.

**Funciones principales:**
- `generateInvoiceMarkdown(invoice, provider)` → Markdown de factura individual
- `generateProviderMarkdown(provider, invoices)` → Markdown de proveedor completo
- `formatCurrency(value)` → Formato monetario ES
- `formatDate(dateStr)` → Formato fecha ES
- `normalizeText(text)` → Limpieza de texto

**Ejemplo de Markdown generado:**
```markdown
# Factura 30/04/26A295
**ID Sistema**: `id_1782563212778_i55x9vs1b`

## Proveedor
**Nombre**: JOSE RIQUER 7 BJ 3
**CIF/NIF**: —

## Líneas de Producto/Servicio (3 línea(s))
| Descripción | Qty | Unidad | Precio Unitario | IVA% | Total |
|---|---|---|---|---|---|
| PATATA BLANCA | 430 | ud | 0,96 € | 4% | 411,84 € |
| CEBOLLA MORADA | 410 | ud | 1,39 € | 10% | 569,90 € |
| BERENJENAS CAT. EXT | 44,35 | ud | 7,61 € | 10% | 337,40 € |

## Desglose Financiero
| Concepto | Importe |
|---|---|
| **Base Imponible** | 94,70 € |
| **IVA (10%)** | 9,47 € |
| **Total** | **99,58 €** |

## Calidad de Datos
- **Campos faltantes**: CIF/NIF del proveedor
- **Estado de procesamiento**: pagada
```

### 2. **invoiceMarkdownAnalyzer.js**

Genera prompts inteligentes y procesa respuestas de LLM.

**Funciones principales:**
- `generateInvoiceAnalysisPrompt(markdown)` → Prompt para análisis de factura
- `generateProviderAnalysisPrompt(markdown)` → Prompt para análisis de proveedor
- `simulateLLMAnalysis(markdown, type)` → Análisis simulado (para testing)
- `processLLMResponse(llmResponse)` → Normaliza respuesta JSON del LLM
- `analysisToUIAlerts(analysis)` → Convierte análisis a alertas visuales

**Prompts incluyen:**
- Validación de datos (campos faltantes, incompletos, sospechosos)
- Detección de anomalías (valores fuera de rango, inconsistencias)
- Alertas inteligentes (riesgo, calidad, atención)
- Insights útiles (patrones, tendencias, oportunidades)
- Recomendaciones accionables (negociación, búsqueda alternativas, validación)

**Formato de respuesta esperada:**
```json
{
  "validacion": {
    "campos_faltantes": ["CIF proveedor"],
    "campos_incompletos": [],
    "campos_sospechosos": []
  },
  "anomalias": [],
  "alertas": [
    {
      "tipo": "formato_consistente",
      "nivel": "info",
      "mensaje": "Markdown estructurado correctamente procesable",
      "accion_recomendada": "Continuar con análisis"
    }
  ],
  "insights": [...],
  "recomendaciones": [...],
  "score_calidad": 0.85,
  "confianza_analisis": 0.85
}
```

### 3. **invoiceProcessingPipeline.js**

Orquestador central que maneja el flujo completo.

**Clase: InvoiceProcessingPipeline extends EventEmitter**

Métodos principales:
- `async processInvoice(invoiceJSON, options)` → Procesa factura individual
- `async processProvider(provider, invoices, options)` → Procesa proveedor + facturas
- `onStageComplete(stage, callback)` → Subscribe a eventos de etapas
- `onStageError(callback)` → Subscribe a errores

**Eventos emitidos:**
- `stage:start` → Inicio de etapa
- `stage:complete` → Finalización de etapa
- `stage:error` → Error durante etapa

**Ejemplo de uso:**
```javascript
import Pipeline from './invoiceProcessingPipeline.js';
import * as generator from './invoiceMarkdownGenerator.js';
import * as analyzer from './invoiceMarkdownAnalyzer.js';

const pipeline = new Pipeline();

// Escuchar eventos
pipeline.on('stage:complete', (data) => {
  console.log(`✅ ${data.stage} completado`);
});

// Procesar
const result = await pipeline.processInvoice(invoiceJSON, {
  generator,
  analyzer
});

if (result.success) {
  console.log('Markdown:', result.markdown.markdown);
  console.log('Análisis:', result.analysis.analysis);
}
```

---

## Flujo Detallado

### Procesamiento de Factura Individual

1. **Extract** (100ms)
   - Validar JSON de entrada
   - Verificar campos críticos

2. **Normalize** (50ms)
   - Estandarizar nombres de campos
   - Convertir tipos numéricos
   - Limpiar espacios en blanco

3. **Markdown** (100ms)
   - Generar cabecera legible
   - Crear tablas de líneas de producto
   - Desglose financiero
   - Secciones de auditoría
   - **Resultado**: Markdown de ~1000-2000 caracteres

4. **Analyze** (LLM)
   - Enviar markdown + prompt a LLM
   - LLM lee markdown con contexto claro
   - Extrae JSON estructurado con:
     - Anomalías detectadas
     - Alertas de calidad
     - Insights de negocio
     - Recomendaciones

5. **Compare** (Futuro)
   - Comparar contra otros proveedores
   - Detectar oportunidades de ahorro
   - Evaluar riesgos

6. **Complete**
   - Retornar resultado final

---

## Ventajas de Este Enfoque

✅ **Para Modelos de IA:**
- Markdown es formato semi-estructurado, fácil de parsear
- Contexto visual claro (tablas, secciones, jerarquía)
- Menos ambigüedad que JSON crudo
- Prompts pueden enfocarse en análisis, no en parsing

✅ **Para Auditoría:**
- Cada etapa emite eventos → Trazabilidad completa
- Markdown guardado en DB → Verificable qué vio el LLM
- Reproducible: mismo markdown → mismo análisis

✅ **Para Escalabilidad:**
- Eventos permiten procesamiento paralelo
- Colas entre etapas (Redis/Kafka si es necesario)
- Cada componente independiente y testeable

✅ **Para Precisión:**
- Esquema markdown consistente
- Menos hallucinations (LLM tiene contexto claro)
- Validación en cada etapa

---

## Pruebas

### Ejecutar Suite Completa

```bash
node server/tests/invoice-processing-pipeline.test.js
```

### Resultados

```
✅ Pruebas pasadas: 4/4

TEST 1: Procesar Factura Individual ✅
TEST 2: Procesar Proveedor Completo ✅
TEST 3: Validar Estructura de Markdown ✅
TEST 4: Validar Prompts para LLM ✅
```

**Qué valida cada test:**
1. Pipeline ejecuta todas las etapas sin errores
2. Provider + invoices se procesan correctamente
3. Markdown generado tiene secciones requeridas y datos extraídos
4. Prompts para LLM son válidos y contienen instrucciones JSON

---

## Integración Futura

### Conectar con LLM Real (Ollama/OpenAI)

Reemplazar `simulateLLMAnalysis()` con llamada real:

```javascript
// Opción 1: Ollama local
async function analyzedWithOllama(markdown) {
  const prompt = generateInvoiceAnalysisPrompt(markdown);
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama2',
      prompt,
      stream: false
    })
  });
  const json = await response.json();
  return JSON.parse(json.response);
}

// Opción 2: OpenAI
async function analyzeWithOpenAI(markdown) {
  const prompt = generateInvoiceAnalysisPrompt(markdown);
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

### Almacenar Markdown en DB

```javascript
// Guardar para auditoría
await db.invoiceMarkdowns.insert({
  invoice_id: result.invoice_id,
  markdown: result.markdown.markdown,
  analysis: result.analysis.analysis,
  created_at: new Date()
});
```

### Agregar Cola de Eventos

```javascript
// Con Bull (Redis queue)
const invoiceQueue = new Queue('invoice-processing');

invoiceQueue.process(async (job) => {
  const pipeline = new Pipeline();
  return await pipeline.processInvoice(job.data, options);
});

invoiceQueue.on('completed', (job, result) => {
  console.log(`✅ Invoice ${result.invoice_id} completed`);
  // Trigger siguiente etapa
});
```

---

## Métricas de Rendimiento

Con datos de prueba:

| Etapa | Tiempo | Tamaño Output |
|---|---|---|
| Extract | <10ms | — |
| Normalize | <50ms | — |
| Markdown (factura) | ~100ms | 1,140 caracteres |
| Markdown (proveedor+facturas) | ~150ms | 2,000+ caracteres |
| Analyze (simulado) | <10ms | 2,600 caracteres prompt |
| **Total** | **~320ms** | **3,600+ caracteres** |

Con LLM real (Ollama):
- Esperado: +1-5 segundos (depende modelo/HW)

---

## Configuración Próximos Pasos

1. **Integrar LLM Real**: Reemplazar `simulateLLMAnalysis()` con Ollama/OpenAI
2. **Almacenamiento**: Guardar markdown + análisis en DB para auditoría
3. **API Endpoint**: Exponer `/api/invoice/analyze` para UI
4. **Persistencia**: Guardar análisis junto a factura original
5. **Alertas Visuales**: Mostrar en ProvidersNew.jsx usando `analysisToUIAlerts()`

---

## Referencias

- **Files**: `server/services/invoice*.js`
- **Tests**: `server/tests/invoice-processing-pipeline.test.js`
- **Codebase**: `/Users/davidnows/sinkia-next`

---

**Creado**: 2026-06-28  
**Status**: ✅ Prototipo Funcional, Listo para Integración
