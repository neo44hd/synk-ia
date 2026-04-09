// ═══════════════════════════════════════════════════════════════════════════
//  SINKIA — Motor de procesamiento de documentos
//  Pipeline: Extracción → IA → Entidades → Almacenamiento
// ═══════════════════════════════════════════════════════════════════════════
import pdfParse      from 'pdf-parse';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path          from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────
const LITELLM_URL = process.env.LITELLM_URL      || 'http://localhost:8082';
const LLM_MODEL   = process.env.LOCAL_LLM_MODEL  || 'medina-qwen3-14b-openclaw';
const DATA_DIR    = process.env.DATA_DIR          || '/Users/davidnows/sinkia/data';
const DOCS_FILE   = path.join(DATA_DIR, 'documents.json');
const ENTITIES_FILE = path.join(DATA_DIR, 'entities.json');

// Caracteres máximos de texto que enviamos al LLM
// (ajustar cuando n_ctx sea 32768 en LM Studio → subir a 12000)
const MAX_TEXT_CHARS = 3500;

// ── Utilidades de base de datos JSON ──────────────────────────────────────
async function loadJSON(file, defaultVal) {
  try {
    if (!existsSync(file)) return defaultVal;
    return JSON.parse(await readFile(file, 'utf8'));
  } catch { return defaultVal; }
}

async function saveJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── PASO 1: Extracción de texto ────────────────────────────────────────────
export async function extractText(filePath, mimeType = '') {
  const ext = path.extname(filePath).toLowerCase();

  // PDF con texto embebido
  if (mimeType.includes('pdf') || ext === '.pdf') {
    try {
      const buf    = await readFile(filePath);
      const parsed = await pdfParse(buf, { max: 10 }); // máx 10 páginas
      const text   = (parsed.text || '').trim();
      if (text.length > 80) {
        return { text, method: 'pdf-text', pages: parsed.numpages, ok: true };
      }
      // PDF escaneado (sin texto)
      return {
        text: '',
        method: 'pdf-escaneado',
        pages: parsed.numpages,
        ok: false,
        hint: 'PDF escaneado — para OCR instala: brew install tesseract',
      };
    } catch (e) {
      throw new Error(`PDF parse error: ${e.message}`);
    }
  }

  // Texto plano
  if (mimeType.includes('text') || ['.txt', '.csv'].includes(ext)) {
    const text = await readFile(filePath, 'utf8');
    return { text, method: 'text', ok: true };
  }

  // DOCX — leemos XML interno sin dependencias extra
  if (mimeType.includes('wordprocessingml') || ext === '.docx') {
    try {
      const AdmZip = (await import('adm-zip')).default;
      const zip    = new AdmZip(filePath);
      const entry  = zip.getEntry('word/document.xml');
      if (entry) {
        const xml  = entry.getData().toString('utf8');
        const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return { text, method: 'docx', ok: true };
      }
    } catch {}
  }

  // Imagen (JPG, PNG, WEBP) — OCR con Tesseract si está instalado
  if (mimeType.startsWith('image/') || ['.jpg','.jpeg','.png','.webp','.tiff'].includes(ext)) {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync  = promisify(execFile);
      const { stdout } = await execFileAsync('tesseract', [filePath, 'stdout', '-l', 'spa+eng'], { timeout: 60000 });
      if (stdout.trim().length > 20) return { text: stdout.trim(), method: 'tesseract-ocr', ok: true };
    } catch (e) {
      const notInstalled = e.code === 'ENOENT' || e.message?.includes('not found');
      return {
        text: '',
        method: 'ocr-fallido',
        ok: false,
        hint: notInstalled
          ? 'Tesseract no instalado. Ejecuta: brew install tesseract tesseract-lang'
          : `OCR error: ${e.message}`,
      };
    }
  }

  // Formato no soportado
  return {
    text: '',
    method: 'no-soportado',
    ok: false,
    hint: `Formato ${mimeType || ext} no soportado aún. Válidos: PDF, imagen (JPG/PNG), TXT, DOCX.`,
  };
}

// ── PASO 2: Análisis con IA ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un experto contable y clasificador de documentos empresariales españoles.
Analizas documentos y devuelves EXCLUSIVAMENTE JSON válido. Nunca añadas explicaciones, markdown ni texto fuera del JSON.

TIPOS DE DOCUMENTO (usa exactamente uno):
factura_recibida | factura_emitida | albaran | presupuesto | contrato | nomina | extracto_bancario | pedido | ticket | email_comercial | otro

REGLAS:
- Si no encuentras un campo, usa null (nunca string vacío)
- Los números siempre como float (21.0, no "21")
- Las fechas en formato YYYY-MM-DD
- El campo "confianza" indica del 0 al 1 qué tan seguro estás de la clasificación`;

function buildPrompt(text) {
  const truncated = text.length > MAX_TEXT_CHARS
    ? text.slice(0, MAX_TEXT_CHARS) + '\n[... texto truncado ...]'
    : text;

  return `Analiza este documento y devuelve JSON con esta estructura exacta:

--- DOCUMENTO ---
${truncated}
--- FIN ---

JSON (sin markdown, sin explicaciones, solo el objeto):
{
  "tipo": "factura_recibida",
  "confianza": 0.95,
  "numero_documento": null,
  "fecha": null,
  "fecha_vencimiento": null,
  "emisor": {
    "nombre": null,
    "cif_nif": null,
    "direccion": null,
    "email": null,
    "telefono": null
  },
  "receptor": {
    "nombre": null,
    "cif_nif": null,
    "direccion": null,
    "email": null,
    "telefono": null
  },
  "lineas": [
    {
      "descripcion": "descripción del producto/servicio",
      "cantidad": 1.0,
      "precio_unitario": 0.0,
      "iva_porcentaje": 21.0,
      "total_linea": 0.0
    }
  ],
  "base_imponible": 0.0,
  "iva_total": 0.0,
  "total": 0.0,
  "moneda": "EUR",
  "forma_pago": null,
  "notas": null,
  "accion_recomendada": "registrar_gasto",
  "resumen": "Descripción breve de 1-2 frases del documento"
}`;
}

async function callLLM(text) {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        model:       LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: buildPrompt(text) },
        ],
        temperature: 0.05,   // Muy baja para máxima precisión
        max_tokens:  1800,
        stream:      false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
    }

    const data    = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extraer JSON del response (por si el modelo añade texto extra)
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`LLM no devolvió JSON válido. Respuesta: ${content.slice(0, 300)}`);

    return JSON.parse(match[0]);
  } finally {
    clearTimeout(timeout);
  }
}

// ── PASO 3: Resolución de entidades ───────────────────────────────────────
function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function isSameEntity(a, b) {
  if (a.cif_nif && b.cif_nif && a.cif_nif === b.cif_nif) return true;
  if (a.nombre   && b.nombre   && normalize(a.nombre) === normalize(b.nombre)) return true;
  return false;
}

async function resolveEntities(analysis) {
  const entities = await loadJSON(ENTITIES_FILE, { clientes: [], proveedores: [] });
  const result   = { ...analysis, entidades_creadas: [] };

  const TIPOS_PROVEEDOR = ['factura_recibida', 'albaran', 'pedido'];
  const TIPOS_CLIENTE   = ['factura_emitida',  'presupuesto'];

  // Emisor → proveedor
  if (analysis.emisor?.nombre && TIPOS_PROVEEDOR.includes(analysis.tipo)) {
    const existing = entities.proveedores.find(p => isSameEntity(p, analysis.emisor));
    if (existing) {
      result.proveedor_id    = existing.id;
      result.proveedor_nuevo = false;
      // Actualizar datos si hay nuevos
      Object.assign(existing, { ...analysis.emisor, id: existing.id });
    } else {
      const nuevo = { id: `prov_${Date.now()}`, ...analysis.emisor, creado: new Date().toISOString() };
      entities.proveedores.push(nuevo);
      result.proveedor_id    = nuevo.id;
      result.proveedor_nuevo = true;
      result.entidades_creadas.push({ tipo: 'proveedor', nombre: nuevo.nombre });
    }
  }

  // Receptor → cliente
  if (analysis.receptor?.nombre && TIPOS_CLIENTE.includes(analysis.tipo)) {
    const existing = entities.clientes.find(c => isSameEntity(c, analysis.receptor));
    if (existing) {
      result.cliente_id    = existing.id;
      result.cliente_nuevo = false;
      Object.assign(existing, { ...analysis.receptor, id: existing.id });
    } else {
      const nuevo = { id: `cli_${Date.now()}`, ...analysis.receptor, creado: new Date().toISOString() };
      entities.clientes.push(nuevo);
      result.cliente_id    = nuevo.id;
      result.cliente_nuevo = true;
      result.entidades_creadas.push({ tipo: 'cliente', nombre: nuevo.nombre });
    }
  }

  await saveJSON(ENTITIES_FILE, entities);
  return result;
}

// ── PIPELINE PRINCIPAL ─────────────────────────────────────────────────────
export async function processDocument(filePath, mimeType, originalName) {
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const started = Date.now();

  // 1. Extraer texto
  const extracted = await extractText(filePath, mimeType);
  if (!extracted.ok) {
    throw new Error(extracted.hint || 'No se pudo extraer texto del documento');
  }

  // 2. Analizar con IA
  const analysis = await callLLM(extracted.text);

  // 3. Resolver entidades
  const enriched = await resolveEntities(analysis);

  // 4. Guardar registro
  const record = {
    id,
    nombre_archivo:     originalName,
    mime_type:          mimeType,
    procesado:          new Date().toISOString(),
    tiempo_ms:          Date.now() - started,
    metodo_extraccion:  extracted.method,
    paginas:            extracted.pages || 1,
    chars_extraidos:    extracted.text.length,
    texto_preview:      extracted.text.slice(0, 600),
    analisis:           enriched,
    estado:             'procesado',
  };

  const docs = await loadJSON(DOCS_FILE, []);
  docs.unshift(record);
  await saveJSON(DOCS_FILE, docs.slice(0, 1000));

  console.log(`[DOCS] ✓ ${originalName} → ${enriched.tipo} (${record.tiempo_ms}ms)`);
  return record;
}

// ── Lectura de datos ───────────────────────────────────────────────────────
export const getDocuments  = ()        => loadJSON(DOCS_FILE,    []);
export const getEntities   = ()        => loadJSON(ENTITIES_FILE, { clientes: [], proveedores: [] });
export const getDocument   = async id  => {
  const docs = await loadJSON(DOCS_FILE, []);
  return docs.find(d => d.id === id) || null;
};

export async function deleteDocument(id) {
  const docs    = await loadJSON(DOCS_FILE, []);
  const updated = docs.filter(d => d.id !== id);
  await saveJSON(DOCS_FILE, updated);
  return updated.length < docs.length;
}

// ── Estadísticas ───────────────────────────────────────────────────────────
export async function getStats() {
  const [docs, entities] = await Promise.all([getDocuments(), getEntities()]);
  const byTipo = docs.reduce((acc, d) => {
    const t = d.analisis?.tipo || 'otro';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  return {
    total_documentos:  docs.length,
    total_clientes:    entities.clientes.length,
    total_proveedores: entities.proveedores.length,
    por_tipo:          byTipo,
    ultimo_proceso:    docs[0]?.procesado || null,
  };
}
