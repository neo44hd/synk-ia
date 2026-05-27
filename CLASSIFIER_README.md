# Classification Engine - SynK-IA Enterprise

Motor de clasificación automática de documentos con reglas locales + enriquecimiento con Ollama.

## 📊 Características

- **Clasificación Automática**: Categoriza documentos en 4 dimensiones
- **Reglas Locales**: Palabras clave sin dependencias externas
- **Ollama Integration**: Enriquecimiento opcional con modelos locales
- **Feedback Learning**: Sistema para mejorar con correcciones del usuario
- **Estadísticas**: Precisión y desglose por categoría
- **Historial**: Seguimiento completo de todas las clasificaciones

## 🎯 Categorías

### Tipo de Documento
- `Factura` - Documento de facturación
- `Presupuesto` - Cotización o propuesta
- `Contrato` - Acuerdo vinculante
- `PO` - Orden de compra
- `Recibo` - Comprobante de pago
- `Otro` - Categoría por defecto

### Departamento
- `Compras` - Adquisiciones y suministros
- `RRHH` - Recursos Humanos
- `Legal` - Asuntos legales
- `Finanzas` - Contabilidad y tesorería
- `IT` - Sistemas e infraestructura
- `Otro` - Otros departamentos

### Urgencia
- `Normal` - Procesamiento estándar
- `Urgente` - Requiere atención pronta
- `Critical` - Requiere atención inmediata

### Estado
- `Nuevo` - Recién ingresado
- `Procesado` - Ya revisado/aprobado
- `Archivado` - Documento histórico

## 🔌 API Endpoints

### POST /api/classify
Clasificar un documento/texto

**Request:**
```json
{
  "text": "Factura del mes de mayo del proveedor Telefónica por servicios de internet...",
  "documentId": "optional-id",
  "filename": "optional-filename.pdf",
  "mimeType": "optional-mime-type"
}
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "id": "cls_1234567890_abc123xyz",
    "timestamp": "2026-05-27T04:50:00Z",
    "classification": {
      "tipo": { "value": "Factura", "confidence": 92 },
      "departamento": { "value": "Finanzas", "confidence": 88 },
      "urgencia": { "value": "Normal", "confidence": 75 },
      "estado": { "value": "Nuevo", "confidence": 95 }
    },
    "metadata": {
      "textLength": 234,
      "documentId": "optional-id",
      "filename": "optional-filename.pdf"
    },
    "feedback": null,
    "ollamaUsed": true
  }
}
```

### POST /api/classify/feedback
Registrar correcciones del usuario

**Request:**
```json
{
  "classificationId": "cls_1234567890_abc123xyz",
  "corrected": {
    "tipo": "Factura",
    "departamento": "Finanzas",
    "urgencia": "Urgente",
    "estado": "Procesado"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Feedback recorded successfully"
}
```

### GET /api/classify/stats
Obtener estadísticas del clasificador

**Response:**
```json
{
  "ok": true,
  "stats": {
    "total_classifications": 42,
    "correct_classifications": 38,
    "accuracy_percentage": 90,
    "classifications_per_category": {
      "tipo": { "Factura": 20, "Presupuesto": 15, "Contrato": 5, "PO": 2 },
      "departamento": { "Finanzas": 25, "Compras": 12, "RRHH": 5 },
      "urgencia": { "Normal": 35, "Urgente": 7 },
      "estado": { "Nuevo": 30, "Procesado": 12 }
    }
  }
}
```

### GET /api/classify/history
Obtener historial de clasificaciones

**Query Parameters:**
- `limit` - Máximo de resultados (default 50, max 500)
- `offset` - Para paginación (default 0)
- `tipo` - Filtrar por tipo (optional)
- `departamento` - Filtrar por departamento (optional)

**Response:**
```json
{
  "ok": true,
  "total": 42,
  "limit": 50,
  "offset": 0,
  "history": [
    {
      "id": "cls_...",
      "timestamp": "2026-05-27T04:50:00Z",
      "classification": { ... },
      "metadata": { ... },
      "feedback": null
    },
    ...
  ]
}
```

### GET /api/classify/breakdown
Desglose de clasificaciones por categoría

**Response:**
```json
{
  "ok": true,
  "breakdown": {
    "tipo": { "Factura": 20, "Presupuesto": 15, ... },
    "departamento": { "Finanzas": 25, "Compras": 17, ... },
    "urgencia": { "Normal": 35, "Urgente": 7, ... },
    "estado": { "Nuevo": 30, "Procesado": 12, ... }
  }
}
```

## 🎨 Frontend Usage

### Import Service
```javascript
import classifierService from '@/services/classifierService';
```

### Clasificar Texto
```javascript
const result = await classifierService.classify(
  "Texto del documento aquí",
  { filename: "doc.pdf" }
);
```

### Registrar Feedback
```javascript
await classifierService.recordFeedback(result.id, {
  tipo: "Factura",
  departamento: "Finanzas",
  urgencia: "Urgente",
  estado: "Procesado"
});
```

### Obtener Estadísticas
```javascript
const stats = await classifierService.getStats();
console.log(`Precisión: ${stats.accuracy_percentage}%`);
```

### Obtener Historial
```javascript
const history = await classifierService.getHistory(50, 0, "Factura", "Finanzas");
history.history.forEach(item => {
  console.log(item.classification.tipo.value);
});
```

## 🔧 Configuración

### Variables de Entorno
```env
# Modelo Ollama a usar (default: harmonic-hermes-9b:latest)
OLLAMA_MODEL=harmonic-hermes-9b:latest

# URL de Ollama (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434

# Directorio de datos (default: ./data)
DATA_DIR=./data
```

### Algoritmo de Clasificación

1. **Reglas Locales (Fast)**: Busca palabras clave en el texto
   - Sin dependencias externas
   - Respuesta inmediata
   - Confianza 0-100%

2. **Ollama Enriquecimiento (Optional)**: Si Ollama está disponible
   - Refina la clasificación
   - Timeout 15 segundos
   - Fallback automático a reglas

3. **Fusión de Resultados**: Combina ambos métodos
   - Si Ollama tiene confianza > 70%, se usa resultado fusionado
   - Si no, prevalecen las reglas locales
   - Confianza final es promedio de ambos

## 📊 Ejemplo de Flujo

```
Usuario -> ClassificationHub.jsx
     |
     v
POST /api/classify (texto)
     |
     v
Backend: aiClassifier.js
     ├─ Reglas locales (inmediato)
     ├─ Ollama enriquecimiento (si disponible, 15s timeout)
     └─ Fusión de resultados
     |
     v
Response con clasificación + confianza
     |
     v
Usuario revisa resultado
     ├─ Correcto → siguiente documento
     └─ Incorrecto → POST /api/classify/feedback → modelo aprende
```

## 📈 Monitoreo

### Estadísticas en Tiempo Real
- Total de clasificaciones
- Clasificaciones correctas
- Precisión global
- Desglose por categoría

### Mejora Continua
- Cada feedback incorrecto = ajuste de confianza
- Historial completo para análisis
- Tendencias por tipo/departamento

## 🚀 Página de Control

Acceder a `/classification-hub` para:
- Clasificar documentos nuevos
- Ver historial con filtros
- Registrar feedback
- Visualizar estadísticas en tiempo real

## 📁 Estructura de Archivos

```
server/
├── services/
│   └── aiClassifier.js          # Motor de clasificación
├── routes/
│   └── intelligence.js          # Endpoints REST
└── data/
    └── classifications.json      # Historial persistente

src/
├── services/
│   └── classifierService.js     # Cliente frontend
└── pages/
    └── ClassificationHub.jsx    # Interfaz de usuario
```

## ⚠️ Notas Importantes

1. **Ollama Optional**: El sistema funciona sin Ollama, solo con reglas
2. **Persistencia**: Las clasificaciones se guardan en `data/classifications.json`
3. **Token Auth**: Endpoints requieren `x-admin-token` o Tailscale
4. **Timeout**: Ollama tiene timeout de 15 segundos
5. **Archivo de Texto**: Actualmente solo soporta .txt para subida de archivos

## 🔍 Troubleshooting

### "Ollama not available"
- Verificar que Ollama está corriendo: `ollama list`
- Endpoint correcto: `http://localhost:11434`
- El modelo es accesible: `ollama pull harmonic-hermes-9b`

### "Classification not found"
- El ID de clasificación es válido
- La clasificación fue registrada hace poco (check `data/classifications.json`)

### Baja precisión
- Revisiones: más feedback → mejor aprendizaje
- Palabras clave: ajustar en `aiClassifier.js`
- Modelo Ollama: probar con otro modelo

## 📚 Referencias

- Ollama: https://ollama.ai
- Harmonic Hermes: Local generalist model
- React Query: Data fetching y caching
