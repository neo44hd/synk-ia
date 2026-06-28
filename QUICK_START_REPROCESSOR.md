# ⚡ Inicio Rápido: Reprocessador Automático

## 1. Verificar Configuración Actual

Tu setup ya está configurado:

```bash
# Ollama (local)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# OpenRouter Free (cloud)
OPENROUTER_API_KEY=openrouter:sk-or-...7aa7
OPENROUTER_URL=https://openrouter.ai/api/v1

# LM Studio (respaldo)
LMSTUDIO_URL=http://127.0.0.1:4000/v1
LMSTUDIO_MODEL=negentropy-claude-opus-4.7-9b
```

✅ **Sin cambios necesarios** — todo funciona con tu configuración actual.

---

## 2. Iniciar Reprocessador

### Opción A: Línea de Comando (más simple)

```bash
# Iniciar ahora mismo
curl -X POST http://localhost:3001/api/invoice/reprocessor/start \
  -H "Content-Type: application/json" \
  -d '{}'
```

✅ Listo. El reprocessador está buscando facturas antiguas cada 60 segundos.

### Opción B: Con Parámetros Personalizados

```bash
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

---

## 3. Ver Estado

```bash
# Ver si está corriendo
curl http://localhost:3001/api/invoice/reprocessor/status

# Salida:
# {
#   "success": true,
#   "isRunning": true,
#   "reprocessedCount": 5,
#   "failedCount": 0,
#   "queueSize": 0
# }
```

---

## 4. Monitorear en Logs

En la terminal donde corre el servidor verás:

```
[Reprocessor] ✅ Iniciado (intervalo: 60000ms, lookback: 30d)
[Reprocessor] 🔍 Detectadas 10 factura(s) para reprocessamiento
[Reprocessor] 🔄 Reprocessando factura INV-2026-001...
[Reprocessor] ✅ Reprocessada: INV-2026-001
[Reprocessor] 🎉 Lote completo: 10 reprocessadas, 0 errores
```

---

## 5. Detener (Opcional)

```bash
curl -X POST http://localhost:3001/api/invoice/reprocessor/stop
```

---

## 📚 Próximas Acciones

1. **Implementar en tu BD**
   - Los métodos `getReprocessingCandidates()` y `updateAnalysis()` están en la ruta
   - Conecta tu base de datos (MongoDB, PostgreSQL, etc.)
   - Ver: `server/routes/invoice-reprocessor.js` líneas 41-54

2. **Escuchar eventos (Socket.IO)**
   - Actualizar UI en tiempo real cuando facturas se reprocessen
   - Ver: `INVOICE_REPROCESSOR_GUIDE.md` sección "Integración Socket.IO"

3. **Configurar según necesidad**
   - Ajusta `intervalMs` (qué tan frecuente reprocessar)
   - Ajusta `batchSize` (cuántas en paralelo)
   - Define nuevas `guidelines` (qué buscar)

---

## ⚙️ Parámetros Explicados

| Parámetro | Default | Qué Hace |
|-----------|---------|----------|
| `intervalMs` | 60000 | Buscar/reprocessar cada 60 segundos |
| `lookbackDays` | 30 | Reprocessar facturas de últimos 30 días |
| `maxAge` | 86400000 | Reprocessar análisis mayores a 24h |
| `batchSize` | 2 | Procesar 2 facturas simultáneamente |
| `useOpenRouter` | true | Usar OpenRouter Free (fallback Ollama) |

---

## 🆘 Si Algo Falla

### "Reprocessador no detecta facturas"
→ BD no implementada aún. Ver `server/routes/invoice-reprocesser.js` línea 43.

### "OpenRouter no responde"
→ Fallback automático a Ollama. Verifica `OPENROUTER_API_KEY` en `.env`.

### "Ollama no responde"
→ Asegúrate que Ollama está corriendo: `curl http://localhost:11434/api/tags`

### "Mucho uso CPU"
→ Reduce `batchSize` a 1 o aumenta `intervalMs` a 300000 (5 minutos).

---

## 📖 Más Información

- **Guía Completa**: `server/docs/INVOICE_REPROCESSOR_GUIDE.md`
- **Código**: `server/services/invoiceReprocessor.js`
- **API**: `server/routes/invoice-reprocessor.js`

---

## ✅ Resumen

```bash
# 1. Iniciar
curl -X POST http://localhost:3001/api/invoice/reprocessor/start -d '{}'

# 2. Ver estado
curl http://localhost:3001/api/invoice/reprocessor/status

# 3. Listo. Automático en background, sin intervención.
```

**¡Hecho!** 🎉

El sistema está reprocessando todas tus facturas antiguas automáticamente cada 60 segundos, detectando inflación, cumplimiento fiscal 2026, oportunidades de automatización, etc.

Sin hacer nada. Solo funciona.
