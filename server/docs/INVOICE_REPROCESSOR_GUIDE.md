# Invoice Reprocessor — Sistema de Reprocessamiento Automático

## 📋 Resumen

Sistema que detecta y reprocessa automáticamente facturas antiguas con nuevas directrices en **background**, sin intervención manual.

- **Detecta**: Facturas sin análisis o con análisis obsoletos (>24h)
- **Reprocessa**: Con nuevas directrices usando OpenRouter Free o Ollama
- **Ejecuta**: En background cada 60 segundos (configurable)
- **Usa**: Configuración existente de LM Studio, OpenRouter, Ollama

---

## 🔧 Configuración (Usa lo existente)

El reprocessador usa tu configuración actual:

```env
# OpenRouter Free (si está configurado)
OPENROUTER_API_KEY=openrouter:sk-or-...7aa7
OPENROUTER_URL=https://openrouter.ai/api/v1

# Ollama (fallback)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# LM Studio (ya configurado)
LMSTUDIO_URL=http://127.0.0.1:4000/v1
LMSTUDIO_MODEL=negentropy-claude-opus-4.7-9b
```

**Sin cambios necesarios** — funciona con tu setup actual.

---

## 🚀 Iniciar Reprocessador

### Opción 1: API REST (Recomendado)

```bash
# Iniciar con parámetros por defecto
curl -X POST http://localhost:3001/api/invoice/reprocessor/start \
  -H "Content-Type: application/json" \
  -d '{}'

# Iniciar con parámetros personalizados
curl -X POST http://localhost:3001/api/invoice/reprocessor/start \
  -H "Content-Type: application/json" \
  -d '{
    "intervalMs": 60000,
    "lookbackDays": 30,
    "maxAge": 86400000,
    "batchSize": 2,
    "useOpenRouter": true,
    "guidelines": {
      "detectInflation": true,
      "checkCompliance": true,
      "evaluateESG": true,
      "compareBenchmarks": true,
      "findAutomation": true
    }
  }'
```

### Opción 2: Desde Node.js (Integración)

```javascript
import { getReprocessor } from './services/invoiceReprocessor.js';

const reprocessor = getReprocessor();

// Iniciar en background
reprocessor.start({
  // Métodos que proporciona tu DB
  getReprocessingCandidates: async (opts) => {
    return await db.invoices.find({
      analyzed_at: { $lt: new Date(Date.now() - opts.maxAge) },
      createdAt: { $gte: new Date(Date.now() - opts.lookbackDays * 86400000) }
    });
  },
  
  updateAnalysis: async (data) => {
    await db.invoiceAnalysis.updateOne(
      { invoice_id: data.invoice_id },
      {
        markdown: data.markdown,
        old_analysis: data.old_analysis,
        new_analysis: data.new_analysis,
        alerts: data.alerts,
        reprocessed_at: data.reprocessed_at,
        reprocessed_version: data.reprocessed_version
      }
    );
  }
}, 60000); // Cada 60 segundos

// Escuchar eventos
reprocessor.on('candidates-detected', (data) => {
  console.log(`🔍 Detectadas ${data.count} facturas para reprocessar`);
});

reprocessor.on('invoice-reprocessed', (data) => {
  console.log(`✅ Reprocessada: ${data.invoice_id}`);
  console.log(`   Alertas: ${data.alerts}`);
  console.log(`   Mejora: ${data.improved ? 'SÍ ✨' : 'No'}`);
});

reprocessor.on('batch-complete', (stats) => {
  console.log(`🎉 Lote completado: ${stats.reprocessed} OK, ${stats.failed} error`);
});
```

---

## 📊 Monitorear Reprocessador

### Ver Estado Actual

```bash
curl http://localhost:3001/api/invoice/reprocessor/status
```

Respuesta:
```json
{
  "success": true,
  "isRunning": true,
  "reprocessedCount": 12,
  "failedCount": 1,
  "queueSize": 0
}
```

### Ver Estadísticas Detalladas

```bash
curl http://localhost:3001/api/invoice/reprocessor/stats
```

Respuesta:
```json
{
  "success": true,
  "stats": {
    "isRunning": true,
    "reprocessedCount": 12,
    "failedCount": 1,
    "detected": 50,
    "reprocessing": 0,
    "completed": 12,
    "failed": 1,
    "startTime": "2026-06-28T12:00:00Z",
    "endTime": "2026-06-28T12:05:30Z",
    "timestamp": "2026-06-28T12:38:34Z"
  }
}
```

---

## ⛔ Detener Reprocessador

```bash
curl -X POST http://localhost:3001/api/invoice/reprocessor/stop
```

---

## 🔄 Reprocessar Factura Específica

```bash
curl -X POST http://localhost:3001/api/invoice/reprocessor/reprocess-now \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "INV-2026-001234",
    "useOpenRouter": true
  }'
```

---

## 📝 Actualizar Directrices

Cambiar directrices sin reiniciar:

```bash
curl -X POST http://localhost:3001/api/invoice/reprocessor/update-guidelines \
  -H "Content-Type: application/json" \
  -d '{
    "guidelines": {
      "detectInflation": true,
      "checkCompliance": true,
      "evaluateESG": false,
      "compareBenchmarks": true,
      "findAutomation": true,
      "customRules": [
        "Detectar cambios de formato de proveedor",
        "Validar nuevos campos obligatorios 2026"
      ]
    }
  }'
```

---

## 🎯 Parámetros Configurables

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `intervalMs` | 60000 | Cada cuántos ms detectar/reprocessar |
| `lookbackDays` | 30 | Reprocessar últimos N días |
| `maxAge` | 86400000 (24h) | Reprocessar análisis mayores a X ms |
| `batchSize` | 2 | Facturas procesadas en paralelo |
| `useOpenRouter` | true | Intentar OpenRouter primero (fallback Ollama) |
| `guidelines` | {} | Nuevas directrices personalizadas |

---

## 📡 Eventos Emitidos

El reprocessador emite eventos que puedes escuchar:

```javascript
const reprocessor = getReprocessor();

// Iniciado
reprocessor.on('started', (data) => {
  console.log('Reprocessador iniciado:', data.timestamp);
});

// Detectadas candidatas
reprocessor.on('candidates-detected', (data) => {
  console.log(`Detectadas ${data.count} facturas`);
});

// Factura procesada exitosamente
reprocessor.on('invoice-reprocessed', (data) => {
  console.log(`✅ ${data.invoice_id} - ${data.alerts} alertas`);
});

// Error procesando factura
reprocessor.on('reprocessing-failed', (data) => {
  console.log(`❌ ${data.invoice_id}: ${data.error}`);
});

// Lote completado
reprocessor.on('batch-complete', (stats) => {
  console.log(`Lote: ${stats.reprocessed} OK, ${stats.failed} error`);
});

// Error general
reprocessor.on('error', (data) => {
  console.error('Error reprocessador:', data.error);
});

// Detenido
reprocessor.on('stopped', (stats) => {
  console.log('Reprocessador detenido:', stats);
});
```

---

## 🔌 Integración con Socket.IO (Tiempo Real)

```javascript
import { getReprocessor } from './services/invoiceReprocessor.js';

const reprocessor = getReprocessor();

// En tu servidor con Socket.IO
io.on('connection', (socket) => {
  
  // Escuchar eventos del reprocessador
  reprocessor.on('invoice-reprocessed', (data) => {
    socket.emit('invoice-reprocessed', data);
  });
  
  reprocessor.on('batch-complete', (stats) => {
    socket.emit('reprocessor-batch-complete', stats);
  });
  
  // Permitir control desde cliente
  socket.on('reprocessor-start', (opts) => {
    reprocessor.start({...}, 60000, opts);
  });
  
  socket.on('reprocessor-stop', () => {
    reprocessor.stop();
  });
});
```

---

## 🧠 Cómo Funciona Internamente

### 1️⃣ Detección (cada intervalo)
- Consulta BD por facturas sin análisis o análisis antiguo
- Filtra por `lookbackDays` y `maxAge`
- Emite evento `candidates-detected`

### 2️⃣ Reprocessamiento
- Genera **nuevo Markdown** con v2.0 + nuevas directrices
- Envía a **OpenRouter Free** o **Ollama** para análisis
- Construye prompt con:
  - Detección de inflación vs análisis anterior
  - Cumplimiento fiscal 2026
  - Evaluación ESG si aplica
  - Benchmarks del sector
  - Oportunidades de automatización

### 3️⃣ Almacenamiento
- Guarda análisis actualizado
- Preserva análisis anterior para comparación
- Marca como `reprocessed_version: 2.0`
- Emite evento `invoice-reprocessed`

### 4️⃣ Fallback
- Si OpenRouter falla → usa Ollama local
- Si ambos fallan → error capturado, sigue siguiente factura

---

## 📈 Casos de Uso

### Caso 1: Actualizar Todas las Facturas del Mes
```bash
curl -X POST http://localhost:3001/api/invoice/reprocessor/start \
  -H "Content-Type: application/json" \
  -d '{
    "intervalMs": 120000,
    "lookbackDays": 30,
    "maxAge": 86400000,
    "batchSize": 3,
    "guidelines": {
      "detectInflation": true,
      "checkCompliance": true,
      "compareBenchmarks": true
    }
  }'
```

### Caso 2: Reprocessar Solo Facturas Críticas
```javascript
// Desde código
reprocessor.start({
  getReprocessingCandidates: async (opts) => {
    return await db.invoices.find({
      $and: [
        { analyzed_at: { $lt: new Date(Date.now() - opts.maxAge) } },
        { amount: { $gt: 5000 } }, // Solo facturas > €5000
        { status: 'pending_review' }
      ]
    });
  }
}, 300000); // Cada 5 minutos
```

### Caso 3: Auditoría Nocturna
```bash
# Ejecutar reprocessamiento cada medianoche
# (gestionar via cron o scheduler externo)

curl -X POST http://localhost:3001/api/invoice/reprocessor/start \
  -d '{
    "intervalMs": 86400000,
    "lookbackDays": 7,
    "batchSize": 5
  }'
```

---

## ⚠️ Consideraciones

1. **OpenRouter Free Tier**
   - Tiene límites de rate (verifica documentación)
   - Automáticamente redirige a mejor modelo disponible
   - Si se agota, usa fallback Ollama

2. **Performance**
   - Procesa en lotes (default 2) para no sobrecargar
   - Cada factura: ~1-5s con LLM cloud, ~500ms local
   - Ajusta `batchSize` según recursos

3. **Base de Datos**
   - Implementa métodos `getReprocessingCandidates()` y `updateAnalysis()`
   - Asegúrate de índices en `analyzed_at`, `createdAt`
   - Preserva análisis anterior (`old_analysis`)

4. **Nuevas Directrices**
   - Actualiza en tiempo real sin reiniciar
   - Usa `/api/invoice/reprocessor/update-guidelines`
   - Se aplican en próximo ciclo de reprocessamiento

---

## 🛠️ Troubleshooting

### Reprocessador no detecta facturas
```bash
# Verificar parámetros
curl http://localhost:3001/api/invoice/reprocessor/stats

# Revisar: lookbackDays, maxAge, query de BD
```

### OpenRouter no responde
```javascript
// Verifica OPENROUTER_API_KEY en .env
// Fallback automático a Ollama
// Revisa logs: [Reprocessor] OpenRouter falló: ...
```

### Ollama no responde
```bash
# Asegúrate que Ollama está corriendo
curl http://localhost:11434/api/tags

# O configura LM Studio como fallback (editar invoiceReprocessor.js)
```

### Mucho uso de CPU/RAM
```bash
# Reducir batchSize
curl -X POST http://localhost:3001/api/invoice/reprocessor/start \
  -d '{ "batchSize": 1 }'

# O aumentar intervalMs
curl -X POST http://localhost:3001/api/invoice/reprocessor/start \
  -d '{ "intervalMs": 300000 }'
```

---

## 📚 Archivos Relacionados

- `server/services/invoiceReprocessor.js` — Lógica principal
- `server/routes/invoice-reprocessor.js` — API REST
- `server/routes/invoice-analysis.js` — Pipeline análisis (complementario)
- `server/services/invoiceMarkdownGenerator.js` — Generación Markdown
- `server/services/invoiceMarkdownAnalyzer.js` — Análisis con LLM

---

**Status**: ✅ Ready for Production  
**LLM Support**: OpenRouter Free + Ollama Fallback  
**Configuration**: Zero changes needed — uses existing setup
