# FileBrain v3 — Async Document Processing Guide

## 🎯 What's New

Mejorado el sistema de FileBrain con **5 correcciones críticas de seguridad y rendimiento**:

| # | Problema | Solución |
|---|----------|----------|
| 1 | **Path Traversal** | Sanitización de providerId con regex estricta |
| 2 | **Procesamiento síncrono** (bloqueaba servidor) | Cola asíncrona JSON + Worker loop nativo |
| 3 | **Sin detección de duplicados** | Hash SHA-256 para evitar re-uploads |
| 4 | **Endpoint /upload tardaba mucho** | Devuelve 202 inmediatamente, procesa en background |
| 5 | **Sin visibilidad del progreso** | Nuevo endpoint `/api/filebrain/status/:documentId` para polling |

---

## 🚀 Arranque

### Terminal 1: Server (API + Express)
```bash
cd /Users/davidnows/sinkia-next
npm start
# Escucha en http://localhost:3001/api/filebrain/*
```

### Terminal 2: Worker (Procesamiento async)
```bash
cd /Users/davidnows/sinkia-next/server
npm run worker
# Procesa documentos en background (máx 2 simultáneamente)
```

---

## 📡 API Endpoints

### 1. **POST `/api/filebrain/upload`** — Subir documento

**Request:**
```bash
curl -X POST http://localhost:3001/api/filebrain/upload \
  -F "file=@/path/to/invoice.pdf" \
  -F "providerId=empresa_xyz"
```

**Response** (HTTP 202 — Accepted):
```json
{
  "success": true,
  "documentId": "a3c5f2e1-4b9d-11ec-81d3-0242ac130003",
  "providerId": "empresa_xyz",
  "status": "pending",
  "message": "Archivo recibido. Se procesará en segundo plano."
}
```

**Errores:**
- `400` — No file provided / providerId inválido
- `409` — Archivo duplicado (mismo hash SHA-256)
- `413` — File > 50MB
- `422` — Tipo de archivo no permitido

**Archivos soportados:**
- ✅ PDF (`application/pdf`)
- ✅ TXT (`text/plain`)
- ✅ JSON (`application/json`)
- ✅ Markdown (`text/markdown`)
- ✅ TIFF, PNG, JPEG (imágenes)

---

### 2. **GET `/api/filebrain/status/:documentId`** — Consultar estado (polling)

**Request:**
```bash
curl http://localhost:3001/api/filebrain/status/a3c5f2e1-4b9d-11ec-81d3-0242ac130003
```

**Response:**
```json
{
  "documentId": "a3c5f2e1-4b9d-11ec-81d3-0242ac130003",
  "providerId": "empresa_xyz",
  "fileName": "invoice.pdf",
  "status": "processing",
  "attempts": 1,
  "maxAttempts": 3,
  "createdAt": "2026-06-27T11:15:00.000Z",
  "startedAt": "2026-06-27T11:15:02.500Z",
  "completedAt": null,
  "error": null
}
```

**Estados posibles:**
- `pending` → Esperando procesamiento
- `processing` → En progreso (worker lo está procesando)
- `completed` → ✅ Listo (markdown guardado en `data/markdown/{documentId}.md`)
- `failed` → ❌ Error después de 3 reintentos

---

### 3. **GET `/api/filebrain/queue/stats`** — Ver estado de la cola

**Request:**
```bash
curl http://localhost:3001/api/filebrain/queue/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 45,
    "pending": 3,
    "processing": 1,
    "completed": 40,
    "failed": 1
  }
}
```

---

## 🔄 Flujo Completo

```
1. Cliente sube PDF
   ↓
POST /api/filebrain/upload
   ↓
2. Server valida + sanitiza providerId
   ↓
3. Computa hash SHA-256 del archivo
   ↓
4. Detecta si ya existe (409)
   ↓
5. Guarda archivo raw en data/raw/{providerId}/{documentId}.pdf
   ↓
6. Crea job en file-queue.json
   ↓
7. Retorna 202 INMEDIATAMENTE
   ↓
─────────────────────────────────────
   Client puede hacer polling ahora
   GET /api/filebrain/status/{documentId}
─────────────────────────────────────
   ↓
8. Worker lee job pendiente (cada 2s)
   ↓
9. Extrae texto (PDF → plaintext)
   ↓
10. Calcula metadata (páginas, lenguaje, resumen)
   ↓
11. Crea markdown con frontmatter YAML
   ↓
12. Guarda en data/markdown/{documentId}.md
   ↓
13. Actualiza status a "completed"
   ↓
Client recibe status: "completed" en polling
```

---

## 🏗️ Estructura de archivos

```
server/
├── queue/
│   └── fileQueue.js              ← Gestor de cola (JSON-based)
├── workers/
│   └── fileProcessor.js           ← Worker que procesa en background
└── routes/
    └── filebrain.js              ← Endpoints (modificado)

data/
├── file-queue.json               ← Estado de la cola (generado automáticamente)
├── raw/
│   └── {providerId}/
│       ├── {documentId}.pdf
│       ├── {documentId}.txt
│       └── ...
└── markdown/
    ├── {documentId}.md           ← Documento procesado con frontmatter
    └── ...
```

---

## 📝 Frontmatter de documentos procesados

Cada `data/markdown/{documentId}.md` contiene:

```yaml
---
id: a3c5f2e1-4b9d-11ec-81d3-0242ac130003
fileName: invoice.pdf
providerId: empresa_xyz
uploadedAt: 2026-06-27T11:15:00.000Z
processedAt: 2026-06-27T11:15:05.230Z
status: completed
pages: 5
language: es
summary: "FACTURA Nº INV-2024-001..."
wordCount: 1250
---

FACTURA Nº INV-2024-001
Fecha: 27/06/2024
...
```

---

## 🛡️ Seguridad implementada

### Path Traversal Prevention
```javascript
// ❌ ANTES (vulnerable)
const providerId = req.body.providerId; // "../../etc/passwd"

// ✅ AHORA (seguro)
const sanitized = providerId.replace(/[^a-z0-9-_]/gi, '').toLowerCase();
// "../../etc/passwd" → ""
// "empresa-xyz_01" → "empresa-xyz_01" ✓
```

### Duplicate Detection
```javascript
const fileHash = crypto
  .createHash('sha256')
  .update(buffer)
  .digest('hex');

const existing = checkDuplicate(fileHash);
if (existing) {
  // Return 409 Conflict
  return res.status(409).json({
    error: 'Este archivo ya fue subido previamente',
    existingDocumentId
  });
}
```

### File Size Limit
- Máximo 50MB por archivo
- Validación de MIME type en multer

---

## ⚙️ Configuración del Worker

En `server/workers/fileProcessor.js`:

```javascript
const WORKER_INTERVAL = 2000;        // Revisar cola cada 2 segundos
const MAX_CONCURRENT_JOBS = 2;       // Procesar máx 2 en paralelo
const maxAttempts = 3;               // Reintentar 3 veces antes de fallar
```

**Recomendaciones por recurso:**
- Oracle Free (1GB RAM): `MAX_CONCURRENT_JOBS = 1`
- Mac Mini (16GB+ RAM): `MAX_CONCURRENT_JOBS = 3-4`

---

## 🔧 Troubleshooting

### Worker no procesa documentos
```bash
# 1. Verificar worker está corriendo
ps aux | grep fileProcessor

# 2. Ver logs en realtime (terminal worker)
# Debería ver: "[WORKER] 👷 File processor worker starting..."

# 3. Revisar file-queue.json (si está corrupto, limpiar)
cat data/file-queue.json
```

### Documento queda en "processing" forever
```bash
# Worker murió sin actualizar status
# Solución: matar worker, limpiar file-queue.json, reiniciar

rm data/file-queue.json
# Terminal worker: Ctrl+C
# Terminal worker: npm run worker (reiniciar)
```

### Endpoint /upload devuelve 400 "providerId inválido"
```javascript
// Validar que providerId cumple:
// - Solo [a-z0-9-_]
// - No vacío
// - Máx 100 caracteres
// - No contiene "..", "/" o "\"

// Ej. válidos:
// "empresa_xyz"
// "chicken-palace-ibiza"
// "provider123"

// Ej. INVÁLIDOS:
// "../../etc"      (path traversal)
// "EMPRESA XYZ"    (mayúsculas)
// "empresa/../pwd" (path traversal)
```

---

## 📊 Monitoreo

### Ver cola actual
```bash
curl http://localhost:3001/api/filebrain/queue/stats
```

### Ver estado de documento específico
```bash
curl http://localhost:3001/api/filebrain/status/{documentId}
```

### Logs del worker
```bash
# Terminal donde corre worker muestra:
[WORKER] 🔄 Processing document a3c5f2e1...
[WORKER] ✅ Document a3c5f2e1 processed successfully
[WORKER] Queue stats: 2 pending, 1 processing, 38 completed, 1 failed
```

---

## 🚀 Frontend Integration (React)

```javascript
// 1. Upload documento
const response = await fetch('/api/filebrain/upload', {
  method: 'POST',
  body: formData, // new FormData() + file + providerId
});
const { documentId } = await response.json();

// 2. Poll estado
const pollStatus = async () => {
  const res = await fetch(`/api/filebrain/status/${documentId}`);
  const job = await res.json();
  
  if (job.status === 'completed') {
    console.log('✅ Documento listo!');
    // Markdown guardado en: data/markdown/{documentId}.md
  } else if (job.status === 'failed') {
    console.error('❌ Error:', job.error);
  } else {
    // "pending" o "processing"
    setTimeout(pollStatus, 1000); // Reintentar en 1s
  }
};

pollStatus();
```

---

## 📚 Próximas mejoras

1. **Integrar AgentCore para clasificación IA**
   - Detectar tipo: factura, contrato, ticket, etc
   - Extraer emisor, cantidad, fecha automáticamente

2. **OCR para scanned PDFs**
   - Usar tesseract.js para PDFs sin texto

3. **Búsqueda full-text en markdown**
   - Indexar documentos procesados en Qdrant o similiar

4. **Webhooks/eventos**
   - Notificar a cliente cuando documento está ready

---

## 📦 Dependencias (sin cambios)

Todas las dependencias ya están en `package.json`:
- ✅ `express` — Server
- ✅ `multer` — Upload
- ✅ `uuid` — IDs únicos
- ✅ `fs-extra` — File ops
- ✅ `pdf-parse` — PDF extraction
- ✅ `gray-matter` — YAML parsing

**Nota:** No hay nuevas dependencias externas. Se usa JSON para la cola en lugar de Redis.

---

## 📝 Git Commit

```
feat: Add FileBrain v3 — Async document processing with security hardening

✨ Features:
- Path traversal prevention (sanitize providerId)
- Duplicate detection (SHA-256 hashing)
- Async processing queue (JSON-based, no Redis)
- Worker loop for background processing
- Status polling endpoint (/status/:documentId)
- Automatic retry logic (max 3 attempts)

🔒 Security:
- Strict providerId validation (regex [a-z0-9-_])
- File hash deduplication
- 50MB file size limit
- MIME type whitelist

🚀 Performance:
- Returns 202 immediately on upload
- Processes max 2 documents in parallel
- Queue persisted to disk (data/file-queue.json)
- ~350 lines of new code

Co-Authored-By: Oz <oz-agent@warp.dev>
```

---

**Happy uploading! 🎉**
