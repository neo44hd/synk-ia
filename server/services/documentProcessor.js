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
const LITELLM   = process.env.LITELLM_URL     || 'http://localhost:8082';
const MODEL     = process.env.LOCAL_LLM_MODEL || 'medina-qwen3-14b-openclaw';
const DATA_DIR  = process.env.DATA_DIR        || '/Users/davidnows/sinkia/data';
const DOCS_FILE = path.join(DATA_DIR, 'documents.json');
const ENT_FILE  = path.join(DATA_DIR, 'entities.json');

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

// OCR con Tesseract
async function ocrFile(filePath, type) {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);

    let args;
    if (type === 'pdf') {
      // Convertir PDF a imagen con ImageMagick si está disponible, luego OCR
      // Si no, tesseract puede leer PDFs directamente en versiones recientes
      args = [filePath, 'stdout', '-l', 'spa+eng', '--dpi', '300', '--psm', '1'];
    } else {
      args = [filePath, 'stdout', '-l', 'spa+eng', '--dpi', '300', '--psm', '3'];
    }

    const { stdout } = await exec('tesseract', args, { timeout: 90_000 });
    const text = cleanText(stdout);
    if (text.length > 20) return { text, method: 'tesseract-ocr', ok: true };
    return { text: '', method: 'ocr-sin-texto', ok: false, hint: 'OCR no encontró texto legible' };
  } catch (e) {
    const notFound = e.code === 'ENOENT' || e.message?.includes('not found');
    return {
      text: '', method: 'ocr-fallido', ok: false,
      hint: notFound
        ? 'Tesseract no instalado. Ejecuta: brew install tesseract tesseract-lang'
        : `OCR error: ${e.message}`,
    };
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
function smartTruncate(text, maxChars = 3200) {
  if (text.length <= maxChars) return text;

  const head = text.slice(0, Math.floor(maxChars * 0.6));   // 60% inicio
  const tail = text.slice(-Math.floor(maxChars * 0.35));    // 35% final
  return `${head}\n\n[...documento truncado...]\n\n${tail}`;
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

  nomina: `Es una NÓMINA.
- emisor = empresa empleadora
- receptor = empleado
- accion_recomendada = "registrar_gasto"
- total = salario neto. base_imponible = salario bruto`,

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
  const truncated    = smartTruncate(text, 3000);

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
  const ents  = await loadJSON(ENT_FILE, { clientes: [], proveedores: [] });
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

  await saveJSON(ENT_FILE, ents);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════
//  PIPELINE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════

export async function processDocument(filePath, mimeType, originalName) {
  const id      = `doc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const t0      = Date.now();
  console.log(`[DOCS] → Procesando: ${originalName}`);

  // 1. Extraer texto
  const extracted = await extractText(filePath, mimeType);
  if (!extracted.ok) throw new Error(extracted.hint || 'No se pudo extraer texto');
  console.log(`[DOCS]   Extracción: ${extracted.method} — ${extracted.text.length} chars`);

  // 2. Clasificar (pasada rápida)
  const tipo = await classify(extracted.text);
  console.log(`[DOCS]   Tipo: ${tipo}`);

  // 3. Extraer datos estructurados (prompt específico por tipo)
  const raw = await extract(extracted.text, tipo);
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
    chars_extraidos:   extracted.text.length,
    texto_preview:     extracted.text.slice(0, 800),
    analisis:          enriched,
    estado:            'procesado',
  };

  const docs = await loadJSON(DOCS_FILE, []);
  docs.unshift(record);
  await saveJSON(DOCS_FILE, docs.slice(0, 2000));

  console.log(`[DOCS] ✓ ${originalName} → ${tipo} en ${record.tiempo_ms}ms`);
  return record;
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════

async function llmCall(messages, maxTokens = 1200, temp = 0.1) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 180_000); // 3 min
  try {
    const res = await fetch(`${LITELLM}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({ model: MODEL, messages, temperature: temp, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text().catch(() => '')}`);
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
export const getEntities   = ()       => loadJSON(ENT_FILE,  { clientes: [], proveedores: [] });
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
    total_documentos:  docs.length,
    total_clientes:    ents.clientes.length,
    total_proveedores: ents.proveedores.length,
    por_tipo:          byTipo,
    ultimo_proceso:    docs[0]?.procesado || null,
  };
}
