// ═══════════════════════════════════════════════════════════════════════════
//  SINKIA — Motor de procesamiento de documentos v3
//  Filosofía: UNA sola llamada al LLM. Sin heurísticas. Sin categorías fijas.
//  El modelo LEE el documento, ENTIENDE lo que es, y EXTRAE todo.
// ═══════════════════════════════════════════════════════════════════════════
import pdfParse       from 'pdf-parse';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync }  from 'fs';
import path            from 'path';
import { fileURLToPath } from 'url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────
const OLLAMA_URL = process.env.OLLAMA_URL      || 'http://localhost:11434';
const MODEL      = process.env.OLLAMA_MODEL    || 'phi4-mini';
const DATA_DIR   = process.env.DATA_DIR        || '/Users/davidnows/sinkia/data';
const DOCS_FILE  = path.join(DATA_DIR, 'documents.json');
const ENT_FILE   = path.join(DATA_DIR, 'entities.json');

// ── Detección automática de modelo con capacidad visual ───────────────────
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
//    brew install poppler (para pdftoppm)
// ══════════════════════════════════════════════════════════════════════════

async function ocrFile(filePath, sourceType = 'image') {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);

    // Detectar Tesseract
    let tesseractBin = 'tesseract';
    const macPaths = ['/opt/homebrew/bin/tesseract', '/usr/local/bin/tesseract'];
    for (const p of macPaths) {
      if (existsSync(p)) { tesseractBin = p; break; }
    }

    try {
      await exec(tesseractBin, ['--version'], { timeout: 5000 });
    } catch {
      return { text: '', method: 'ocr-no-tesseract', ok: false,
        hint: 'Tesseract no instalado. brew install tesseract tesseract-lang' };
    }

    // Detectar idioma
    const lang = existsSync('/opt/homebrew/share/tessdata/spa.traineddata') ||
                 existsSync('/usr/local/share/tessdata/spa.traineddata') ? 'spa+eng' : 'eng';

    if (sourceType === 'pdf') {
      return ocrPdfViaImages(filePath, lang, exec);
    }

    // OCR directo sobre imagen
    const { stdout } = await exec(tesseractBin, [filePath, 'stdout', '-l', lang, '--dpi', '300'], { timeout: 60_000 });
    const text = cleanText(stdout);

    if (text.length > 20) {
      return { text, method: 'tesseract', ok: true };
    }
    return { text: '', method: 'ocr-sin-texto', ok: false, hint: 'OCR no encontró texto legible' };

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

    await exec('pdftoppm', ['-png', '-r', '300', '-l', '10', pdfPath, prefix], { timeout: 60_000 });

    const { readdir } = await import('fs/promises');
    const files = (await readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();

    if (files.length === 0) {
      return { text: '', method: 'ocr-pdf-sin-paginas', ok: false, hint: 'pdftoppm no generó imágenes del PDF' };
    }

    const pageTexts = [];
    for (const file of files) {
      try {
        const imgPath = path.join(tmpDir, file);
        const { stdout } = await exec('tesseract', [imgPath, 'stdout', '-l', lang, '--dpi', '300', '--psm', '1'], { timeout: 60_000 });
        const text = cleanText(stdout);
        if (text.length > 5) pageTexts.push(text);
      } catch {}
    }

    for (const file of files) {
      try { const { unlink } = await import('fs/promises'); await unlink(path.join(tmpDir, file)); } catch {}
    }
    try { const { rmdir } = await import('fs/promises'); await rmdir(tmpDir); } catch {}

    const fullText = pageTexts.join('\\n\\n--- Página ---\\n\\n');
    if (fullText.length > 20) {
      console.log(`[OCR] ✓ PDF escaneado: ${files.length} páginas, ${fullText.length} chars extraídos`);
      return { text: fullText, method: 'tesseract-pdf-via-images', ok: true, pages: files.length };
    }
    return { text: '', method: 'ocr-pdf-sin-texto', ok: false, hint: 'OCR no encontró texto legible en el PDF escaneado' };
  } catch (e) {
    try { const { rm } = await import('fs/promises'); await rm(tmpDir, { recursive: true }); } catch {}
    return { text: '', method: 'ocr-pdf-error', ok: false, hint: `Error OCR PDF: ${e.message}` };
  }
}

// Parser básico de EML
function parseEml(raw) {
  const lines = raw.split('\\n');
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
  return `De: ${headers.from || ''}\\nPara: ${headers.to || ''}\\nAsunto: ${headers.subject || ''}\\n\\n${body.join('\\n')}`;
}

// ── Limpieza de texto ──────────────────────────────────────────────────────
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}

// ── Truncado inteligente ───────────────────────────────────────────────────
function smartTruncate(text, maxChars = 6000) {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.6));
  const tail = text.slice(-Math.floor(maxChars * 0.35));
  return `${head}\n\n[...documento truncado...]\n\n${tail}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  VISIÓN — Helpers para modelos VL (imagen → base64 → LLM)
// ══════════════════════════════════════════════════════════════════════════

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

async function llmCallVision(messages, maxTokens = 2000, temp = 0.05) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 240_000);
  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({ model: MODEL, messages, temperature: temp, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama-VL ${res.status}: ${await res.text().catch(() => '')}`);
    const d = await res.json();
    return stripThinking(d.choices?.[0]?.message?.content?.trim() || '');
  } finally {
    clearTimeout(timer);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MOTOR V3 — UNA SOLA LLAMADA: Clasificar + Extraer + Entender
//
//  Sin heurísticas. Sin categorías fijas. El LLM LEE y ENTIENDE.
// ══════════════════════════════════════════════════════════════════════════

// ── Datos de MI EMPRESA (se inyectan en el prompt para contexto) ──────────
const MI_EMPRESA = {
  nombre: process.env.EMPRESA_NOMBRE || 'CHICKEN PALACE IBIZA, S.L.',
  cif:    process.env.EMPRESA_CIF    || 'B56908486',
  email:  process.env.EMAIL_USER     || 'info@chickenpalace.es',
};

const UNIVERSAL_PROMPT = `Eres el motor de inteligencia de SynK-IA, una aplicación de gestión documental.

CONTEXTO:
Esta es la bandeja de entrada de ${MI_EMPRESA.nombre} (CIF: ${MI_EMPRESA.cif}), un restaurante en Ibiza.
TODOS los documentos que procesas son GASTOS de esta empresa: facturas de proveedores, nóminas de empleados, recibos, etc.
${MI_EMPRESA.nombre} SIEMPRE es quien PAGA. NUNCA es el proveedor en estos documentos.

REGLAS FIJAS PARA FACTURAS:
- tipo = "factura_recibida" (SIEMPRE, salvo que sea claramente otra cosa como nómina o finiquito)
- emisor = el PROVEEDOR (la empresa/persona que vende el producto o servicio)
- receptor = ${MI_EMPRESA.nombre} (quien paga)
- emisor.rol = "proveedor"
- receptor.rol = "empresa"
- CUIDADO: muchos PDFs tienen el nombre "${MI_EMPRESA.nombre}" o "CHICKEN PALACE" en la cabecera.
  Eso NO significa que Chicken Palace sea el emisor. El PROVEEDOR es la OTRA empresa/persona del documento.
  Busca la entidad que NO es ${MI_EMPRESA.nombre}. Esa es el proveedor.
  Ejemplo: si el PDF dice "CHICKEN PALACE" arriba e "INOT & INAD" abajo, el proveedor es INOT & INAD.

REGLAS PARA NÓMINAS:
- tipo = "nomina"
- emisor = ${MI_EMPRESA.nombre} con rol "empleador"
- receptor = el TRABAJADOR con rol "empleado"

REGLAS PARA FINIQUITOS:
- tipo = "finiquito", igual que nómina

OTROS DOCUMENTOS: clasifica libremente (ticket, contrato, certificado, extracto_bancario, etc.)

INSTRUCCIONES:
1. LEE el documento completo
2. Identifica al PROVEEDOR (la entidad que NO es Chicken Palace)
3. EXTRAE todos los datos: importes, fechas, conceptos, referencias
4. Si hay datos laborales (NSS, categoría profesional, antigüedad), extráelos

DEVUELVE EXACTAMENTE ESTE JSON (rellena lo que encuentres, null lo que no):
{
  "tipo": "el tipo real del documento (factura_recibida, factura_emitida, nomina, finiquito, albaran, presupuesto, contrato, ticket, extracto_bancario, certificado, otro)",
  "subtipo": "más detalle si aplica (ej: liquidacion, carta_despido, factura_proforma, recibo_autonomo...)",
  "numero_documento": null,
  "fecha": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD o null",
  "emisor": {
    "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null,
    "rol": "proveedor | empleador | banco | administracion | otro"
  },
  "receptor": {
    "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null,
    "rol": "cliente | empleado | empresa | particular | otro"
  },
  "trabajador": {
    "nombre_completo": null,
    "dni": null,
    "nss": "número Seguridad Social si aparece (Nº Afiliación, N.A.F., Nº S.S.)",
    "categoria_profesional": null,
    "grupo_cotizacion": null,
    "antiguedad": "fecha alta YYYY-MM-DD",
    "tipo_contrato": null,
    "puesto": null
  },
  "conceptos": [
    { "descripcion": null, "cantidad": 1, "precio_unitario": 0.0, "iva_porcentaje": null, "total": 0.0 }
  ],
  "base_imponible": null,
  "iva_total": null,
  "total": null,
  "moneda": "EUR",
  "forma_pago": null,
  "cuenta_bancaria": null,
  "resumen": "una frase describiendo el documento",
  "datos_extra": {},
  "confianza": 0.9
}

REGLAS:
- Si NO es una nómina/finiquito/liquidación, pon "trabajador": null
- Si es una nómina: total = líquido a percibir (neto), base_imponible = salario bruto
- "conceptos" son las líneas del documento: productos en facturas, devengos/deducciones en nóminas
- Importes como número decimal (21.50, no "21,50")
- Fechas en YYYY-MM-DD
- null para lo que no encuentres, NUNCA string vacío
- "datos_extra" para cualquier dato interesante que no encaje arriba (ej: periodo_liquidacion, dias_vacaciones, indemnizacion)
- Responde SOLO con el JSON, sin explicaciones, sin markdown`;

async function analyzeDocument(text) {
  const truncated = smartTruncate(text, 6000);

  const raw = await llmCall([
    { role: 'system', content: UNIVERSAL_PROMPT },
    { role: 'user',   content: `DOCUMENTO:\n${truncated}` },
  ], 2000, 0.05);

  return parseJSON(raw);
}

// Versión visión (para imágenes con modelo VL)
async function analyzeVision(imgData) {
  const raw = await llmCallVision([
    { role: 'system', content: UNIVERSAL_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: 'Analiza este documento:' },
      { type: 'image_url', image_url: { url: imgData.url } },
    ]},
  ], 2000, 0.05);

  return parseJSON(raw);
}

// ══════════════════════════════════════════════════════════════════════════
//  VALIDACIÓN — Corrección ligera sin cambiar lo que decidió el LLM
// ══════════════════════════════════════════════════════════════════════════

function validate(data) {
  const d = { ...data };

  // Limpiar null strings en objetos anidados
  function cleanObj(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(cleanObj);
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === '' || v === 'null' || v === 'undefined' || v === 'N/A' || v === '-' || v === 'n/a') {
        result[k] = null;
      } else if (typeof v === 'object') {
        result[k] = cleanObj(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  Object.assign(d, cleanObj(d));

  // Normalizar fecha si no está en YYYY-MM-DD
  if (d.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) {
    d.fecha = tryParseDate(d.fecha) || d.fecha;
  }
  if (d.fecha_vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha_vencimiento)) {
    d.fecha_vencimiento = tryParseDate(d.fecha_vencimiento) || d.fecha_vencimiento;
  }

  // Si hay conceptos pero no total, calcular
  if (d.conceptos?.length && !d.total) {
    const sum = d.conceptos.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
    if (sum > 0) d.total = Math.round(sum * 100) / 100;
  }

  // Asegurar resumen
  if (!d.resumen) {
    const partes = [d.tipo || 'documento'];
    if (d.emisor?.nombre)   partes.push(`de ${d.emisor.nombre}`);
    if (d.receptor?.nombre) partes.push(`para ${d.receptor.nombre}`);
    if (d.total)            partes.push(`por ${d.total}€`);
    if (d.fecha)            partes.push(`(${d.fecha})`);
    d.resumen = partes.join(' ');
  }

  // Limpiar trabajador si está todo vacío
  if (d.trabajador) {
    const tVals = Object.values(d.trabajador).filter(v => v !== null && v !== undefined);
    if (tVals.length === 0) d.trabajador = null;
  }

  return d;
}

function tryParseDate(str) {
  if (!str) return null;
  const patterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
    /(\d{2})\.(\d{2})\.(\d{4})/,
  ];
  for (const p of patterns) {
    const m = str.match(p);
    if (m) {
      const [, a, b, c] = m;
      if (parseInt(a) > 31) return `${a}-${b}-${c}`;
      return `${c}-${b}-${a}`;
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
//  RESOLUCIÓN DE ENTIDADES — Inteligente, basada en lo que el LLM detectó
// ══════════════════════════════════════════════════════════════════════════

function normName(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\-_]/g, ' ').replace(/\s+/g, ' ');
}

function sameEntity(a, b) {
  if (!a || !b) return false;
  // Por CIF/NIF
  if (a.cif_nif && b.cif_nif && a.cif_nif.replace(/\s/g,'') === b.cif_nif.replace(/\s/g,'')) return true;
  // Por DNI (para trabajadores)
  if (a.dni && b.dni && a.dni.replace(/\s/g,'') === b.dni.replace(/\s/g,'')) return true;
  // Por nombre
  const na = normName(a.nombre || a.nombre_completo), nb = normName(b.nombre || b.nombre_completo);
  if (na.length > 3 && nb.length > 3) {
    if (na === nb) return true;
    if (na.length > 6 && nb.includes(na.slice(0, 6))) return true;
    if (nb.length > 6 && na.includes(nb.slice(0, 6))) return true;
  }
  // Por NSS (para trabajadores)
  if (a.nss && b.nss && a.nss.replace(/[\s\-\/]/g,'') === b.nss.replace(/[\s\-\/]/g,'')) return true;
  return false;
}

async function resolveEntities(analysis) {
  const ents  = await loadJSON(ENT_FILE, { clientes: [], proveedores: [], trabajadores: [] });
  if (!ents.trabajadores) ents.trabajadores = [];
  if (!ents.proveedores)  ents.proveedores  = [];
  if (!ents.clientes)     ents.clientes     = [];
  const result = { ...analysis, entidades_creadas: [] };

  // ── Detectar proveedor por el rol que asignó el LLM ──────────────────
  const emisorRol   = (analysis.emisor?.rol || '').toLowerCase();
  const receptorRol = (analysis.receptor?.rol || '').toLowerCase();
  const tipo        = (analysis.tipo || '').toLowerCase();

  const esProveedor = emisorRol === 'proveedor' ||
    ['factura_recibida', 'albaran', 'ticket'].includes(tipo);
  const esCliente = receptorRol === 'cliente' ||
    ['factura_emitida', 'presupuesto'].includes(tipo);
  const esNomina = ['nomina', 'finiquito', 'liquidacion'].includes(tipo) ||
    (analysis.subtipo || '').toLowerCase().includes('liquid') ||
    emisorRol === 'empleador' || receptorRol === 'empleado' ||
    analysis.trabajador !== null;

  // ── Proveedor ─────────────────────────────────────────────────────────
  if (analysis.emisor?.nombre && esProveedor) {
    let prov = ents.proveedores.find(p => sameEntity(p, analysis.emisor));
    if (prov) {
      if (analysis.emisor.email && !prov.email) prov.email = analysis.emisor.email;
      if (analysis.emisor.cif_nif && !prov.cif_nif) prov.cif_nif = analysis.emisor.cif_nif;
      if (analysis.emisor.telefono && !prov.telefono) prov.telefono = analysis.emisor.telefono;
      result.proveedor_id    = prov.id;
      result.proveedor_nuevo = false;
    } else {
      prov = {
        id: `prov_${Date.now()}`,
        nombre:    analysis.emisor.nombre,
        cif_nif:   analysis.emisor.cif_nif,
        direccion: analysis.emisor.direccion,
        email:     analysis.emisor.email,
        telefono:  analysis.emisor.telefono,
        creado:    new Date().toISOString(),
        facturas:  0,
      };
      ents.proveedores.push(prov);
      result.proveedor_id    = prov.id;
      result.proveedor_nuevo = true;
      result.entidades_creadas.push({ tipo: 'proveedor', nombre: prov.nombre, id: prov.id });
    }
    prov.facturas = (prov.facturas || 0) + 1;
    prov.ultima_factura = analysis.fecha || new Date().toISOString().slice(0, 10);
  }

  // ── Cliente ───────────────────────────────────────────────────────────
  if (analysis.receptor?.nombre && esCliente) {
    let cli = ents.clientes.find(c => sameEntity(c, analysis.receptor));
    if (cli) {
      if (analysis.receptor.email && !cli.email) cli.email = analysis.receptor.email;
      result.cliente_id    = cli.id;
      result.cliente_nuevo = false;
    } else {
      cli = {
        id: `cli_${Date.now()}`,
        nombre:    analysis.receptor.nombre,
        cif_nif:   analysis.receptor.cif_nif,
        direccion: analysis.receptor.direccion,
        email:     analysis.receptor.email,
        creado:    new Date().toISOString(),
        facturas:  0,
      };
      ents.clientes.push(cli);
      result.cliente_id    = cli.id;
      result.cliente_nuevo = true;
      result.entidades_creadas.push({ tipo: 'cliente', nombre: cli.nombre, id: cli.id });
    }
    cli.facturas = (cli.facturas || 0) + 1;
  }

  // ── Trabajador — desde campo dedicado O desde receptor si es nómina ──
  if (esNomina) {
    const tData = analysis.trabajador || {};
    const nombre = tData.nombre_completo || analysis.receptor?.nombre;
    const dni    = tData.dni || analysis.receptor?.cif_nif;
    const nss    = tData.nss || null;

    if (nombre) {
      const searchObj = { nombre, nombre_completo: nombre, cif_nif: dni, dni, nss };
      let trab = ents.trabajadores.find(t => sameEntity(t, searchObj));

      if (trab) {
        // Actualizar con datos más completos
        if (dni && !trab.dni) trab.dni = dni;
        if (nss && !trab.nss) trab.nss = nss;
        if (tData.categoria_profesional && !trab.categoria_profesional) trab.categoria_profesional = tData.categoria_profesional;
        if (tData.antiguedad && !trab.fecha_alta) trab.fecha_alta = tData.antiguedad;
        if (tData.tipo_contrato && !trab.tipo_contrato) trab.tipo_contrato = tData.tipo_contrato;
        if (tData.grupo_cotizacion && !trab.grupo_cotizacion) trab.grupo_cotizacion = tData.grupo_cotizacion;
        if (tData.puesto && !trab.puesto) trab.puesto = tData.puesto;
        if (analysis.base_imponible) trab.ultimo_salario_bruto = analysis.base_imponible;
        if (analysis.total) trab.ultimo_salario_neto = analysis.total;
        trab.nominas = (trab.nominas || 0) + 1;
        trab.ultima_nomina = analysis.fecha || new Date().toISOString().slice(0, 10);
        result.trabajador_id    = trab.id;
        result.trabajador_nuevo = false;
      } else {
        const partes    = nombre.trim().split(/\s+/);
        const firstName = partes[0] || 'Sin nombre';
        const lastName  = partes.slice(1).join(' ');

        trab = {
          id:                      `trab_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          nombre:                  firstName,
          apellidos:               lastName,
          nombre_completo:         nombre,
          dni,
          nss,
          categoria_profesional:   tData.categoria_profesional || null,
          grupo_cotizacion:        tData.grupo_cotizacion || null,
          fecha_alta:              tData.antiguedad || null,
          tipo_contrato:           tData.tipo_contrato || null,
          puesto:                  tData.puesto || null,
          ultimo_salario_bruto:    analysis.base_imponible || null,
          ultimo_salario_neto:     analysis.total || null,
          activo:                  tipo !== 'finiquito',
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

      // Si es finiquito, marcar como inactivo
      if (tipo === 'finiquito' && trab) {
        trab.activo = false;
        trab.fecha_baja = analysis.fecha || new Date().toISOString().slice(0, 10);
        if (analysis.datos_extra?.indemnizacion) trab.indemnizacion = analysis.datos_extra.indemnizacion;
      }
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

  console.log(`[DOCS] → Procesando: ${originalName}`);

  let extracted, analysis;

  // ── PIPELINE VISIÓN: imagen + modelo VL → análisis directo ─────────────
  if (isImageFile && IS_VL_MODEL) {
    console.log(`[DOCS]   Modo visión directa`);
    const imgData = await loadImageAsBase64(filePath, mimeType);
    analysis = await analyzeVision(imgData);
    extracted = { text: '[procesado por visión directa]', method: 'vision-vl', ok: true, pages: 1 };

  // ── PIPELINE TEXTO: extraer → analizar (UNA sola llamada LLM) ─────────
  } else {
    extracted = await extractText(filePath, mimeType);
    if (!extracted.ok) throw new Error(extracted.hint || 'No se pudo extraer texto');
    console.log(`[DOCS]   Extracción: ${extracted.method} — ${extracted.text.length} chars`);

    analysis = await analyzeDocument(extracted.text);
  }

  if (!analysis) throw new Error('El modelo no devolvió JSON válido');

  // Validar
  const validated = validate(analysis);
  console.log(`[DOCS]   Tipo: ${validated.tipo} | Emisor: ${validated.emisor?.nombre || 'n/a'} | Total: ${validated.total || 'n/a'}`);

  // Resolver entidades
  const enriched = await resolveEntities(validated);

  if (enriched.entidades_creadas?.length) {
    console.log(`[DOCS]   Entidades: ${enriched.entidades_creadas.map(e => `+${e.tipo}: ${e.nombre}`).join(', ')}`);
  }

  // Guardar
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

  console.log(`[DOCS] ✓ ${originalName} → ${validated.tipo} en ${record.tiempo_ms}ms`);
  return record;
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════

async function llmCall(messages, maxTokens = 2000, temp = 0.1) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({ model: MODEL, messages, temperature: temp, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => '')}`);
    const d = await res.json();
    return stripThinking(d.choices?.[0]?.message?.content?.trim() || '');
  } finally {
    clearTimeout(timer);
  }
}

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function parseJSON(text) {
  text = stripThinking(text);
  // 1. Parse directo
  try { return JSON.parse(text); } catch {}
  // 2. Extraer bloque JSON (el más grande)
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  // 3. Reparar errores comunes
  const fixed = (m?.[0] || text)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"');
  try { return JSON.parse(fixed); } catch {}
  console.warn('[DOCS] ⚠ No se pudo parsear JSON del LLM:', text.slice(0, 300));
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
