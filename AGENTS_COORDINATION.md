# 🤖 Coordinación de Agentes Paralelos - SynK-IA Enterprise

Documento vivo para coordinar el trabajo de 5 agentes en paralelo implementando el Sistema Inteligente de Procesamiento.

## 📋 Agentes Activos

| Agente | ID | Status | Owner |
|--------|-----|--------|-------|
| DocumentProcessor | `019e67c4-5a0d-761d-88ff-9a7b510afde1` | In Progress | Procesamiento |
| Clasificador | `019e67c4-5a0d-7d6a-bf6a-e76b39566ef2` | In Progress | Inteligencia |
| DataExtractor | `019e67c4-5a10-7ee6-8065-5abe4da6f50c` | En cola | Extracción |
| LearningEngine | `019e67c4-5a10-769e-b890-44adb6a4a226` | In Progress | Aprendizaje |
| Integraciones | `019e67c4-5a10-736e-aadc-e98f93958aee` | In Progress | Conectores |

---

## 🔗 Flujo de Datos - Puntos de Integración

### Entrada → DocumentProcessor
```
API: POST /api/process
Input: { file: File, metadata: {} }
Output: { 
  documentId: "doc_xyz",
  type: "factura",
  content: "...",
  metadata: { size, date, ... }
}
```

### DocumentProcessor → Clasificador
```
Dispara: POST /api/classify
Input: { documentId, content, type }
Output: { 
  classification: {
    tipo: "factura",
    departamento: "compras",
    urgencia: "normal",
    estado: "nuevo"
  },
  confidence: 0.95
}
```

### Clasificador → Extractor
```
Si confidence > 0.8:
  Dispara: POST /api/extract
  Input: { documentId, classification, content }
  Output: {
    fields: {
      numero: "FAC-001",
      fecha: "2026-05-27",
      total: 1000.00,
      proveedor: "Acme Inc",
      items: [...]
    },
    confidence: { numero: 0.99, fecha: 0.95, ... }
  }
```

### Extractor → LearningEngine
```
Auto-registra: POST /api/feedback
Input: {
  extraction: {...},
  userConfirmation: true/false,
  corrections: {}
}
Actualiza métricas y prepara reentrenamiento
```

### Integraciones → Procesamiento
```
Si Google Drive integrado:
  Webhook: Nuevo archivo en carpeta
  → Dispara POST /api/process
  → Guarda resultado de vuelta en Drive

Si Zapier integrado:
  POST /api/integrations/zapier/trigger
  Input: { event: "extraction_complete", data: {...} }
  → Ejecuta acciones (email, Slack, etc)
```

---

## 📁 Estructura de Directorios a Crear

```
server/
├── services/
│   ├── documentProcessor/
│   │   ├── universalProcessor.js ← DocumentProcessor
│   │   ├── pdfProcessor.js
│   │   ├── excelProcessor.js
│   │   ├── imageProcessor.js
│   │   └── utils/
│   ├── aiClassifier.js ← Clasificador
│   ├── dataExtractor.js ← Extractor
│   ├── learningEngine.js ← LearningEngine
│   └── integrations/ ← Integraciones
│       ├── googleDrive.js
│       ├── dropbox.js
│       ├── zapier.js
│       └── slack.js
├── routes/
│   ├── processing.js ← DocumentProcessor + Extractor
│   ├── intelligence.js ← Clasificador
│   ├── learning.js ← LearningEngine
│   └── integrations.js ← Integraciones
└── models/
    ├── Document.js
    ├── Classification.js
    ├── Extraction.js
    ├── LearningFeedback.js
    └── Provider.js

src/pages/
├── DocumentProcessor.jsx ← DocumentProcessor UI
├── ClassificationHub.jsx ← Clasificador UI
├── DataExtraction.jsx ← Extractor UI
├── IntelligenceCenter.jsx ← LearningEngine UI
└── IntegrationManager.jsx ← Integraciones UI

src/services/
├── documentService.js ← DocumentProcessor client
├── classifierService.js ← Clasificador client
├── extractorService.js ← Extractor client
├── learningService.js ← LearningEngine client
└── integrationService.js ← Integraciones client
```

---

## 🔐 Variables de Entorno Necesarias

```env
# Google Drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_FOLDER_ID=

# Dropbox
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_FOLDER_PATH=

# Zapier
ZAPIER_HOOK_URL=

# Slack
SLACK_WEBHOOK_URL=
SLACK_BOT_TOKEN=

# Ollama (local)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=harmonic-hermes-9b:latest

# Database
DATABASE_URL=sqlite:./data/synkia.db (si migramos a SQL)
```

---

## 📊 Dependencias Esperadas

### Obligatorias
- `express` - Ya existe
- `multer` - Para upload de archivos
- `pdf-parse` - Parsing de PDFs
- `xlsx` - Parsing de Excel

### Opcionales (con fallback)
- `tesseract.js` - OCR para imágenes
- `@google-cloud/drive` - Google Drive API
- `dropbox` - Dropbox API
- `axios` - HTTP requests para Zapier/Slack

Si alguna falta: documentar y usar fallback o mock.

---

## ✅ Checklist de Integración Final

- [ ] DocumentProcessor tests pasan
- [ ] Clasificador tests pasan
- [ ] Extractor tests pasan
- [ ] LearningEngine tests pasan
- [ ] Integraciones tests pasan
- [ ] Endpoints POST /api/process funciona
- [ ] Endpoints POST /api/classify funciona
- [ ] Endpoints POST /api/extract funciona
- [ ] Endpoints GET /api/learning/metrics funciona
- [ ] Endpoints POST /api/integrations/* funciona
- [ ] UI de DocumentProcessor renderiza sin errores
- [ ] UI de ClassificationHub renderiza sin errores
- [ ] UI de DataExtraction renderiza sin errores
- [ ] UI de IntelligenceCenter renderiza sin errores
- [ ] UI de IntegrationManager renderiza sin errores
- [ ] Flujo end-to-end: Upload → Classify → Extract → Learn funciona
- [ ] Integraciones mock responden correctamente

---

## 🔔 Comunicación

- Agentes reportan bloqueadores en este canal
- Coordina aquí cambios en estructura
- Actualiza este doc cuando se completen secciones

**Última actualización**: 2026-05-27 04:48 UTC
