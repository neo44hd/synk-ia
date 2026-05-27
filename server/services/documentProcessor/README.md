# DocumentProcessor Universal

Procesador universal y modular para documentos en SynK-IA Enterprise. Soporta múltiples formatos de archivo con extracción inteligente de metadata y texto.

## Características

✅ **Formatos Soportados**
- PDF (via pdf-parse o pdftotext del sistema)
- Excel/XLSX/CSV (via xlsx library)
- Word/DOCX (via adm-zip + XML parsing)
- Imágenes PNG/JPG/TIFF (con OCR fallback)
- Texto plano

✅ **Capacidades**
- Detección automática de tipo de archivo
- Extracción de metadata
- OCR para imágenes (Tesseract, tesseract.js, pytesseract)
- Procesamiento paralelo futuro (pool de concurrency)
- Almacenamiento estructurado en `data/documents/`
- Validación robusta de buffers
- Fallback graceful sin dependencias externas

## Estructura de Módulos

```
server/services/documentProcessor/
├── universalProcessor.js      # Orquestador principal
├── pdfProcessor.js            # Procesador PDF
├── excelProcessor.js          # Procesador Excel/CSV
├── docxProcessor.js           # Procesador Word
├── imageProcessor.js          # Procesador de imágenes + OCR
└── README.md                  # Este archivo

server/routes/
└── processing.js              # Ruta HTTP: POST /api/process

server/tests/
└── documentProcessor.test.js   # Tests unitarios
```

## API

### POST /api/process

Procesa un documento único.

**Parámetros:**
```bash
curl -X POST http://localhost:3001/api/process \
  -H "x-admin-token: sinkia2026" \
  -F "file=@document.pdf" \
  -F "save=true" \
  -F "format=full"
```

**Query Parameters:**
- `save=true` - Guardar resultado en `data/documents/`
- `format=summary|full` - Formato de respuesta (default: full)

**Response (Full):**
```json
{
  "filename": "invoice.pdf",
  "mimeType": "application/pdf",
  "documentType": "pdf",
  "size": 524288,
  "processingTime": 342,
  "timestamp": "2026-05-27T04:49:41Z",
  "status": "success",
  "content": {
    "text": "Invoice #12345...",
    "metadata": {
      "extractionMethod": "pdf-parse",
      "pages": 3,
      "producer": "Adobe Acrobat",
      "creator": "Microsoft Word"
    }
  },
  "error": null
}
```

### POST /api/process/batch

Procesa múltiples documentos en paralelo.

```bash
curl -X POST http://localhost:3001/api/process/batch \
  -H "x-admin-token: sinkia2026" \
  -F "files=@doc1.pdf" \
  -F "files=@doc2.xlsx" \
  -F "files=@doc3.docx" \
  -F "concurrency=4"
```

**Response:**
```json
{
  "total": 3,
  "successful": 3,
  "partial": 0,
  "failed": 0,
  "results": [...]
}
```

### GET /api/process/supported

Lista tipos de archivo soportados.

```bash
curl http://localhost:3001/api/process/supported \
  -H "x-admin-token: sinkia2026"
```

**Response:**
```json
{
  "types": {
    "PDF": "application/pdf",
    "XLSX": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "CSV": "text/csv",
    "DOCX": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "PNG": "image/png",
    "JPG": "image/jpeg",
    "TIFF": "image/tiff",
    "TXT": "text/plain"
  },
  "formats": ["PDF", "XLSX", "XLS", "CSV", "DOCX", "DOC", "PNG", "JPG", "TIFF", "TXT"],
  "mimeTypes": [...]
}
```

### GET /api/process/health

Verifica disponibilidad de procesadores especializados.

```bash
curl http://localhost:3001/api/process/health \
  -H "x-admin-token: sinkia2026"
```

## Funciones Principales (universalProcessor.js)

### `detectDocumentType(mimeType, filename)`
Detecta tipo de documento basado en MIME y extensión.

```javascript
import { detectDocumentType } from './universalProcessor.js';

const type = detectDocumentType('application/pdf', 'file.pdf');
// returns: 'pdf'
```

### `processDocument(buffer, mimeType, filename, options)`
Procesa documento universal.

```javascript
import { processDocument } from './universalProcessor.js';
import { readFileSync } from 'fs';

const buffer = readFileSync('invoice.pdf');
const result = await processDocument(buffer, 'application/pdf', 'invoice.pdf');

console.log(result.status);        // 'success' | 'partial' | 'error'
console.log(result.content.text);  // Texto extraído
console.log(result.processingTime); // ms
```

### `processDocumentsParallel(documents, concurrency)`
Procesamiento paralelo de múltiples documentos.

```javascript
import { processDocumentsParallel } from './universalProcessor.js';

const docs = [
  { buffer: buf1, mimeType: 'application/pdf', filename: 'doc1.pdf' },
  { buffer: buf2, mimeType: 'text/csv', filename: 'data.csv' },
];

const results = await processDocumentsParallel(docs, 4);
// Procesa 4 documentos en paralelo
```

### `validateDocumentBuffer(buffer, mimeType, filename)`
Valida si un buffer es un documento válido.

```javascript
const validation = validateDocumentBuffer(buffer, 'application/pdf', 'file.pdf');
if (!validation.valid) {
  console.error(validation.error);
}
```

## Dependencias

**Instaladas (package.json):**
- `xlsx@^0.18.5` - Procesamiento de Excel/CSV
- `pdf-parse@^1.1.1` - Extracción de PDF
- `adm-zip@^0.5.16` - Parseo de DOCX (ZIP)

**Opcionales (sistema):**
- `pdftotext` - Extracción rápida de PDF (fallback)
- `tesseract` - OCR de imágenes (fallback)
- `pytesseract` + `python3` - OCR alternativo (fallback)

**Opcionales (npm, si se instalan):**
- `tesseract.js` - OCR en navegador/Node
- `mammoth` - Parseo avanzado de DOCX
- `sharp` - Generación de thumbnails
- `exif-parser` - Extracción de EXIF de imágenes

## OCR y Fallbacks

### Para Imágenes:
1. **Intenta:** tesseract CLI del sistema
2. **Intenta:** tesseract.js (npm, si está instalado)
3. **Intenta:** pytesseract vía Python
4. **Fallback:** Retorna solo metadata (tamaño, formato, dimensiones)

**Instalación de OCR (opcional):**
```bash
# macOS
brew install tesseract

# Linux (Ubuntu/Debian)
sudo apt-get install tesseract-ocr

# O usar tesseract.js (npm)
npm install tesseract.js
```

### Para PDF:
1. **Intenta:** pdftotext CLI (más rápido)
2. **Fallback:** pdf-parse (npm, siempre disponible)

## Almacenamiento

**Directorio de datos:** `data/documents/`

Cuando se usa `?save=true`:
```
data/documents/
├── 1716833981000_a1b2c3.json
├── 1716833982000_d4e5f6.json
└── ...
```

Formato de archivo:
```json
{
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "documentType": "pdf",
  "size": 524288,
  "processingTime": 342,
  "timestamp": "2026-05-27T04:49:41Z",
  "status": "success",
  "content": {
    "text": "...",
    "metadata": {...}
  },
  "error": null
}
```

## Tests

Ejecutar tests unitarios:
```bash
cd /Users/davidnows/sinkia-next
node --test server/tests/documentProcessor.test.js
```

O si está configurado en package.json:
```bash
npm test
```

## Arquitectura para Procesamiento Paralelo

El diseño soporta procesamiento paralelo futuro sin cambios en la API:

```javascript
// Uso actual (secuencial)
const result = await processDocument(buf, mime, name);

// Paralelo (futuro)
const results = await processDocumentsParallel([...], 10);
```

El pool de concurrency está implementado en `universalProcessor.js:processDocumentsParallel()`.

## Limites

- **Tamaño máximo:** 500 MB (validado en `universalProcessor.js`)
- **Timeout OCR:** 15 segundos por imagen
- **Buffer de texto:** 100 MB para pdf-parse
- **Filas de Excel:** Máximo 1000 filas en resultado

## Diagnóstico

Ver disponibilidad de procesadores:
```bash
curl http://localhost:3001/api/process/health \
  -H "x-admin-token: sinkia2026" | jq
```

Ver logs de procesamiento en la consola del servidor:
```
[PROCESS] Procesando: document.pdf
[PROCESS] Método: pdf-parse
[PROCESS] Tiempo: 342ms
```

## Próximas Mejoras

- [ ] Procesamiento verdaderamente paralelo con Workers
- [ ] Soporte para RTF, ODT
- [ ] Cachés de resultados
- [ ] Webhook para procesamiento asíncrono
- [ ] Integración con búsqueda vectorial (Qdrant)

---

**Autor:** SynK-IA Team  
**Última actualización:** 2026-05-27  
**Versión:** 1.0.0
