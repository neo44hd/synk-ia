// ═══════════════════════════════════════════════════════════════════════════
//  SINKIA — Motor de procesamiento de documentos v2
//  Arquitectura: Extracción → Limpieza → Clasificar → Extraer → Validar → Guardar
// ═══════════════════════════════════════════════════════════════════════════
import pdfParse       from 'pdf-parse';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync }  from 'fs';
import path            from 'path';
import { fileURLToPath } from 'url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────
const OLLAMA_URL = process.env.OLLAMA_URL      || 'http://localhost:11434';
const MODEL      = process.env.OLLAMA_MODEL    || 'qwen3:14b';
const DATA_DIR   = process.env.DATA_DIR        || '/Users/davidnows/sinkia/data';
const DOCS_FILE  = path.join(DATA_DIR, 'documents.json');
const ENT_FILE   = path.join(DATA_DIR, 'entities.json');

// ── Detección automática de modelo con capacidad visual ───────────────────
// Se activa si el nombre del modelo contiene 'vl', 'vision' o 'visual'
const IS_VL_MODEL = /vl|vision|visual/i.test(MODEL);
if (IS_VL_MODEL) console.log(`[DOCS] Modo visión activo — modelo VL detectado: ${MODEL}`);

// ══════════════════════════════════════════════════════════════════════════
//  PASO 1: EXTRACCIÓN DE TEXTO (cualquier formato)
// ══════════════════════════════════════════════════════════════════════════

export async function extractText(filePath, mimeType = '') {
  const ext = path.extname(filePath).toLowerCase();

  // ── PDF ───────────────────────────────────────────────────────────────
  if (mimeType.includes('pdf') || ext === '.pdf') {
    try {
      const buf    = await readFile(filePath);
      const parsed = await pdfParse(buf, { max: 15 });
      const text   = cleanText(parsed.text || '');

      if (text.length > 80) {
        return { text, method: 'pdf-text', pages: parsed.numpages, ok: true };
      }

      // PDF escaneado → intentar OCR con Tesseract
      const ocrResult = await ocrFile(filePath, 'pdf');
      if (ocrResult.ok) return { ...ocrResult, pages: parsed.numpages };

      return { text: '', method: 'pdf-escaneado', pages: parsed.numpages, ok: false,
        hint: 'PDF escaneado sin texto. Instala tesseract: brew install tesseract tesseract-lang' };
    } catch (e) {
      throw new Error(`Error leyendo PDF: ${e.message}`);
    }
  }

  // ── Imágenes (JPG, PNG, WEBP, TIFF) ──────────────────────────────────
  if (mimeType.startsWith('image/') || ['.jpg','.jpeg','.png','.webp','.tiff','.bmp'].includes(ext)) {
    // Con modelo VL: la imagen se procesa directamente sin OCR
    if (IS_VL_MODEL) return { text: '__VISION__', method: 'vision-vl', ok: true, filePath, mimeType };
    return ocrFile(filePath, 'image');
  }

  // ── DOCX ─────────────────────────────────────────────────────────────
  if (mimeType.includes('wordprocessingml') || ext === '.docx') {
    try {
      const { default: AdmZip } = await import('adm-zip');
      const zip   = new AdmZip(filePath);
      const entry = zip.getEntry('word/document.xml');
      if (entry) {
        const xml  = entry.getData().toString('utf8');
        const text = cleanText(xml.replace(/<[^>]+>/g, ' '));
        return { text, method: 'docx', ok: true };
      }
    } catch {}
  }

  // ── TXT / CSV ─────────────────────────────────────────────────────────
  if (mimeType.includes('text') || ['.txt', '.csv', '.tsv'].includes(ext)) {
    const text = cleanText(await readFile(filePath, 'utf8'));
    return { text, method: 'text', ok: true };
  }

  // ── EML / Email ───────────────────────────────────────────────────────
  if (mimeType.includes('message/rfc822') || ext === '.eml') {
    try {
      const raw   = await readFile(filePath, 'utf8');
      const text  = parseEml(raw);
      return { text, method: 'eml', ok: true };
    } catch {}
  }

  return {
    text: '', method: 'no-soportado', ok: false,
    hint: `Formato no soportado: ${mimeType || ext}. Válidos: PDF, JPG, PNG, DOCX, TXT, EML`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  OCR con Tesseract — detección automática + conversión PDF→imagen
//
//  Para Mac Mini M4 Pro:
//    brew install tesseract tesseract-lang
//    brew install poppler   (para pdftoppm — convierte PDF→PNG para OCR)
//
//  El pipeline para PDFs escaneados es:
//    PDF → pdftoppm (a PNG) → tesseract (OCR) → texto
//  Para imágenes directas:
//    imagen → tesseract (OCR) → texto
// ══════════════════════════════════════════════════════════════════════════

let _tesseractChecked = false;
let _tesseractAvailable = false;
let _pdftoppmAvailable = false;

async function checkOcrDeps() {
  if (_tesseractChecked) return;
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const exec = promisify(execFile);

  // Tesseract
  try {
    const { stdout } = await exec('tesseract', ['--version'], { timeout: 5000 });
    _tesseractAvailable = true;
    const version = stdout.split('\n')[0];
    console.log(`[OCR] ✓ Tesseract disponible: ${version}`);

    // Verificar idiomas instalados
    try {
      const { stdout: langs } = await exec('tesseract', ['--list-langs'], { timeout: 5000 });
      const hasSpa = langs.includes('spa');
      const hasEng = langs.includes('eng');
      if (!hasSpa) console.warn('[OCR] ⚠ Idioma español (spa) no instalado. Ejecuta: brew install tesseract-lang');
      if (!hasEng) console.warn('[OCR] ⚠ Idioma inglés (eng) no instalado');
      console.log(`[OCR]   Idiomas: spa=${hasSpa ? '✓' : '✗'} eng=${hasEng ? '✓' : '✗'}`);
    } catch {}
  } catch (e) {
    _tesseractAvailable = false;
    console.error('[OCR] ✗ Tesseract NO disponible. PDFs escaneados no se podrán procesar.');
    console.error('[OCR]   Instalar: brew install tesseract tesseract-lang');
  }

  // pdftoppm (de poppler — para convertir PDF escaneado → imagen → OCR)
  try {
    await exec('pdftoppm', ['-v'], { timeout: 5000 });
    _pdftoppmAvailable = true;
    console.log('[OCR] ✓ pdftoppm disponible (poppler)');
  } catch {
    _pdftoppmAvailable = false;
    console.warn('[OCR] ⚠ pdftoppm no disponible. PDFs escaneados usarán modo directo.');
    console.warn('[OCR]   Para mejor OCR en PDFs: brew install poppler');
  }

  _tesseractChecked = true;
}

async function ocrFile(filePath, type) {
  await checkOcrDeps();

  if (!_tesseractAvailable) {
    return {
      text: '', method: 'ocr-no-instalado', ok: false,
      hint: 'Tesseract no instalado. Ejecuta:\n  brew install tesseract tesseract-lang\n  brew install poppler',
    };
  }

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const exec = promisify(execFile);

  try {
    // Detectar idiomas disponibles
    let lang = 'eng';
    try {
      const { stdout: langs } = await exec('tesseract', ['--list-langs'], { timeout: 3000 });
      if (langs.includes('spa') && langs.includes('eng')) lang = 'spa+eng';
      else if (langs.includes('spa')) lang = 'spa';
    } catch {}

    // ── PDF escaneado ─────────────────────────────────────────────────
    if (type === 'pdf') {
      // Método 1: pdftoppm → convertir cada página a PNG → OCR
      if (_pdftoppmAvailable) {
        return await ocrPdfViaImages(filePath, lang, exec);
      }
      // Método 2: tesseract directo sobre PDF (menos fiable)
      try {
        const { stdout } = await exec('tesseract', [filePath, 'stdout', '-l', lang, '--dpi', '300', '--psm', '1'], { timeout: 120_000 });
        const text = cleanText(stdout);
        if (text.length > 20) return { text, method: 'tesseract-pdf-directo', ok: true };
      } catch (e) {
        console.warn(`[OCR] tesseract directo en PDF falló: ${e.message}`);
      }
      return { text: '', method: 'ocr-pdf-fallido', ok: false, hint: 'Instala poppler para OCR de PDFs: brew install poppler' };
    }

    // ── Imagen directa ────────────────────────────────────────────────
    const { stdout } = await exec('tesseract', [filePath, 'stdout', '-l', lang, '--dpi', '300', '--psm', '3'], { timeout: 90_000 });
    const text = cleanText(stdout);
    if (text.length > 20) return { text, method: 'tesseract-ocr', ok: true };
    return { text: '', method: 'ocr-sin-texto', ok: false, hint: 'OCR no encontró texto legible en la imagen' };

  } catch (e) {
    return {
      text: '', method: 'ocr-error', ok: false,
      hint: `OCR error: ${e.message}`,
    };
  }
}

// PDF → imagen por página → OCR → unir texto
async function ocrPdfViaImages(pdfPath, lang, exec) {
  const tmpDir = path.join(path.dirname(pdfPath), '_ocr_tmp_' + Date.now());
  try {
    await mkdir(tmpDir, { recursive: true });
    const prefix = path.join(tmpDir, 'page');

    // Convertir PDF a PNGs (máx 10 páginas, 300 DPI)
    await exec('pdftoppm', ['-png', '-r', '300', '-l', '10', pdfPath, prefix], { timeout: 60_000 });

    // Buscar imágenes generadas
    const { readdir } = await import('fs/promises');
    const files = (await readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();

    if (files.length === 0) {
      return { text: '', method: 'ocr-pdf-sin-paginas', ok: false, hint: 'pdftoppm no generó imágenes del PDF' };
    }

    // OCR cada página
    const pageTexts = [];
    for (const file of files) {
      try {
        const imgPath = path.join(tmpDir, file);
        const { stdout } = await exec('tesseract', [imgPath, 'stdout', '-l', lang, '--dpi', '300', '--psm', '1'], { timeout: 60_000 });
        const text = cleanText(stdout);
        if (text.length > 5) pageTexts.push(text);
      } catch {}
    }

    // Limpiar temporales
    for (const file of files) {
      try { const { unlink } = await import('fs/promises'); await unlink(path.join(tmpDir, file)); } catch {}
    }
    try { const { rmdir } = await import('fs/promises'); await rmdir(tmpDir); } catch {}

    const fullText = pageTexts.join('\n\n--- Página ---\n\n');
    if (fullText.length > 20) {
      console.log(`[OCR] ✓ PDF escaneado: ${files.length} páginas, ${fullText.length} chars extraídos`);
      return { text: fullText, method: 'tesseract-pdf-via-images', ok: true, pages: files.length };
    }
    return { text: '', method: 'ocr-pdf-sin-texto', ok: false, hint: 'OCR no encontró texto legible en el PDF escaneado' };
  } catch (e) {
    // Limpiar en caso de error
    try { const { rm } = await import('fs/promises'); await rm(tmpDir, { recursive: true }); } catch {}
    return { text: '', method: 'ocr-pdf-error', ok: false, hint: `Error OCR PDF: ${e.message}` };
  }
}

// Parser básico de EML
function parseEml(raw) {
  const lines = raw.split('\n');
  const headers = {};
  let bodyStart = false, body = [];
  for (const line of lines) {
    if (!bodyStart && line.trim() === '') { bodyStart = true; continue; }
    if (!bodyStart) {
      const m = line.match(/^([^:]+):\s*(.+)/);
      if (m) headers[m[1].toLowerCase()] = m[2].trim();
    } else {
      body.push(line);
    }
  }
  return `De: ${headers.from || ''}\nPara: ${headers.to || ''}\nAsunto: ${headers.subject || ''}\n\n${body.join('\n')}`;
}

// ── Limpieza de texto ──────────────────────────────────────────────────────
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{3,}/g, '  ')          // reducir espacios excesivos
    .replace(/\n{4,}/g, '\n\n\n')       // máx 3 saltos de línea seguidos
    .replace(/[^\S\n]{2,}/g, ' ')       // espacios múltiples en la misma línea
    .trim();
}

// ── Truncado inteligente ───────────────────────────────────────────────────
// Para documentos largos: mantiene cabecera + pie (donde van los totales)
// y un resumen del centro. Así caben en 4096 tokens.
function smartTruncate(text, maxChars = 6000) {
  if (text.length <= maxChars) return text;

  const head = text.slice(0, Math.floor(maxChars * 0.6));   // 60% inicio
  const tail = text.slice(-Math.floor(maxChars * 0.35));    // 35% final
  return `${head}\n\n[...documento truncado...]\n\n${tail}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  VISIÓN — Helpers para modelos VL (imagen → base64 → LLM)
// ══════════════════════════════════════════════════════════════════════════

// Convierte cualquier imagen a base64 con MIME correcto
async function loadImageAsBase64(filePath, mimeType) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = mimeType?.startsWith('image/') ? mimeType
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.png'  ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : ext === '.bmp'  ? 'image/bmp'
    : 'image/jpeg';
  const buf    = await readFile(filePath);
  const base64 = buf.toString('base64');
  return { base64, mime, url: `data:${mime};base64,${base64}` };
}

// Llamada LLM con contenido multimodal (texto + imagen)
async function llmCallVision(messages, maxTokens = 1600, temp = 0.05) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 240_000); // 4 min (VL es más lento)
  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({ model: MODEL, messages, temperature: temp, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama-VL ${res.status}: ${await res.text().catch(() => '')}`);
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

// Clasificar imagen directamente con el modelo VL
async function classifyVision(imgData) {
  const raw = await llmCallVision([
    { role: 'system', content: CLASSIFY_SYSTEM },
    { role: 'user', content: [
      { type: 'text', text: 'Clasifica este documento:' },
      { type: 'image_url', image_url: { url: imgData.url } },
    ]},
  ], 30, 0.0);
  const tipos = ['factura_recibida','factura_emitida','albaran','presupuesto',
    'contrato','nomina','extracto_bancario','pedido','ticket','email_comercial','otro'];
  return tipos.find(t => raw.toLowerCase().includes(t)) || 'otro';
}

// Extraer datos estructurados de imagen con el modelo VL
async function extractVision(imgData, tipo) {
  const instructions = TYPE_INSTRUCTIONS[tipo] || TYPE_INSTRUCTIONS.otro;
  const raw = await llmCallVision([
    { role: 'system', content: EXTRACT_SYSTEM },
    { role: 'user', content: [
      { type: 'text', text:
          `TIPO DE DOCUMENTO: ${tipo}\n${instructions}\n\n` +
          `Analiza la imagen de este documento y devuelve EXACTAMENTE este JSON relleno:\n${BASE_SCHEMA}` },
      { type: 'image_url', image_url: { url: imgData.url } },
    ]},
  ], 1600, 0.05);
  return parseJSON(raw);
}

// ══════════════════════════════════════════════════════════════════════════
//  PASO 2: CLASIFICACIÓN (pasada rápida, 30 tokens de respuesta)
// ══════════════════════════════════════════════════════════════════════════

const CLASSIFY_SYSTEM = `Clasifica este documento empresarial español.
Responde SOLO con una de estas palabras exactas, nada más:
factura_recibida
factura_emitida
albaran
presupuesto
contrato
nomina
extracto_bancario
pedido
ticket
email_comercial
otro`;

async function classify(text) {
  const preview = text.slice(0, 800); // Solo el inicio para clasificar rápido
  const res = await llmCall([
    { role: 'system', content: CLASSIFY_SYSTEM },
    { role: 'user',   content: preview },
  ], 30, 0.0);

  const tipos = ['factura_recibida','factura_emitida','albaran','presupuesto',
    'contrato','nomina','extracto_bancario','pedido','ticket','email_comercial','otro'];
  const found = tipos.find(t => res.toLowerCase().includes(t));
  return found || 'otro';
}

// ══════════════════════════════════════════════════════════════════════════
//  PASO 3: EXTRACCIÓN (prompt específico por tipo)
// ══════════════════════════════════════════════════════════════════════════

// Esquema JSON base (común a todos los tipos)
const BASE_SCHEMA = `{
  "numero_documento": null,
  "fecha": null,
  "fecha_vencimiento": null,
  "emisor": { "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null },
  "receptor": { "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null },
  "lineas": [{ "descripcion": null, "cantidad": 1.0, "precio_unitario": 0.0, "iva_porcentaje": 21.0, "total_linea": 0.0 }],
  "base_imponible": null,
  "iva_total": null,
  "total": null,
  "moneda": "EUR",
  "forma_pago": null,
  "notas": null,
  "confianza": 0.9,
  "resumen": null,
  "accion_recomendada": null
}`;

// Instrucciones específicas por tipo de documento
const TYPE_INSTRUCTIONS = {
  factura_recibida: `Es una FACTURA RECIBIDA (proveedor → empresa).
- emisor = el PROVEEDOR que emite la factura
- receptor = TU EMPRESA que recibe la factura
- accion_recomendada = "registrar_gasto"
- Extrae TODAS las líneas de producto/servicio con precio e IVA
- El número suele aparecer como "Nº Factura", "Factura nº", "Invoice"`,

  factura_emitida: `Es una FACTURA EMITIDA (empresa → cliente).
- emisor = TU EMPRESA que emite la factura
- receptor = el CLIENTE que paga
- accion_recomendada = "registrar_ingreso"
- Extrae todas las líneas y los importes con precisión`,

  albaran: `Es un ALBARÁN / NOTA DE ENTREGA.
- emisor = quien entrega la mercancía
- receptor = quien la recibe
- accion_recomendada = "actualizar_stock"
- Las líneas contienen artículos y cantidades (el precio puede ser 0)`,

  presupuesto: `Es un PRESUPUESTO / OFERTA COMERCIAL.
- emisor = empresa que hace el presupuesto
- receptor = cliente potencial
- accion_recomendada = "crear_cliente"
- Extrae las líneas de la oferta con precios`,

  nomina: `Es una NÓMINA / HOJA DE SALARIO.
- emisor = empresa empleadora
- receptor = el EMPLEADO (nombre y apellidos, DNI/NIF en cif_nif)
- accion_recomendada = "registrar_gasto"
- total = salario neto (líquido a percibir). base_imponible = salario bruto
- Extrae SIEMPRE el campo "trabajador" con datos laborales:
  "trabajador": {
    "nss": "número Seguridad Social (formato XX/XXXXXXXX-XX)",
    "categoria_profesional": "categoría o grupo profesional",
    "antiguedad": "fecha antigüedad/alta en empresa (YYYY-MM-DD)",
    "tipo_contrato": "indefinido/temporal/etc",
    "grupo_cotizacion": "grupo de cotización"
  }
- Las líneas son conceptos salariales: salario base, complementos, horas extra, deducciones IRPF, SS trabajador, etc.
- Busca el NSS cerca de etiquetas como "Nº Afiliación", "N.A.F.", "Nº S.S.", "Núm. afiliación"`,

  extracto_bancario: `Es un EXTRACTO BANCARIO.
- Solo extrae: fecha, banco (emisor.nombre), número de cuenta, saldo final (total)
- Las líneas son los movimientos más relevantes
- accion_recomendada = "archivar"`,

  contrato: `Es un CONTRATO.
- emisor = primera parte firmante
- receptor = segunda parte firmante
- fecha = fecha de firma o inicio
- fecha_vencimiento = fecha de fin si existe
- accion_recomendada = "archivar"`,

  pedido: `Es un PEDIDO / ORDEN DE COMPRA.
- emisor = quien compra / hace el pedido
- receptor = proveedor que recibirá el pedido
- accion_recomendada = "registrar_gasto"`,

  ticket: `Es un TICKET DE CAJA o RECIBO.
- emisor = tienda / establecimiento
- receptor = puede ser null
- total = importe total pagado
- accion_recomendada = "registrar_gasto"`,

  email_comercial: `Es un EMAIL COMERCIAL.
- emisor = quien envía el email
- receptor = destinatario
- notas = resumen del contenido del email
- accion_recomendada = "archivar"`,

  otro: `Tipo de documento desconocido. Extrae lo que puedas.`,
};

const EXTRACT_SYSTEM = `Eres un experto contable español. Extraes datos de documentos con máxima precisión.
Responde EXCLUSIVAMENTE con JSON válido. Sin markdown. Sin explicaciones.
REGLAS:
- null para campos no encontrados (nunca string vacío)
- Números como float: 21.0 no "21"
- Fechas: YYYY-MM-DD
- Importes en euros con 2 decimales
- Si el CIF/NIF tiene letras, inclúyelas (B56908486, 12345678A)`;

async function extract(text, tipo) {
  const instructions = TYPE_INSTRUCTIONS[tipo] || TYPE_INSTRUCTIONS.otro;
  const truncated    = smartTruncate(text, 5500);

  const userPrompt = `TIPO DE DOCUMENTO: ${tipo}
${instructions}

TEXTO DEL DOCUMENTO:
${truncated}

Devuelve este JSON rellenado con los datos reales:
${BASE_SCHEMA}`;

  const raw = await llmCall([
    { role: 'system', content: EXTRACT_SYSTEM },
    { role: 'user',   content: userPrompt },
  ], 1600, 0.05);

  return parseJSON(raw);
}

// ══════════════════════════════════════════════════════════════════════════
//  PASO 4: VALIDACIÓN Y CORRECCIÓN
// ══════════════════════════════════════════════════════════════════════════

function validate(data, tipo) {
  const d = { ...data };

  // Corregir tipo
  d.tipo = tipo;

  // Limpiar null strings
  function cleanObj(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === '' || v === 'null' || v === 'undefined' || v === 'N/A' || v === '-') {
        result[k] = null;
      } else if (typeof v === 'object' && !Array.isArray(v)) {
        result[k] = cleanObj(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  Object.assign(d, cleanObj(d));

  // Validar/corregir fecha
  if (d.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) {
    const parsed = tryParseDate(d.fecha);
    d.fecha = parsed || null;
  }

  // Validar importes: si tenemos líneas pero no totales, calcular
  if (d.lineas?.length && !d.total) {
    const sum = d.lineas.reduce((s, l) => s + (parseFloat(l.total_linea) || 0), 0);
    if (sum > 0) {
      d.total = Math.round(sum * 100) / 100;
      d.base_imponible = d.base_imponible || Math.round(sum / 1.21 * 100) / 100;
      d.iva_total      = d.iva_total      || Math.round((sum - d.base_imponible) * 100) / 100;
    }
  }

  // Asegurar resumen
  if (!d.resumen) {
    const partes = [tipo.replace(/_/g,' ')];
    if (d.emisor?.nombre)   partes.push(`de ${d.emisor.nombre}`);
    if (d.receptor?.nombre) partes.push(`para ${d.receptor.nombre}`);
    if (d.total)            partes.push(`por ${d.total}€`);
    if (d.fecha)            partes.push(`(${d.fecha})`);
    d.resumen = partes.join(' ');
  }

  return d;
}

function tryParseDate(str) {
  if (!str) return null;
  // Formatos comunes en facturas españolas: DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD
  const patterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,  // DD/MM/YYYY
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,  // YYYY/MM/DD
    /(\d{2})\.(\d{2})\.(\d{4})/,            // DD.MM.YYYY
  ];
  for (const p of patterns) {
    const m = str.match(p);
    if (m) {
      // Detectar si es DD/MM/YYYY o YYYY/MM/DD
      const [, a, b, c] = m;
      if (parseInt(a) > 31) return `${a}-${b}-${c}`; // YYYY-MM-DD
      return `${c}-${b}-${a}`;                        // asume DD/MM/YYYY
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
//  PASO 5: RESOLUCIÓN DE ENTIDADES
// ══════════════════════════════════════════════════════════════════════════

function normName(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\-_]/g, ' ').replace(/\s+/g, ' ');
}

function sameEntity(a, b) {
  if (!a || !b) return false;
  if (a.cif_nif && b.cif_nif && a.cif_nif.replace(/\s/g,'') === b.cif_nif.replace(/\s/g,'')) return true;
  const na = normName(a.nombre), nb = normName(b.nombre);
  if (na.length > 3 && nb.length > 3) {
    // Exact match o uno contiene al otro
    if (na === nb) return true;
    if (na.length > 6 && nb.includes(na.slice(0, 6))) return true;
    if (nb.length > 6 && na.includes(nb.slice(0, 6))) return true;
  }
  return false;
}

async function resolveEntities(analysis) {
  const ents  = await loadJSON(ENT_FILE, { clientes: [], proveedores: [], trabajadores: [] });
  if (!ents.trabajadores) ents.trabajadores = [];
  const result = { ...analysis, entidades_creadas: [] };

  const PROVEEDOR_TIPOS = ['factura_recibida', 'albaran', 'pedido', 'ticket'];
  const CLIENTE_TIPOS   = ['factura_emitida',  'presupuesto'];

  // Emisor → proveedor
  if (analysis.emisor?.nombre && PROVEEDOR_TIPOS.includes(analysis.tipo)) {
    let prov = ents.proveedores.find(p => sameEntity(p, analysis.emisor));
    if (prov) {
      // Actualizar datos si son más completos
      if (analysis.emisor.email && !prov.email) prov.email = analysis.emisor.email;
      if (analysis.emisor.cif_nif && !prov.cif_nif) prov.cif_nif = analysis.emisor.cif_nif;
      result.proveedor_id    = prov.id;
      result.proveedor_nuevo = false;
    } else {
      prov = { id: `prov_${Date.now()}`, ...analysis.emisor, creado: new Date().toISOString(), facturas: 0 };
      ents.proveedores.push(prov);
      result.proveedor_id    = prov.id;
      result.proveedor_nuevo = true;
      result.entidades_creadas.push({ tipo: 'proveedor', nombre: prov.nombre, id: prov.id });
    }
    prov.facturas = (prov.facturas || 0) + 1;
    prov.ultima_factura = analysis.fecha || new Date().toISOString().slice(0, 10);
  }

  // Receptor → cliente
  if (analysis.receptor?.nombre && CLIENTE_TIPOS.includes(analysis.tipo)) {
    let cli = ents.clientes.find(c => sameEntity(c, analysis.receptor));
    if (cli) {
      if (analysis.receptor.email && !cli.email) cli.email = analysis.receptor.email;
      result.cliente_id    = cli.id;
      result.cliente_nuevo = false;
    } else {
      cli = { id: `cli_${Date.now()}`, ...analysis.receptor, creado: new Date().toISOString(), facturas: 0 };
      ents.clientes.push(cli);
      result.cliente_id    = cli.id;
      result.cliente_nuevo = true;
      result.entidades_creadas.push({ tipo: 'cliente', nombre: cli.nombre, id: cli.id });
    }
    cli.facturas = (cli.facturas || 0) + 1;
  }

  // Receptor + datos laborales → trabajador (solo nóminas)
  if (analysis.tipo === 'nomina' && analysis.receptor?.nombre) {
    const tData = analysis.trabajador || {};
    const dni   = analysis.receptor.cif_nif || null;
    const nss   = tData.nss || null;

    // Buscar por NSS, DNI o nombre
    let trab = ents.trabajadores.find(t => {
      if (nss && t.nss && t.nss === nss) return true;
      if (dni && t.dni && t.dni.replace(/\s/g,'') === dni.replace(/\s/g,'')) return true;
      return sameEntity(t, analysis.receptor);
    });

    if (trab) {
      // Actualizar datos si más completos
      if (dni && !trab.dni) trab.dni = dni;
      if (nss && !trab.nss) trab.nss = nss;
      if (tData.categoria_profesional && !trab.categoria_profesional) trab.categoria_profesional = tData.categoria_profesional;
      if (tData.antiguedad && !trab.fecha_alta) trab.fecha_alta = tData.antiguedad;
      if (tData.tipo_contrato && !trab.tipo_contrato) trab.tipo_contrato = tData.tipo_contrato;
      if (tData.grupo_cotizacion && !trab.grupo_cotizacion) trab.grupo_cotizacion = tData.grupo_cotizacion;
      if (analysis.base_imponible) trab.ultimo_salario_bruto = analysis.base_imponible;
      if (analysis.total) trab.ultimo_salario_neto = analysis.total;
      trab.nominas = (trab.nominas || 0) + 1;
      trab.ultima_nomina = analysis.fecha || new Date().toISOString().slice(0, 10);
      result.trabajador_id    = trab.id;
      result.trabajador_nuevo = false;
    } else {
      // Separar nombre y apellidos del receptor
      const partes = (analysis.receptor.nombre || '').trim().split(/\s+/);
      const nombre    = partes[0] || 'Sin nombre';
      const apellidos = partes.slice(1).join(' ');

      trab = {
        id:                      `trab_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        nombre,
        apellidos,
        nombre_completo:         analysis.receptor.nombre,
        dni:                     dni,
        nss:                     nss,
        categoria_profesional:   tData.categoria_profesional || null,
        fecha_alta:              tData.antiguedad || null,
        tipo_contrato:           tData.tipo_contrato || null,
        grupo_cotizacion:        tData.grupo_cotizacion || null,
        ultimo_salario_bruto:    analysis.base_imponible || null,
        ultimo_salario_neto:     analysis.total || null,
        activo:                  true,
        nominas:                 1,
        ultima_nomina:           analysis.fecha || new Date().toISOString().slice(0, 10),
        creado:                  new Date().toISOString(),
      };
      ents.trabajadores.push(trab);
      result.trabajador_id    = trab.id;
      result.trabajador_nuevo = true;
      result.entidades_creadas.push({ tipo: 'trabajador', nombre: trab.nombre_completo, id: trab.id });
      console.log(`[DOCS] + Trabajador: ${trab.nombre_completo} (NSS: ${nss || 'n/a'}, DNI: ${dni || 'n/a'})`);
    }
  }

  await saveJSON(ENT_FILE, ents);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════
//  PIPELINE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════

export async function processDocument(filePath, mimeType, originalName) {
  const id  = `doc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const t0  = Date.now();
  const ext = path.extname(filePath).toLowerCase();
  const isImageFile = mimeType?.startsWith('image/') ||
    ['.jpg','.jpeg','.png','.webp','.tiff','.bmp'].includes(ext);

  console.log(`[DOCS] → Procesando: ${originalName} [${IS_VL_MODEL && isImageFile ? 'VISIÓN' : 'TEXTO'}]`);

  let tipo, raw, extracted;

  // ── PIPELINE VISIÓN: imagen + modelo VL → análisis directo ─────────────
  if (isImageFile && IS_VL_MODEL) {
    console.log(`[DOCS]   Cargando imagen para VL...`);
    const imgData = await loadImageAsBase64(filePath, mimeType);

    // Clasificar viendo la imagen
    tipo = await classifyVision(imgData);
    console.log(`[DOCS]   Tipo (visión): ${tipo}`);

    // Extraer datos viendo la imagen
    raw = await extractVision(imgData, tipo);
    extracted = {
      text: '[procesado por visión directa]',
      method: 'vision-vl',
      ok: true,
      pages: 1,
    };

  // ── PIPELINE TEXTO: extraer texto → clasificar → extraer ───────────────
  } else {
    extracted = await extractText(filePath, mimeType);
    if (!extracted.ok) throw new Error(extracted.hint || 'No se pudo extraer texto');
    console.log(`[DOCS]   Extracción: ${extracted.method} — ${extracted.text.length} chars`);

    tipo = await classify(extracted.text);
    console.log(`[DOCS]   Tipo: ${tipo}`);

    raw = await extract(extracted.text, tipo);
  }

  if (!raw) throw new Error('El modelo no devolvió JSON válido. ¿Está LM Studio corriendo?');

  // 4. Validar y corregir
  const validated = validate({ tipo, ...raw }, tipo);

  // 5. Resolver entidades
  const enriched = await resolveEntities(validated);

  // 6. Guardar
  const record = {
    id,
    nombre_archivo:    originalName,
    mime_type:         mimeType,
    procesado:         new Date().toISOString(),
    tiempo_ms:         Date.now() - t0,
    metodo_extraccion: extracted.method,
    paginas:           extracted.pages || 1,
    chars_extraidos:   extracted.text?.length || 0,
    texto_preview:     extracted.text?.slice(0, 800) || '[procesado por visión]',
    analisis:          enriched,
    estado:            'procesado',
  };

  const docs = await loadJSON(DOCS_FILE, []);
  docs.unshift(record);
  await saveJSON(DOCS_FILE, docs.slice(0, 2000));

  console.log(`[DOCS] ✓ ${originalName} → ${tipo} (${extracted.method}) en ${record.tiempo_ms}ms`);
  return record;
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════

async function llmCall(messages, maxTokens = 1200, temp = 0.1) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 180_000); // 3 min
  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({ model: MODEL, messages, temperature: temp, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => '')}`);
    // Nota: VL_MODEL ya no aplica — qwen3:14b no es multimodal
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

function parseJSON(text) {
  // 1. Parse directo
  try { return JSON.parse(text); } catch {}
  // 2. Extraer bloque JSON
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  // 3. Reparar errores comunes
  const fixed = (m?.[0] || text)
    .replace(/,\s*([}\]])/g, '$1')   // trailing commas
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')  // claves sin comillas
    .replace(/:\s*'([^']*)'/g, ': "$1"');        // comillas simples → dobles
  try { return JSON.parse(fixed); } catch {}
  console.warn('[DOCS] ⚠ No se pudo parsear JSON del LLM:', text.slice(0, 200));
  return null;
}

async function loadJSON(file, def) {
  try { return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : def; }
  catch { return def; }
}

async function saveJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── API pública ────────────────────────────────────────────────────────────
export const getDocuments  = ()       => loadJSON(DOCS_FILE, []);
export const getEntities   = ()       => loadJSON(ENT_FILE,  { clientes: [], proveedores: [], trabajadores: [] });
export const getDocument   = async id => { const d = await loadJSON(DOCS_FILE,[]); return d.find(x=>x.id===id)||null; };
export const deleteDocument= async id => {
  const d = await loadJSON(DOCS_FILE, []);
  const u = d.filter(x => x.id !== id);
  await saveJSON(DOCS_FILE, u);
  return u.length < d.length;
};

export async function getStats() {
  const [docs, ents] = await Promise.all([getDocuments(), getEntities()]);
  const byTipo = docs.reduce((a, d) => { const t = d.analisis?.tipo||'otro'; a[t]=(a[t]||0)+1; return a; }, {});
  return {
    total_documentos:   docs.length,
    total_clientes:     ents.clientes.length,
    total_proveedores:  ents.proveedores.length,
    total_trabajadores: (ents.trabajadores || []).length,
    por_tipo:           byTipo,
    ultimo_proceso:     docs[0]?.procesado || null,
  };
}
