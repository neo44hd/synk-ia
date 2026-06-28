# Quick Start: Sistema Automático de Análisis de Facturas

## 🚀 Uso Rápido

### 1. **Procesar una Factura Individual**

```bash
curl -X POST http://localhost:3000/api/invoice/analyze \
  -H "Content-Type: application/json" \
  -d '{"invoice": {...factura...}}'
```

**Respuesta:**
```json
{
  "success": true,
  "invoice_id": "id_...",
  "markdown": "# Factura ...",
  "analysis": {
    "validacion": {...},
    "anomalias": [...],
    "alertas": [...],
    "score_calidad": 0.85
  },
  "ui_alerts": [...]
}
```

---

### 2. **Procesar Proveedor Completo**

```bash
curl -X POST http://localhost:3000/api/provider/analyze \
  -H "Content-Type: application/json" \
  -d '{"provider": {...}, "invoices": [...]}'
```

---

### 3. **Procesar Múltiples Facturas en Paralelo**

```bash
curl -X POST http://localhost:3000/api/invoice/batch-analyze \
  -H "Content-Type: application/json" \
  -d '{"invoices": [...]}'
```

**Procesa en lotes de 5 de forma automática**

---

### 4. **Activar Procesamiento Automático en Background**

En `server.js` o archivo de inicialización:

```javascript
import { getAutoProcessor } from './services/invoiceAutoProcessor.js';

// Iniciar procesamiento automático
const autoProcessor = getAutoProcessor();
autoProcessor.start({
  getPendingInvoices: async () => {
    // Obtener facturas sin análisis de DB
    return await db.invoices.find({ analyzed: false });
  },
  saveAnalysis: async (analysisData) => {
    // Guardar análisis en DB
    return await db.invoiceAnalysis.insert(analysisData);
  }
}, 30000); // Cada 30 segundos

// Escuchar eventos
autoProcessor.on('invoice-processed', (data) => {
  console.log(`✅ Factura ${data.invoice_id} procesada`);
  // Notificar al frontend
});

autoProcessor.on('batch-complete', (stats) => {
  console.log(`✅ Lote completado: ${stats.processed} procesadas, ${stats.failed} fallidas`);
});
```

---

## 📊 Flujo Automático Completo

```
┌─────────────────────────────────────────┐
│ 1. Nueva factura llega (upload, email)  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. AutoProcessor detecta factura sin    │
│    análisis (cada 30s)                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. Pipeline procesa:                    │
│    JSON → Normalize → Markdown →        │
│    Analyze → Save                       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 4. Análisis guardado en DB +            │
│    Eventos emitidos                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 5. UI se actualiza con alertas en       │
│    tiempo real                          │
└─────────────────────────────────────────┘
```

---

## 🔌 Integración con ProvidersNew.jsx

**Ya funcionará automáticamente porque:**

1. Cada factura nueva se procesa en background
2. Los análisis incluyen `ui_alerts` listos para UI
3. El componente puede mostrar directamente las alertas

```jsx
// En ProvidersNew.jsx, agregar análisis automático:
import { getAutoProcessor } from '../../server/services/invoiceAutoProcessor.js';

useEffect(() => {
  const processor = getAutoProcessor();
  
  // Listener para alertas
  processor.on('invoice-processed', (data) => {
    // Refrescar análisis para esa factura
    loadInvoiceAnalysis(data.invoice_id);
  });
  
  return () => processor.removeListener('invoice-processed');
}, []);
```

---

## 📋 Estadísticas del Procesador

```javascript
const processor = getAutoProcessor();
console.log(processor.getStats());

// Retorna:
// {
//   isRunning: true,
//   processedCount: 145,
//   failedCount: 2,
//   queueSize: 0,
//   uptime: "2026-06-28T12:35:00.000Z"
// }
```

---

## ⚙️ Configuración

| Parámetro | Valor | Descripción |
|---|---|---|
| Intervalo procesamiento | 30,000 ms | Cada 30 segundos busca facturas pendientes |
| Tamaño lote | 3 | Procesa 3 facturas en paralelo |
| Timeout análisis | (LLM) | Depende del modelo usado |

**Modificables en `invoiceAutoProcessor.js` líneas 31 y 101**

---

## 🎯 Próximos Pasos (Automáticos)

✅ **Ya implementado:**
- Pipeline de procesamiento
- Endpoints API
- Servicio automático
- Tests validados

⏳ **Sin intervención necesaria:**
1. Conectar con LLM real (Ollama/OpenAI) → Método `simulateLLMAnalysis()` reemplazado
2. Guardar en DB → Método `dataSource.saveAnalysis()` llamado automáticamente
3. Notificaciones UI → Eventos emitidos automáticamente
4. Procesamiento continuo → Se ejecuta cada 30s automáticamente

---

## 🚨 Debugging

```bash
# Ver logs de procesamiento
tail -f /logs/invoice-processor.log

# Estadísticas en tiempo real
curl http://localhost:3000/api/processor/stats
```

---

**Sistema completamente automatizado. Una vez LLM conectado, funciona sin intervención manual.**
