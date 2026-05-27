# Data Extraction API - Test Cases & Examples

## API Endpoints

### POST /api/extractions
Extrae campos de un documento de texto.

**Request:**
```bash
curl -X POST http://localhost:3001/api/extractions \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: sinkia2026" \
  -d '{
    "text": "TEXTO DEL DOCUMENTO",
    "documentPath": "/path/to/doc.pdf"
  }'
```

**Response:**
```json
{
  "ok": true,
  "extraction": {
    "id": "ext_1_abc123def",
    "documentPath": "/path/to/doc.pdf",
    "type": "factura",
    "typeConfidence": 0.9,
    "timestamp": "2024-05-27T12:34:56.789Z",
    "textLength": 2540,
    "extraction": {
      "type": "factura",
      "fields": {
        "numero": { "value": "INV-2024-001", "confidence": 0.85, "method": "regex" },
        "fecha": { "value": "01/01/2024", "confidence": 0.85, "method": "regex" },
        "total": { "value": "1500.00", "confidence": 0.85, "method": "regex" },
        ...
      }
    }
  }
}
```

### GET /api/extractions
Lista todas las extracciones (con filtro opcional).

```bash
# Todas
curl -H "X-Admin-Token: sinkia2026" http://localhost:3001/api/extractions

# Solo facturas
curl -H "X-Admin-Token: sinkia2026" http://localhost:3001/api/extractions?type=factura
```

### GET /api/extractions/:id
Obtiene detalle de una extracción.

```bash
curl -H "X-Admin-Token: sinkia2026" http://localhost:3001/api/extractions/ext_1_abc123def
```

### DELETE /api/extractions/:id
Elimina una extracción.

```bash
curl -X DELETE -H "X-Admin-Token: sinkia2026" http://localhost:3001/api/extractions/ext_1_abc123def
```

### GET /api/extractions/export/json
Exporta extracciones en JSON.

```bash
curl -H "X-Admin-Token: sinkia2026" http://localhost:3001/api/extractions/export/json > extractions.json
curl -H "X-Admin-Token: sinkia2026" "http://localhost:3001/api/extractions/export/json?type=factura" > facturas.json
```

### GET /api/extractions/export/csv
Exporta extracciones en CSV.

```bash
curl -H "X-Admin-Token: sinkia2026" http://localhost:3001/api/extractions/export/csv > extractions.csv
```

---

## Test Cases by Document Type

### 1. FACTURA

**Test Input:**
```
Factura número INV-2024-001
Fecha: 15/03/2024
Emisor: Acme Corporation S.L.
NIF: ES12345678A
Total: 2500.50€
IVA: 525.11€
Base Imponible: 1975.39€

Conceptos:
1 x Servicio consultoría: 1000.00€
2 x Licencia software: 487.70€
1 x Soporte técnico: 487.69€
```

**Expected Output:**
```json
{
  "type": "factura",
  "typeConfidence": 0.95,
  "fields": {
    "numero": {
      "value": "INV-2024-001",
      "confidence": 0.85,
      "method": "regex"
    },
    "fecha": {
      "value": "15/03/2024",
      "confidence": 0.85,
      "method": "regex"
    },
    "proveedor": {
      "value": "Acme Corporation S.L.",
      "confidence": 0.85,
      "method": "regex"
    },
    "nif": {
      "value": "ES12345678A",
      "confidence": 0.85,
      "method": "regex"
    },
    "total": {
      "value": "2500.50",
      "confidence": 0.85,
      "method": "regex"
    },
    "iva": {
      "value": "525.11",
      "confidence": 0.85,
      "method": "regex"
    },
    "base_imponible": {
      "value": null,
      "confidence": 0,
      "method": "none"
    },
    "items": {
      "value": ["Servicio consultoría", "Licencia software", "Soporte técnico"],
      "confidence": 0.75,
      "method": "regex"
    },
    "cantidades": {
      "value": ["1", "2", "1"],
      "confidence": 0.75,
      "method": "regex"
    },
    "precios": {
      "value": ["1000.00", "487.70", "487.69"],
      "confidence": 0.75,
      "method": "regex"
    }
  }
}
```

**Curl Test:**
```bash
curl -X POST http://localhost:3001/api/extractions \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: sinkia2026" \
  -d '{
    "text": "Factura número INV-2024-001\nFecha: 15/03/2024\nEmisor: Acme Corporation S.L.\nNIF: ES12345678A\nTotal: 2500.50€\nIVA: 525.11€\n\n1 x Servicio consultoría: 1000.00€\n2 x Licencia software: 487.70€\n1 x Soporte técnico: 487.69€"
  }'
```

---

### 2. CONTRATO

**Test Input:**
```
CONTRATO DE SERVICIOS PROFESIONALES

PARTES:
Por una parte, ABC Consulting S.L.
Por otra parte, XYZ Corporation Inc.

VIGENCIA:
Fecha de inicio: 01/06/2024
Fecha de fin: 31/05/2025

MONTO:
Cantidad total del contrato: 50000€

CONDICIONES CLAVE:
Plazo de ejecución: 12 meses
Confidencialidad: Obligatoria
```

**Expected Output:**
```json
{
  "type": "contrato",
  "typeConfidence": 0.95,
  "fields": {
    "partes": {
      "value": ["ABC Consulting S.L.", "XYZ Corporation Inc."],
      "confidence": 0.65,
      "method": "heuristic"
    },
    "fecha_inicio": {
      "value": "01/06/2024",
      "confidence": 0.85,
      "method": "regex"
    },
    "fecha_fin": {
      "value": "31/05/2025",
      "confidence": 0.85,
      "method": "regex"
    },
    "monto": {
      "value": "50000",
      "confidence": 0.85,
      "method": "regex"
    },
    "duracion": {
      "value": "12 meses",
      "confidence": 0.65,
      "method": "heuristic"
    },
    "condiciones_clave": {
      "value": ["Plazo de ejecución: 12 meses"],
      "confidence": 0.65,
      "method": "heuristic"
    }
  }
}
```

**Curl Test:**
```bash
curl -X POST http://localhost:3001/api/extractions \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: sinkia2026" \
  -d '{
    "text": "CONTRATO DE SERVICIOS PROFESIONALES\n\nPARTES:\nPor una parte, ABC Consulting S.L.\nPor otra parte, XYZ Corporation Inc.\n\nVIGENCIA:\nFecha de inicio: 01/06/2024\nFecha de fin: 31/05/2025\n\nMONTO:\nCantidad total del contrato: 50000€"
  }'
```

---

### 3. PURCHASE ORDER (PO)

**Test Input:**
```
PURCHASE ORDER

PO Number: PO-2024-0042
Date: 20/04/2024
Supplier: Global Tech Supplies Ltd.

Items:
1 x Server Hardware - 2000.00€
5 x Network License - 250.00€ each = 1250.00€
10 x Support Package - 150.00€ each = 1500.00€

Total: 4750.00€
```

**Expected Output:**
```json
{
  "type": "po",
  "typeConfidence": 0.95,
  "fields": {
    "numero": {
      "value": "PO-2024-0042",
      "confidence": 0.85,
      "method": "regex"
    },
    "proveedor": {
      "value": "Global Tech Supplies Ltd.",
      "confidence": 0.85,
      "method": "regex"
    },
    "items": {
      "value": ["Server Hardware", "Network License", "Support Package"],
      "confidence": 0.75,
      "method": "regex"
    },
    "cantidades": {
      "value": ["1", "5", "10"],
      "confidence": 0.75,
      "method": "regex"
    },
    "precios": {
      "value": ["2000.00", "250.00", "150.00"],
      "confidence": 0.75,
      "method": "regex"
    },
    "total": {
      "value": "4750.00",
      "confidence": 0.85,
      "method": "regex"
    }
  }
}
```

**Curl Test:**
```bash
curl -X POST http://localhost:3001/api/extractions \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: sinkia2026" \
  -d '{
    "text": "PURCHASE ORDER\n\nPO Number: PO-2024-0042\nSupplier: Global Tech Supplies Ltd.\n\n1 x Server Hardware: 2000.00€\n5 x Network License: 250.00€\n10 x Support Package: 150.00€\n\nTotal: 4750.00€"
  }'
```

---

## Frontend Testing

### 1. Access the Page
```
http://localhost:3001/dataextraction
```

### 2. Manual Test Flow
1. Copy one of the test inputs above
2. Paste into the textarea
3. Click "🔍 Extraer"
4. Verify stats update
5. Click "Detalles" to see full extraction
6. Test "Copy" button for fields
7. Test "Eliminar" to delete extraction
8. Test filtering by type
9. Test JSON/CSV export

### 3. Automated Test with Playwright
```bash
# Install Playwright if not available
npm install -D @playwright/test

# Create test file
cat > tests/dataExtraction.spec.js << 'EOF'
import { test, expect } from '@playwright/test';

test('Data Extraction - Factura', async ({ page }) => {
  await page.goto('http://localhost:3001/dataextraction');
  
  // Fill textarea
  const testText = 'Factura número INV-2024-001...';
  await page.fill('textarea', testText);
  
  // Click extract
  await page.click('button:has-text("Extraer")');
  
  // Wait for result
  await page.waitForSelector('text=ext_');
  
  // Verify stats updated
  const stats = await page.textContent('[class*="stats"]');
  expect(stats).toContain('1');
});
EOF

# Run test
npx playwright test tests/dataExtraction.spec.js
```

---

## Expected Behavior

### Confidence Scores
- **Regex match**: 0.85 (direct pattern match)
- **Heuristic**: 0.65 (fuzzy match or context-based)
- **No match**: 0 (field empty)

### Type Detection Confidence
- **Explicit keyword match** (e.g., "Factura"): 0.9
- **Heuristic inference** (e.g., has "total" + "proveedor"): 0.65-0.70
- **Unknown type**: 0

### Ollama Enrichment
- Automatic if available
- Silent fallback if Ollama not running
- Adds `ollama_enrichment` key to response
- Does NOT affect confidence scores (regex is source of truth)

---

## Debugging

### Check API is loaded
```bash
curl -H "X-Admin-Token: sinkia2026" http://localhost:3001/api/extractions
```

### Check server logs
```bash
grep "Data Extraction API" /tmp/server.log
```

### Verify data persistence
```bash
cat /Users/davidnows/sinkia-next/data/extractions.json | jq .
```

### Test with Ollama
```bash
# Check if Ollama running
ollama list

# Test Ollama integration
curl -X POST http://localhost:3001/api/extractions \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: sinkia2026" \
  -d '{"text": "Complex contract document..."}'
# Check if response includes "ollama_enrichment" key
```

---

## Next Steps

1. **Add more regex patterns** for specific formats (e.g., Spanish IBAN extraction)
2. **Custom field mappings** for different document templates
3. **Batch extraction** endpoint for multiple documents
4. **OCR integration** for scanned PDFs (Tesseract)
5. **Machine learning** model for field entity recognition
6. **Database backend** instead of JSON file (optional)
7. **Webhooks** for downstream integration

---

## Notes

- All timestamps are ISO 8601 format
- Confidence scores range from 0 to 1
- Array fields preserve order for multi-line items
- Export formats include all fields (populated or empty)
- Admin authentication required for all endpoints
- No file upload needed - text input only for this version
