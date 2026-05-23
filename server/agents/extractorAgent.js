// ═══════════════════════════════════════════════════════════════════════════
//  AGENTE EXTRACTOR UNIVERSAL — SynK-IA
//
//  Extrae texto y datos de CUALQUIER formato de archivo:
//  PDF, imágenes (OCR / visión VL), Office (XLSX, DOCX, PPTX, ODS, ODT, ODP,
//  DOC, PPT), archivos comprimidos (ZIP, RAR, 7Z, TAR), email (EML, MSG),
//  texto plano y código (TXT, CSV, JSON, XML, YAML, TOML, INI, LOG, MD…),
//  web (HTML, MHTML), RTF, ICS (calendario), OFX/QIF (finanzas).
//
//  API pública:
//    extract(filePath, mimeType, originalName)
//    → { text, method, metadata, ok, error? }
//
//  Filosofía:
//  - Nunca lanza excepciones; siempre devuelve { ok: false, error: '...' }
//  - Truncado inteligente si el texto supera 12 000 chars
//  - Metadatos ricos: pages, sheets, slides, file_count, language_hint,
//    has_tables, has_images, encoding
//
//  Dependencias disponibles en Mac Mini M4 Pro:
//    pdf-parse, adm-zip, xlsx
//    Sistema: tesseract (brew), pdftoppm (poppler), unrar, 7z (p7zip)
//    Ollama en process.env.OLLAMA_URL || 'http://localhost:11434'
// ═══════════════════════════════════════════════════════════════════════════

import { readFile, writeFile, mkdir, readdir, rm, stat } from 'fs/promises';
import { existsSync }  from 'fs';
import path            from 'path';
import { fileURLToPath } from 'url';
import { execFile }    from 'child_process';
import { promisify }   from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DUAL — Ollama + LM Studio
// ═══════════════════════════════════════════════════════════════════════════
const OLLAMA_URL      = process?.env?.OLLAMA_URL || 'http://localhost:11434';
const LMSTUDIO_URL    = process?.env?.LMSTUDIO_URL || 'http://localhost:1234/v1';
const LMSTUDIO_KEY    = process?.env?.LMSTUDIO_API_KEY || '';
const OCR_PROVIDER    = process?.env?.OCR_PROVIDER || 'ollama';
const OCR_MODEL       = process.env.OCR_MODEL || 'glm-ocr';

function getOcrModel() {
  return OCR_MODEL;
}

function isLMStudio() {
  return OCR_PROVIDER === 'lmstudio';
}

function getOcrEndpoint() {
  return isLMStudio() ? LMSTUDIO_URL.replace(/\/v1\/?$/, '') : OLLAMA_URL;
}

// Límite de texto extraído antes del truncado inteligente
const MAX_CHARS  = 12_000;

// ── Rutas de Tesseract en Mac M4 ─────────────────────────────────────────
const TESSERACT_PATHS = [
  '/opt/homebrew/bin/tesseract',
  '/usr/local/bin/tesseract',
  'tesseract',
];

const TESSDATA_PATHS = [
  '/opt/homebrew/share/tessdata/spa.traineddata',
  '/usr/local/share/tessdata/spa.traineddata',
];

// ═══════════════════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae texto/datos de cualquier archivo soportado.
 *
 * @param {string} filePath     - Ruta absoluta al archivo
 * @param {string} mimeType     - MIME type (puede ser vacío)
 * @param {string} originalName - Nombre original (para detección por extensión)
 * @returns {Promise<{text:string, method:string, metadata:object, ok:boolean, error?:string}>}
 */
export async function extract(filePath, mimeType = '', originalName = '') {
  const t0  = Date.now();
  const ext = path.extname(originalName || filePath).toLowerCase();

  console.log(`[EXTRACTOR] → ${originalName || path.basename(filePath)} (${mimeType || ext})`);

  // Comprobar que el archivo existe
  if (!existsSync(filePath)) {
    return fail('archivo-no-encontrado', `Archivo no encontrado: ${filePath}`);
  }

  try {
    const result = await dispatchExtract(filePath, mimeType, ext, originalName);

    // Sanear caracteres nulos y de control que corrompen el análisis del LLM
    if (result.text) {
      result.text = result.text.replace(/\0/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    }

    // Truncado inteligente si supera el límite
    if (result.text && result.text.length > MAX_CHARS) {
      result.text = smartTruncate(result.text, MAX_CHARS);
      result.metadata = { ...(result.metadata || {}), truncated: true, original_length: result.text.length };
    }

    result.metadata = {
      elapsed_ms:    Date.now() - t0,
      original_name: originalName,
      ...(result.metadata || {}),
    };

    console.log(`[EXTRACTOR] ✓ ${result.method} — ${result.text?.length || 0} chars (${Date.now() - t0}ms)`);
    return result;

  } catch (err) {
    console.error(`[EXTRACTOR] ✗ Error inesperado: ${err.message}`);
    return fail('error-inesperado', err.message);
  }
}

// ─── Dispatcher por formato ───────────────────────────────────────────────

async function dispatchExtract(filePath, mimeType, ext, originalName) {
  const mime = (mimeType || '').toLowerCase();

  // ── PDF ────────────────────────────────────────────────────────────────
  if (mime.includes('pdf') || ext === '.pdf') {
    return extractPdf(filePath);
  }

  // ── Imágenes ───────────────────────────────────────────────────────────
  if (mime.startsWith('image/') || isImageExt(ext)) {
    return extractImage(filePath, mime, ext);
  }

  // ── Excel / Hojas de cálculo ───────────────────────────────────────────
  if (isSpreadsheetExt(ext) || isSpreadsheetMime(mime)) {
    return extractSpreadsheet(filePath, ext);
  }

  // ── DOCX / DOCM ───────────────────────────────────────────────────────
  if (ext === '.docx' || ext === '.docm' || mime.includes('wordprocessingml')) {
    return extractDocx(filePath);
  }

  // ── DOC (Word antiguo) ────────────────────────────────────────────────
  if (ext === '.doc' || mime.includes('msword')) {
    return extractDocLegacy(filePath);
  }

  // ── ODT ───────────────────────────────────────────────────────────────
  if (ext === '.odt' || mime.includes('opendocument.text')) {
    return extractOdt(filePath);
  }

  // ── PPTX ──────────────────────────────────────────────────────────────
  if (ext === '.pptx' || ext === '.pptm' || mime.includes('presentationml')) {
    return extractPptx(filePath);
  }

  // ── PPT (antiguo) ─────────────────────────────────────────────────────
  if (ext === '.ppt' || mime.includes('ms-powerpoint') || mime.includes('powerpoint')) {
    return extractPptLegacy(filePath);
  }

  // ── ODP (Impress) ─────────────────────────────────────────────────────
  if (ext === '.odp' || mime.includes('opendocument.presentation')) {
    return extractOdp(filePath);
  }

  // ── Archivos comprimidos ───────────────────────────────────────────────
  if (ext === '.zip' || mime.includes('zip')) {
    return extractZip(filePath);
  }
  if (ext === '.rar' || mime.includes('rar')) {
    return extractRar(filePath);
  }
  if (ext === '.7z' || mime.includes('7z-compressed') || mime.includes('x-7z')) {
    return extract7z(filePath);
  }
  if (ext === '.tar' || ext === '.gz' || ext === '.tgz' || mime.includes('tar') || mime.includes('gzip')) {
    return extractTar(filePath, ext);
  }

  // ── Email ──────────────────────────────────────────────────────────────
  if (ext === '.eml' || mime.includes('message/rfc822') || mime.includes('rfc822')) {
    return extractEml(filePath);
  }
  if (ext === '.msg' || mime.includes('ms-outlook') || mime.includes('vnd.ms-outlook')) {
    return extractMsg(filePath);
  }

  // ── HTML / MHTML ──────────────────────────────────────────────────────
  if (ext === '.html' || ext === '.htm' || ext === '.mhtml' || mime.includes('html')) {
    return extractHtml(filePath);
  }

  // ── RTF ───────────────────────────────────────────────────────────────
  if (ext === '.rtf' || mime.includes('rtf')) {
    return extractRtf(filePath);
  }

  // ── Calendario ICS ────────────────────────────────────────────────────
  if (ext === '.ics' || mime.includes('calendar')) {
    return extractIcs(filePath);
  }

  // ── Finanzas OFX / QIF ────────────────────────────────────────────────
  if (ext === '.ofx' || ext === '.qfx' || mime.includes('ofx')) {
    return extractOfx(filePath);
  }
  if (ext === '.qif') {
    return extractQif(filePath);
  }

  // ── Código fuente / texto estructurado ────────────────────────────────
  if (isCodeOrTextExt(ext) || mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('yaml')) {
    return extractText(filePath, ext);
  }

  // ── Fallback: intentar leer como texto UTF-8 ──────────────────────────
  return extractText(filePath, ext, true);
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXTRACTORES POR FORMATO
// ═══════════════════════════════════════════════════════════════════════════

// ── PDF ────────────────────────────────────────────────────────────────────

async function extractPdf(filePath) {
  try {
    const { default: pdfParse } = await import('pdf-parse');
    const buf    = await readFile(filePath);
    const parsed = await pdfParse(buf, { max: 30 });
    const text   = cleanText(parsed.text || '');

    // Verificar si hay texto real (no solo espacios/basura)
    if (text.length > 80) {
      return ok(text, 'pdf-text', {
        pages:      parsed.numpages,
        has_tables: text.includes('|') || /\t/.test(text),
        has_images: false,
      });
    }

    console.log(`[EXTRACTOR] PDF sin texto → intentando OCR (${parsed.numpages} páginas)`);

    // 1) Intentar OCR dedicado con glm-ocr (más preciso para documentos)
    const glmResult = await ocrPdfViaGlm(filePath);
    if (glmResult && glmResult.ok) {
      return { ...glmResult, metadata: { ...(glmResult.metadata || {}), pages: parsed.numpages } };
    }

    // 2) Fallback: Tesseract clásico
    const ocrResult = await ocrPdfViaImages(filePath);
    if (ocrResult.ok) {
      return { ...ocrResult, metadata: { ...(ocrResult.metadata || {}), pages: parsed.numpages } };
    }

    // 3) Fallback: modelo VL
    const visionResult = await extractPdfViaVision(filePath, parsed.numpages);
    if (visionResult.ok) return visionResult;

    return fail('pdf-escaneado-sin-ocr',
      'PDF escaneado sin texto extraíble. Ni glm-ocr ni Tesseract pudieron extraer texto.',
      { pages: parsed.numpages });

  } catch (err) {
    return fail('pdf-error', `Error leyendo PDF: ${err.message}`);
  }
}

// ── Imágenes ───────────────────────────────────────────────────────────────

async function extractImage(filePath, mime, ext) {
  // 1) Intentar OCR dedicado con glm-ocr (mejor para documentos escaneados)
  const glmResult = await glmOcrImage(filePath);
  if (glmResult && glmResult.ok) {
    return glmResult;
  }

  // 2) Intentar VL como fallback
    try {
      const text = await visionExtract(filePath, mime || extToMime(ext));
      if (text && text.length > 10) {
        return ok(text, 'vision-vl', { has_images: true });
      }
    } catch (err) {
      console.warn(`[EXTRACTOR] Visión VL falló: ${err.message}, intentando Tesseract`);
    }

  // 3) Fallback: Tesseract
  return ocrImage(filePath);
}

// ── XLSX / XLS / ODS (hojas de cálculo) ───────────────────────────────────

async function extractSpreadsheet(filePath, ext) {
  try {
    const { default: XLSX } = await import('xlsx');

    const workbook = XLSX.readFile(filePath, {
      type:       'file',
      cellText:   true,
      cellDates:  true,
      dense:      false,
    });

    const sheetNames = workbook.SheetNames;
    const parts      = [];
    let   totalRows  = 0;
    let   hasTables  = false;

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows  = XLSX.utils.sheet_to_json(sheet, {
        header:     1,
        defval:     '',
        blankrows:  false,
      });

      if (!rows || rows.length === 0) continue;
      hasTables = true;
      totalRows += rows.length;

      // Convertir a tabla de texto con separadores
      const tableLines = rows.map(row =>
        '| ' + row.map(cell => String(cell ?? '').replace(/\n/g, ' ').trim()).join(' | ') + ' |'
      );

      parts.push(`=== Hoja: ${sheetName} ===\n${tableLines.join('\n')}`);
    }

    if (parts.length === 0) {
      return fail('xlsx-vacio', 'El archivo no contiene datos en ninguna hoja');
    }

    const text = parts.join('\n\n');
    return ok(text, 'xlsx', {
      sheets:     sheetNames.length,
      has_tables: hasTables,
      rows_total: totalRows,
    });

  } catch (err) {
    return fail('xlsx-error', `Error leyendo hoja de cálculo: ${err.message}`);
  }
}

// ── DOCX ──────────────────────────────────────────────────────────────────

async function extractDocx(filePath) {
  try {
    const { default: AdmZip } = await import('adm-zip');
    const zip   = new AdmZip(filePath);

    // Extraer document.xml principal
    const docEntry = zip.getEntry('word/document.xml');
    if (!docEntry) return fail('docx-sin-documento', 'No se encontró word/document.xml en el DOCX');

    const xml  = docEntry.getData().toString('utf8');
    const text = cleanText(xmlToText(xml));

    // Intentar extraer también pies de página y encabezados
    const extras = [];
    const extraEntries = zip.getEntries().filter(e =>
      e.entryName.startsWith('word/header') || e.entryName.startsWith('word/footer')
    );
    for (const e of extraEntries) {
      const eText = cleanText(xmlToText(e.getData().toString('utf8')));
      if (eText.length > 5) extras.push(eText);
    }

    const fullText = [text, ...extras].join('\n').trim();

    return ok(fullText || text, 'docx', {
      has_tables: xml.includes('<w:tbl'),
      has_images: xml.includes('w:drawing') || xml.includes('v:imagedata'),
    });

  } catch (err) {
    return fail('docx-error', `Error leyendo DOCX: ${err.message}`);
  }
}

// ── DOC (formato binario antiguo) ─────────────────────────────────────────

async function extractDocLegacy(filePath) {
  // Intentar con antiword si está disponible
  try {
    const { stdout } = await execAsync('antiword', [filePath], { timeout: 30_000 });
    const text = cleanText(stdout);
    if (text.length > 10) return ok(text, 'antiword', {});
  } catch { /* antiword no disponible, continuar */ }

  // Intentar con LibreOffice headless
  try {
    const tmpDir = await makeTempDir('doc');
    await execAsync('soffice', ['--headless', '--convert-to', 'txt:Text', '--outdir', tmpDir, filePath], { timeout: 60_000 });
    const files = await readdir(tmpDir);
    const txtFile = files.find(f => f.endsWith('.txt'));
    if (txtFile) {
      const text = cleanText(await readFile(path.join(tmpDir, txtFile), 'utf8'));
      await rm(tmpDir, { recursive: true }).catch(() => {});
      return ok(text, 'libreoffice-doc', {});
    }
    await rm(tmpDir, { recursive: true }).catch(() => {});
  } catch { /* LibreOffice no disponible */ }

  // Último recurso: leer bytes e intentar extraer texto ASCII/UTF-8
  try {
    const buf    = await readFile(filePath);
    const text   = cleanText(buf.toString('latin1').replace(/[^\x20-\x7E\n\r\t\xA0-\xFF]/g, ' ').replace(/ {3,}/g, ' '));
    if (text.length > 50) return ok(text, 'doc-raw-text', { warning: 'extracción parcial del binario' });
  } catch { /* ignorar */ }

  return fail('doc-no-soportado', 'Formato DOC binario no soportado. Convierte a DOCX o instala antiword/LibreOffice');
}

// ── ODT (OpenDocument Text) ───────────────────────────────────────────────

async function extractOdt(filePath) {
  try {
    const { default: AdmZip } = await import('adm-zip');
    const zip     = new AdmZip(filePath);
    const content = zip.getEntry('content.xml');
    if (!content) return fail('odt-sin-content', 'No se encontró content.xml en el ODT');

    const xml  = content.getData().toString('utf8');
    const text = cleanText(xmlToText(xml));

    return ok(text, 'odt', {
      has_tables: xml.includes('table:table'),
      has_images: xml.includes('draw:image'),
    });
  } catch (err) {
    return fail('odt-error', `Error leyendo ODT: ${err.message}`);
  }
}

// ── PPTX ──────────────────────────────────────────────────────────────────

async function extractPptx(filePath) {
  try {
    const { default: AdmZip } = await import('adm-zip');
    const zip = new AdmZip(filePath);

    // Slides están en ppt/slides/slide1.xml, slide2.xml, ...
    const slideEntries = zip.getEntries()
      .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
      .sort((a, b) => {
        const na = parseInt(a.entryName.match(/\d+/)?.[0] || 0);
        const nb = parseInt(b.entryName.match(/\d+/)?.[0] || 0);
        return na - nb;
      });

    if (slideEntries.length === 0) {
      return fail('pptx-sin-slides', 'No se encontraron slides en el PPTX');
    }

    const parts = [];
    for (let i = 0; i < slideEntries.length; i++) {
      const xml  = slideEntries[i].getData().toString('utf8');
      const text = cleanText(xmlToText(xml));
      if (text.length > 2) {
        parts.push(`--- Slide ${i + 1} ---\n${text}`);
      }
    }

    return ok(parts.join('\n\n'), 'pptx', {
      slides:     slideEntries.length,
      has_images: zip.getEntries().some(e => e.entryName.startsWith('ppt/media/')),
    });

  } catch (err) {
    return fail('pptx-error', `Error leyendo PPTX: ${err.message}`);
  }
}

// ── PPT (antiguo) ─────────────────────────────────────────────────────────

async function extractPptLegacy(filePath) {
  // Intentar con LibreOffice headless
  try {
    const tmpDir = await makeTempDir('ppt');
    await execAsync('soffice', ['--headless', '--convert-to', 'txt:Text', '--outdir', tmpDir, filePath], { timeout: 60_000 });
    const files   = await readdir(tmpDir);
    const txtFile = files.find(f => f.endsWith('.txt'));
    if (txtFile) {
      const text = cleanText(await readFile(path.join(tmpDir, txtFile), 'utf8'));
      await rm(tmpDir, { recursive: true }).catch(() => {});
      return ok(text, 'libreoffice-ppt', {});
    }
    await rm(tmpDir, { recursive: true }).catch(() => {});
  } catch { /* LibreOffice no disponible */ }

  return fail('ppt-no-soportado', 'Formato PPT binario no soportado. Convierte a PPTX o instala LibreOffice');
}

// ── ODP (OpenDocument Presentation) ──────────────────────────────────────

async function extractOdp(filePath) {
  try {
    const { default: AdmZip } = await import('adm-zip');
    const zip     = new AdmZip(filePath);
    const content = zip.getEntry('content.xml');
    if (!content) return fail('odp-sin-content', 'No se encontró content.xml en el ODP');

    const xml  = content.getData().toString('utf8');
    // Extraer texto de cada página/diapositiva
    const pageMatches = xml.match(/<draw:page[^>]*>([\s\S]*?)<\/draw:page>/g) || [];
    const parts = pageMatches.map((page, i) => {
      const text = cleanText(xmlToText(page));
      return text.length > 2 ? `--- Diapositiva ${i + 1} ---\n${text}` : null;
    }).filter(Boolean);

    const fullText = parts.length > 0 ? parts.join('\n\n') : cleanText(xmlToText(xml));

    return ok(fullText, 'odp', {
      slides:     pageMatches.length || undefined,
      has_images: xml.includes('draw:image'),
    });
  } catch (err) {
    return fail('odp-error', `Error leyendo ODP: ${err.message}`);
  }
}

// ── ZIP ────────────────────────────────────────────────────────────────────

async function extractZip(filePath) {
  try {
    const { default: AdmZip } = await import('adm-zip');
    const zip      = new AdmZip(filePath);
    const entries  = zip.getEntries().filter(e => !e.isDirectory);
    const manifest = [];
    const parts    = [];
    let   errors   = 0;

    console.log(`[EXTRACTOR] ZIP: ${entries.length} archivos`);

    // Extraer a directorio temporal y procesar recursivamente
    const tmpDir = await makeTempDir('zip');

    try {
      zip.extractAllTo(tmpDir, true);

      for (const entry of entries) {
        const entryPath = path.join(tmpDir, entry.entryName);
        const entryExt  = path.extname(entry.name).toLowerCase();
        const entrySize = entry.header?.size || 0;

        manifest.push({ name: entry.entryName, size: entrySize, ext: entryExt });

        // Solo procesar archivos no vacíos con extensiones conocidas
        if (entrySize === 0 || !isExtractableExt(entryExt)) continue;

        // Procesamiento recursivo del archivo contenido
        const subResult = await extract(entryPath, '', entry.name);
        if (subResult.ok && subResult.text?.length > 5) {
          parts.push(`\n=== ${entry.entryName} ===\n${subResult.text}`);
        } else if (!subResult.ok) {
          errors++;
          parts.push(`\n=== ${entry.entryName} ===\n[Error: ${subResult.error}]`);
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true }).catch(() => {});
    }

    const text = `Contenido del archivo ZIP (${entries.length} archivos):\n${manifest.map(e => `  - ${e.name} (${formatBytes(e.size)})`).join('\n')}${parts.join('')}`;

    return ok(text, 'zip-recursive', {
      file_count: entries.length,
      errors,
      manifest:   manifest.map(e => e.name),
    });

  } catch (err) {
    return fail('zip-error', `Error abriendo ZIP: ${err.message}`);
  }
}

// ── RAR ────────────────────────────────────────────────────────────────────

async function extractRar(filePath) {
  try {
    // Listar contenidos con unrar
    const { stdout: listOut } = await execAsync('unrar', ['l', filePath], { timeout: 30_000 });
    const lines    = listOut.split('\n');
    const manifest = lines.filter(l => l.match(/^\s+\d/)).map(l => l.trim().split(/\s+/).pop()).filter(Boolean);

    const tmpDir = await makeTempDir('rar');
    const parts  = [];

    try {
      await execAsync('unrar', ['x', '-o+', filePath, tmpDir + '/'], { timeout: 120_000 });

      for (const name of manifest) {
        const entryPath = path.join(tmpDir, name);
        if (!existsSync(entryPath)) continue;
        const entryExt = path.extname(name).toLowerCase();
        if (!isExtractableExt(entryExt)) continue;

        const subResult = await extract(entryPath, '', name);
        if (subResult.ok && subResult.text?.length > 5) {
          parts.push(`\n=== ${name} ===\n${subResult.text}`);
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true }).catch(() => {});
    }

    const text = `Contenido del archivo RAR (${manifest.length} archivos):\n${manifest.map(n => `  - ${n}`).join('\n')}${parts.join('')}`;
    return ok(text, 'rar-recursive', { file_count: manifest.length });

  } catch (err) {
    // unrar no instalado o error
    if (err.message.includes('not found') || err.code === 'ENOENT') {
      return fail('rar-no-unrar', 'unrar no instalado. Instala con: brew install rar');
    }
    return fail('rar-error', `Error abriendo RAR: ${err.message}`);
  }
}

// ── 7Z ────────────────────────────────────────────────────────────────────

async function extract7z(filePath) {
  try {
    const tmpDir = await makeTempDir('7z');
    const parts  = [];
    let   manifest = [];

    try {
      // Extraer con 7z (p7zip)
      await execAsync('7z', ['x', filePath, `-o${tmpDir}`, '-y'], { timeout: 120_000 });

      // Listar archivos extraídos recursivamente
      manifest = await listFilesRecursive(tmpDir);

      for (const entryPath of manifest) {
        const entryName = path.relative(tmpDir, entryPath);
        const entryExt  = path.extname(entryPath).toLowerCase();
        if (!isExtractableExt(entryExt)) continue;

        const subResult = await extract(entryPath, '', entryName);
        if (subResult.ok && subResult.text?.length > 5) {
          parts.push(`\n=== ${entryName} ===\n${subResult.text}`);
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true }).catch(() => {});
    }

    const names = manifest.map(f => path.relative(tmpDir.replace(/[^/]+$/, ''), f));
    const text  = `Contenido del archivo 7Z (${manifest.length} archivos):\n${names.map(n => `  - ${n}`).join('\n')}${parts.join('')}`;
    return ok(text, '7z-recursive', { file_count: manifest.length });

  } catch (err) {
    if (err.message.includes('not found') || err.code === 'ENOENT') {
      return fail('7z-no-binary', '7z no instalado. Instala con: brew install p7zip');
    }
    return fail('7z-error', `Error abriendo 7Z: ${err.message}`);
  }
}

// ── TAR / TAR.GZ ──────────────────────────────────────────────────────────

async function extractTar(filePath, ext) {
  try {
    const tmpDir = await makeTempDir('tar');
    const flag   = (ext === '.gz' || ext === '.tgz' || filePath.endsWith('.tar.gz')) ? 'xzf' : 'xf';
    const parts  = [];
    let   manifest = [];

    try {
      await execAsync('tar', [flag, filePath, '-C', tmpDir], { timeout: 120_000 });
      manifest = await listFilesRecursive(tmpDir);

      for (const entryPath of manifest) {
        const entryName = path.relative(tmpDir, entryPath);
        const entryExt  = path.extname(entryPath).toLowerCase();
        if (!isExtractableExt(entryExt)) continue;

        const subResult = await extract(entryPath, '', entryName);
        if (subResult.ok && subResult.text?.length > 5) {
          parts.push(`\n=== ${entryName} ===\n${subResult.text}`);
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true }).catch(() => {});
    }

    const text = `Contenido del archivo TAR (${manifest.length} archivos):\n${manifest.map(f => `  - ${path.relative(tmpDir, f)}`).join('\n')}${parts.join('')}`;
    return ok(text, 'tar-recursive', { file_count: manifest.length });

  } catch (err) {
    return fail('tar-error', `Error abriendo TAR: ${err.message}`);
  }
}

// ── EML (email en texto) ──────────────────────────────────────────────────

async function extractEml(filePath) {
  try {
    const raw  = await readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);

    // Parsear cabeceras
    const headers = {};
    let bodyStart = false;
    let bodyLines = [];
    let boundary  = null;

    for (const line of lines) {
      if (!bodyStart) {
        if (line.trim() === '') { bodyStart = true; continue; }
        const m = line.match(/^([A-Za-z\-]+):\s*(.+)/);
        if (m) {
          const key = m[1].toLowerCase();
          headers[key] = m[2].trim();
          // Detectar boundary para partes MIME
          if (key === 'content-type' && m[2].includes('boundary=')) {
            const bm = m[2].match(/boundary="?([^";]+)"?/i);
            if (bm) boundary = bm[1];
          }
        }
      } else {
        bodyLines.push(line);
      }
    }

    // Extraer texto del body (decodificar quoted-printable básico)
    let bodyText = bodyLines.join('\n');
    bodyText = decodeQuotedPrintable(bodyText);

    // Eliminar partes binarias (adjuntos base64)
    bodyText = bodyText.replace(/Content-Transfer-Encoding:\s*base64[\s\S]*?(?=--|\z)/gi, '[adjunto base64]');

    // Limpiar etiquetas HTML si el body es HTML
    if ((headers['content-type'] || '').includes('html') || bodyText.includes('<html')) {
      bodyText = htmlToText(bodyText);
    }

    // Detectar adjuntos
    const attachmentMatches = raw.match(/Content-Disposition:\s*attachment;?\s*filename="?([^"\n]+)"?/gi) || [];
    const attachments = attachmentMatches.map(m => m.match(/filename="?([^"\n"]+)"?/i)?.[1]).filter(Boolean);

    const header = [
      `De: ${headers['from'] || '(desconocido)'}`,
      `Para: ${headers['to'] || '(desconocido)'}`,
      `CC: ${headers['cc'] || ''}`,
      `Asunto: ${headers['subject'] || '(sin asunto)'}`,
      `Fecha: ${headers['date'] || ''}`,
      `Message-ID: ${headers['message-id'] || ''}`,
      attachments.length > 0 ? `Adjuntos: ${attachments.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const text = cleanText(`${header}\n\n--- Cuerpo ---\n${bodyText}`);

    return ok(text, 'eml', {
      has_attachments: attachments.length > 0,
      attachment_count: attachments.length,
      attachment_names: attachments,
      subject: headers['subject'],
      from:    headers['from'],
    });

  } catch (err) {
    return fail('eml-error', `Error leyendo EML: ${err.message}`);
  }
}

// ── MSG (Outlook) ─────────────────────────────────────────────────────────

async function extractMsg(filePath) {
  // Intentar con msg-reader o leer como stream binario buscando cadenas legibles
  try {
    // Intentar usar node-msg si está instalado
    const { default: MsgReader } = await import('@kenjiuno/msgreader').catch(() => ({ default: null }));
    if (MsgReader) {
      const buf    = await readFile(filePath);
      const reader = new MsgReader(buf);
      const msg    = reader.getFileData();

      const text = cleanText([
        `De: ${msg.senderName || ''} <${msg.senderEmail || ''}>`,
        `Para: ${(msg.recipients || []).map(r => r.name || r.email).join(', ')}`,
        `Asunto: ${msg.subject || ''}`,
        `Fecha: ${msg.creationTime || ''}`,
        '',
        '--- Cuerpo ---',
        msg.body || msg.bodyHtml ? htmlToText(msg.bodyHtml || '') || msg.body : '',
        msg.attachments?.length ? `\nAdjuntos: ${msg.attachments.map(a => a.fileName).join(', ')}` : '',
      ].join('\n'));

      return ok(text, 'msg-msgreader', {
        has_attachments:  (msg.attachments?.length || 0) > 0,
        attachment_count: msg.attachments?.length || 0,
      });
    }
  } catch { /* módulo no disponible */ }

  // Fallback: extraer strings legibles del binario
  try {
    const buf  = await readFile(filePath);
    const text = extractReadableStrings(buf);
    if (text.length > 30) {
      return ok(text, 'msg-strings', { warning: 'extracción parcial del binario MSG' });
    }
  } catch { /* ignorar */ }

  return fail('msg-no-soportado', 'Formato MSG de Outlook. Instala @kenjiuno/msgreader: npm install @kenjiuno/msgreader');
}

// ── HTML / MHTML ──────────────────────────────────────────────────────────

async function extractHtml(filePath) {
  try {
    const raw  = await readFile(filePath, 'utf8');
    const text = cleanText(htmlToText(raw));

    return ok(text, 'html', {
      has_images: /<img\s/i.test(raw),
      has_tables: /<table\s/i.test(raw),
    });
  } catch (err) {
    return fail('html-error', `Error leyendo HTML: ${err.message}`);
  }
}

// ── RTF ────────────────────────────────────────────────────────────────────

async function extractRtf(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');

    // Eliminar bloques de control RTF y extraer solo texto plano
    let text = raw
      .replace(/\{\\[^{}]+\}/g, '')          // eliminar grupos de control {\ ... }
      .replace(/\\[a-zA-Z]+\d*/g, ' ')        // eliminar palabras de control \word
      .replace(/\{|\}/g, '')                   // eliminar llaves
      .replace(/\\\*/g, '')                    // eliminar \*
      .replace(/\\'/g, '')                     // eliminar \' (caracteres especiales hex)
      .replace(/\\\n/g, '\n')                  // saltos de línea RTF
      .replace(/\\par\b/gi, '\n')              // párrafos RTF
      .replace(/\\line\b/gi, '\n')             // líneas RTF
      .replace(/\\tab\b/gi, '\t');             // tabulaciones RTF

    text = cleanText(text);

    if (text.length > 10) {
      return ok(text, 'rtf', {});
    }

    // Si la extracción básica falla, intentar con LibreOffice
    try {
      const tmpDir  = await makeTempDir('rtf');
      await execAsync('soffice', ['--headless', '--convert-to', 'txt:Text', '--outdir', tmpDir, filePath], { timeout: 30_000 });
      const files   = await readdir(tmpDir);
      const txtFile = files.find(f => f.endsWith('.txt'));
      if (txtFile) {
        const loText = cleanText(await readFile(path.join(tmpDir, txtFile), 'utf8'));
        await rm(tmpDir, { recursive: true }).catch(() => {});
        if (loText.length > 10) return ok(loText, 'libreoffice-rtf', {});
      }
      await rm(tmpDir, { recursive: true }).catch(() => {});
    } catch { /* ignorar */ }

    return fail('rtf-sin-texto', 'No se pudo extraer texto del RTF');

  } catch (err) {
    return fail('rtf-error', `Error leyendo RTF: ${err.message}`);
  }
}

// ── Texto plano / código ──────────────────────────────────────────────────

async function extractText(filePath, ext, isFallback = false) {
  try {
    // Intentar UTF-8 primero
    let raw;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch {
      // Fallback a latin1 si falla UTF-8
      raw = await readFile(filePath, 'latin1');
    }

    const text     = cleanText(raw);
    const lang     = detectCodeLanguage(ext);
    const encoding = detectEncoding(raw);

    // Parsear estructuras especiales para mejor representación
    if (ext === '.json') {
      try {
        const parsed = JSON.parse(raw);
        const pretty = JSON.stringify(parsed, null, 2);
        return ok(cleanText(pretty), 'json', { encoding, language_hint: 'json' });
      } catch { /* usar texto raw */ }
    }

    if (ext === '.csv' || ext === '.tsv') {
      const sep  = ext === '.tsv' ? '\t' : detectCsvSeparator(raw);
      const rows = raw.split(/\r?\n/).filter(Boolean).map(r => r.split(sep));
      const table = rows.map(row => '| ' + row.map(c => c.trim()).join(' | ') + ' |').join('\n');
      return ok(cleanText(table), 'csv', { encoding, has_tables: true, rows: rows.length });
    }

    return ok(text, isFallback ? 'texto-fallback' : 'texto', {
      encoding,
      language_hint: lang || undefined,
    });

  } catch (err) {
    return fail('texto-error', `Error leyendo archivo de texto: ${err.message}`);
  }
}

// ── ICS (calendario) ──────────────────────────────────────────────────────

async function extractIcs(filePath) {
  try {
    const raw    = await readFile(filePath, 'utf8');
    const events = [];

    // Extraer bloques VEVENT
    const eventBlocks = raw.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

    for (const block of eventBlocks) {
      const get = (key) => {
        const m = block.match(new RegExp(`^${key}[^:]*:(.+)`, 'm'));
        return m ? m[1].trim() : null;
      };
      events.push({
        titulo:      get('SUMMARY'),
        inicio:      get('DTSTART'),
        fin:         get('DTEND'),
        descripcion: get('DESCRIPTION'),
        ubicacion:   get('LOCATION'),
        organizador: get('ORGANIZER'),
        uid:         get('UID'),
      });
    }

    const lines = events.map((e, i) =>
      `Evento ${i + 1}: ${e.titulo || '(sin título)'}\n` +
      `  Inicio: ${formatIcsDate(e.inicio)}\n` +
      `  Fin: ${formatIcsDate(e.fin)}\n` +
      (e.ubicacion    ? `  Ubicación: ${e.ubicacion}\n`   : '') +
      (e.descripcion  ? `  Descripción: ${e.descripcion.replace(/\\n/g, ' ').slice(0, 200)}\n` : '') +
      (e.organizador  ? `  Organizador: ${e.organizador}\n` : '')
    );

    const calName = raw.match(/^X-WR-CALNAME:(.+)/m)?.[1]?.trim();
    const header  = calName ? `Calendario: ${calName}\n\n` : '';

    const text = cleanText(`${header}${lines.join('\n')}`);

    return ok(text, 'ics', {
      event_count: events.length,
    });

  } catch (err) {
    return fail('ics-error', `Error leyendo ICS: ${err.message}`);
  }
}

// ── OFX / QFX (banca online) ──────────────────────────────────────────────

async function extractOfx(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');

    // OFX puede ser SGML (antiguo) o XML (nuevo)
    const isXml = raw.trimStart().startsWith('<?xml') || raw.includes('<OFX>');

    let text;
    if (isXml) {
      // Limpiar etiquetas y extraer texto
      text = cleanText(raw.replace(/<[^>]+>/g, ' '));
    } else {
      // Formato SGML: pares TAG:VALUE
      const lines = raw.split(/\r?\n/);
      const parts = [];
      for (const line of lines) {
        const m = line.match(/^<([A-Z]+)>(.+)/);
        if (m) parts.push(`${m[1]}: ${m[2].trim()}`);
      }
      text = cleanText(parts.join('\n'));
    }

    // Extraer transacciones
    const txMatches = raw.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) ||
                      raw.match(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/g) || [];

    const txCount = txMatches.length;

    return ok(text, 'ofx', {
      transaction_count: txCount,
      has_tables: txCount > 0,
    });

  } catch (err) {
    return fail('ofx-error', `Error leyendo OFX: ${err.message}`);
  }
}

// ── QIF (Quicken) ─────────────────────────────────────────────────────────

async function extractQif(filePath) {
  try {
    const raw   = await readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);

    const transactions = [];
    let   current      = {};

    for (const line of lines) {
      if (line.startsWith('D'))      current.fecha     = line.slice(1).trim();
      else if (line.startsWith('T')) current.importe   = line.slice(1).trim();
      else if (line.startsWith('P')) current.beneficiario = line.slice(1).trim();
      else if (line.startsWith('M')) current.memo      = line.slice(1).trim();
      else if (line.startsWith('L')) current.categoria = line.slice(1).trim();
      else if (line === '^') {
        if (current.fecha || current.importe) transactions.push({ ...current });
        current = {};
      }
    }

    const header = `Archivo QIF: ${transactions.length} transacciones\n\n`;
    const rows   = transactions.map(t =>
      `${t.fecha || ''} | ${t.importe || ''} | ${t.beneficiario || ''} | ${t.memo || ''} | ${t.categoria || ''}`
    ).join('\n');

    return ok(cleanText(header + rows), 'qif', {
      transaction_count: transactions.length,
      has_tables: transactions.length > 0,
    });

  } catch (err) {
    return fail('qif-error', `Error leyendo QIF: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  OCR — TESSERACT
// ═══════════════════════════════════════════════════════════════════════════

/** OCR directo sobre un archivo de imagen */
async function ocrImage(filePath) {
  const tesseract = detectTesseract();
  if (!tesseract) {
    return fail('ocr-no-tesseract', 'Tesseract no instalado. Instala con: brew install tesseract tesseract-lang');
  }

  try {
    const lang = detectTesseractLang();
    const { stdout } = await execAsync(
      tesseract,
      [filePath, 'stdout', '-l', lang, '--dpi', '300', '--psm', '1'],
      { timeout: 90_000 }
    );
    const text = cleanText(stdout);

    if (text.length > 10) {
      return ok(text, 'tesseract', { language_hint: lang });
    }
    return fail('ocr-sin-texto', 'OCR no encontró texto legible en la imagen');

  } catch (err) {
    return fail('ocr-error', `Error de OCR: ${err.message}`);
  }
}

/** OCR de PDF escaneado: pdftoppm → imágenes → Tesseract */
async function ocrPdfViaImages(filePath) {
  const tesseract = detectTesseract();
  if (!tesseract) {
    return fail('ocr-no-tesseract', 'Tesseract no instalado. brew install tesseract tesseract-lang poppler');
  }

  const tmpDir = await makeTempDir('pdfocr');
  try {
    const prefix = path.join(tmpDir, 'page');

    // Convertir PDF a imágenes PNG
    await execAsync('pdftoppm', ['-png', '-r', '300', '-l', '15', filePath, prefix], { timeout: 120_000 });

    const files = (await readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
    if (files.length === 0) {
      return fail('ocr-pdf-sin-imagenes', 'pdftoppm no generó imágenes. Instala poppler: brew install poppler');
    }

    const lang      = detectTesseractLang();
    const pageTexts = [];

    for (const file of files) {
      try {
        const imgPath = path.join(tmpDir, file);
        const { stdout } = await execAsync(
          tesseract,
          [imgPath, 'stdout', '-l', lang, '--dpi', '300', '--psm', '1'],
          { timeout: 90_000 }
        );
        const text = cleanText(stdout);
        if (text.length > 5) pageTexts.push(text);
      } catch { /* continuar con siguiente página */ }
    }

    const fullText = pageTexts.join('\n\n--- Página ---\n\n');

    if (fullText.length > 20) {
      console.log(`[EXTRACTOR] OCR: ${files.length} páginas → ${fullText.length} chars`);
      return ok(fullText, 'tesseract-pdf', {
        pages:         files.length,
        language_hint: lang,
      });
    }

    return fail('ocr-pdf-sin-texto', 'OCR no encontró texto legible en el PDF escaneado');

  } catch (err) {
    return fail('ocr-pdf-error', `Error en OCR de PDF: ${err.message}`);
  } finally {
    await rm(tmpDir, { recursive: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  OCR DEDICADO — GLM-OCR (via Ollama)
//  Modelo ligero (0.9B params), #1 en OmniDocBench, ~1.86 pag/s en M4 Pro
//  Protocolo: /api/chat con imagen base64 y prompt "Text recognition:"
// ═══════════════════════════════════════════════════════════════════════════

/** OCR de una sola imagen con glm-ocr vía Ollama o LM Studio */
async function glmOcrImage(filePath) {
  try {
    const buf    = await readFile(filePath);
    const base64 = buf.toString('base64');
    const model  = getOcrModel();

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 300_000);

    try {
      let text;

      if (isLMStudio()) {
        // LM Studio — API OpenAI-compatible
        const response = await fetch(`${getOcrEndpoint()}/v1/chat/completions`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(LMSTUDIO_KEY ? { 'Authorization': `Bearer ${LMSTUDIO_KEY}` } : {}),
          },
          signal:  controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'user', content: [
                { type: 'text', text: 'Text recognition:' },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
              ]},
            ],
            stream: false,
            temperature: 0,
            max_tokens: 2048,
            num_ctx: parseInt(process.env.NUM_CTX || '16384', 10),
          }),
        });
        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          throw new Error(`LMStudio ${response.status}: ${errBody.slice(0, 200)}`);
        }
        const data = await response.json();
        text = cleanText(data.choices?.[0]?.message?.content || '');
      } else {
        // Ollama — API nativa
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          signal:  controller.signal,
          body:    JSON.stringify({
            model,
            stream: false,
            messages: [{
              role: 'user',
              content:  'Text recognition:',
              images:   [base64],
            }],
            options: {
              num_ctx: 16384,
              temperature: 0,
            },
          }),
        });
        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          throw new Error(`Ollama ${response.status}: ${errBody.slice(0, 200)}`);
        }
        const data = await response.json();
        text = cleanText(data?.message?.content || '');
      }

      if (text.length > 10) {
        return ok(text, isLMStudio() ? 'glm-ocr-lmstudio' : 'glm-ocr', { ocr_model: model, provider: isLMStudio() ? 'lmstudio' : 'ollama' });
      }
      return null;

    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn(`[EXTRACTOR] glm-ocr falló (${isLMStudio() ? 'lmstudio' : 'ollama'}): ${err.message}`);
    return null;
  }
}

/** OCR de PDF escaneado: pdftoppm → imágenes → glm-ocr (página a página) */
async function ocrPdfViaGlm(filePath) {
  const tmpDir = await makeTempDir('pdfglm');
  try {
    const prefix = path.join(tmpDir, 'page');

    // Convertir PDF a imágenes PNG a 200 DPI (balance calidad/tamaño para OCR, máx 15 páginas)
    await execAsync('pdftoppm', ['-png', '-r', '200', '-l', '15', filePath, prefix], { timeout: 120_000 });

    const files = (await readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
    if (files.length === 0) {
      return null; // pdftoppm no disponible, fallback
    }

    console.log(`[EXTRACTOR] glm-ocr: procesando ${files.length} páginas...`);
    const pageTexts = [];

    for (const file of files) {
      try {
        const imgPath = path.join(tmpDir, file);
        const result  = await glmOcrImage(imgPath);
        if (result && result.ok && result.text.length > 5) {
          pageTexts.push(result.text);
        }
      } catch { /* continuar con siguiente página */ }
    }

    const fullText = pageTexts.join('\n\n--- Página ---\n\n');

    if (fullText.length > 20) {
      console.log(`[EXTRACTOR] glm-ocr: ${files.length} páginas → ${fullText.length} chars`);
      return ok(fullText, 'glm-ocr-pdf', {
        pages:     files.length,
        ocr_model: OCR_MODEL,
      });
    }

    return null; // texto insuficiente, fallback

  } catch (err) {
    console.warn(`[EXTRACTOR] glm-ocr PDF falló: ${err.message}`);
    return null;
  } finally {
    await rm(tmpDir, { recursive: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  VISIÓN — OCR VIA VISIÓN (Ollama VL o LM Studio)
// ═══════════════════════════════════════════════════════════════════════════

/** Envía una imagen al modelo VL y devuelve el texto extraído */
async function visionExtract(filePath, mime) {
  const buf    = await readFile(filePath);
  const base64 = buf.toString('base64');
  const url    = `data:${mime};base64,${base64}`;
  const model  = getOcrModel();

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 240_000);

  try {
    let content;

    if (isLMStudio()) {
      // LM Studio — OpenAI-compatible API
      const response = await fetch(`${getOcrEndpoint()}/v1/chat/completions`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(LMSTUDIO_KEY ? { 'Authorization': `Bearer ${LMSTUDIO_KEY}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.05,
          max_tokens: 3000,
          messages: [
            { role: 'system', content: 'Extrae todo el texto visible en esta imagen. Si es un documento, mantén la estructura. Responde solo con el texto, sin explicaciones.' },
            { role: 'user', content: [
              { type: 'text', text: 'Transcribe todo el texto de esta imagen:' },
              { type: 'image_url', image_url: { url } },
            ]},
          ],
        }),
      });
      if (!response.ok) throw new Error(`LMStudio VL ${response.status}`);
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    } else {
      // Ollama — API nativa
      const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body:    JSON.stringify({
          model,
          stream:      false,
          temperature: 0.05,
          max_tokens:  3000,
          messages: [
            { role: 'system', content: 'Extrae todo el texto visible en esta imagen. Si es un documento, mantén la estructura. Responde solo con el texto, sin explicaciones.' },
            { role: 'user', content: [
              { type: 'text', text: 'Transcribe todo el texto de esta imagen:' },
              { type: 'image_url', image_url: { url } },
            ]},
          ],
        }),
      });
      if (!response.ok) throw new Error(`Ollama VL ${response.status}`);
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }

    return content.trim();

  } finally {
    clearTimeout(timer);
  }
}

/** OCR de primera página de PDF vía visión VL */
async function extractPdfViaVision(filePath, totalPages) {
  const tmpDir = await makeTempDir('pdfvision');
  try {
    const prefix = path.join(tmpDir, 'page');
    await execAsync('pdftoppm', ['-png', '-r', '200', '-l', '3', filePath, prefix], { timeout: 60_000 });

    const files = (await readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
    if (files.length === 0) return fail('pdf-vision-sin-paginas', 'pdftoppm no generó imágenes');

    const pageTexts = [];
    for (const file of files.slice(0, 5)) {
      try {
        const text = await visionExtract(path.join(tmpDir, file), 'image/png');
        if (text.length > 10) pageTexts.push(text);
} catch { /* ignorar */ }
    }

    const fullText = pageTexts.join('\n\n--- Página ---\n\n');
    if (fullText.length > 10) {
      return ok(fullText, isLMStudio() ? 'vision-vl-pdf-lmstudio' : 'vision-vl-pdf', {
        pages: totalPages,
        provider: isLMStudio() ? 'lmstudio' : 'ollama',
      });
    }
    return fail('pdf-vision-sin-texto', 'Visión VL no extrajo texto del PDF');

  } finally {
    await rm(tmpDir, { recursive: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UTILIDADES DE TEXTO
// ═══════════════════════════════════════════════════════════════════════════

/** Limpia y normaliza texto extraído */
function cleanText(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ ]{4,}/g, '   ')
    .replace(/\n{5,}/g, '\n\n\n')
    .replace(/[^\S\n]{3,}/g, '  ')
    .trim();
}

/** Truncado inteligente: conserva cabecera + secciones inicial/final */
function smartTruncate(text, maxChars = 12_000) {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.55));
  const tail = text.slice(-Math.floor(maxChars * 0.35));
  return `${head}\n\n[...contenido truncado a ${maxChars} caracteres...]\n\n${tail}`;
}

/** Extrae texto de XML/HTML eliminando etiquetas */
function xmlToText(xml) {
  return (xml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    .replace(/&#\d+;/g,  ' ')
    .replace(/&[a-z]+;/g,' ');
}

/** Convierte HTML a texto plano (más elaborado que xmlToText) */
function htmlToText(html) {
  return (html || '')
    // Saltos de línea antes de ciertos bloques
    .replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Separadores de tabla
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    // Eliminar todos los tags
    .replace(/<[^>]+>/g, ' ')
    // Decodificar entidades HTML
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&[a-z]+;/g, ' ');
}

/** Decodificación básica de quoted-printable */
function decodeQuotedPrintable(text) {
  return (text || '')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Extrae strings ASCII legibles de un buffer binario (fallback MSG/DOC) */
function extractReadableStrings(buf, minLength = 5) {
  const result = [];
  let   current = '';

  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if ((c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13) {
      current += String.fromCharCode(c);
    } else {
      if (current.length >= minLength) result.push(current.trim());
      current = '';
    }
  }
  if (current.length >= minLength) result.push(current.trim());

  return result.filter(s => s.length > 0 && /[a-zA-Z]{2,}/.test(s)).join('\n');
}

/** Formatea fecha ICS (20231225T100000Z → 2023-12-25 10:00:00) */
function formatIcsDate(dateStr) {
  if (!dateStr) return '';
  const m = dateStr.replace(/[TZ]/g, '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return dateStr;
  return `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5] || '00'}:${m[6] || '00'}` : ''}`;
}

/** Detecta el separador de CSV */
function detectCsvSeparator(raw) {
  const firstLine = raw.split(/\r?\n/)[0] || '';
  const counts    = { ',': 0, ';': 0, '|': 0 };
  for (const char of firstLine) {
    if (char in counts) counts[char]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Detecta el lenguaje de programación por extensión */
function detectCodeLanguage(ext) {
  const map = {
    '.js': 'javascript', '.ts': 'typescript', '.jsx': 'javascript', '.tsx': 'typescript',
    '.py': 'python', '.rb': 'ruby', '.go': 'go', '.java': 'java', '.cs': 'csharp',
    '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.rs': 'rust', '.swift': 'swift',
    '.kt': 'kotlin', '.sh': 'bash', '.bash': 'bash', '.zsh': 'zsh',
    '.sql': 'sql', '.php': 'php', '.r': 'r', '.m': 'matlab',
    '.json': 'json', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
    '.toml': 'toml', '.ini': 'ini', '.md': 'markdown', '.rst': 'rst',
  };
  return map[ext] || null;
}

/** Detección básica de encoding */
function detectEncoding(raw) {
  if (/[^\x00-\xFF]/.test(raw)) return 'utf-8';
  if (/[^\x00-\x7E]/.test(raw)) return 'latin1';
  return 'ascii';
}

/** Formatea bytes en forma legible */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][i]}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  UTILIDADES DE SISTEMA
// ═══════════════════════════════════════════════════════════════════════════

/** Detecta el binario de Tesseract disponible */
function detectTesseract() {
  for (const p of TESSERACT_PATHS) {
    if (existsSync(p)) return p;
  }
  // Devolver el nombre del comando y que el sistema lo busque en PATH
  return 'tesseract';
}

/** Verifica si Tesseract está disponible */
async function isTesseractAvailable() {
  const bin = detectTesseract();
  try {
    await execAsync(bin, ['--version'], { timeout: 5_000 });
    return bin;
  } catch {
    return null;
  }
}

/** Detecta si existe el paquete de idioma español de Tesseract */
function detectTesseractLang() {
  for (const p of TESSDATA_PATHS) {
    if (existsSync(p)) return 'spa+eng';
  }
  return 'eng';
}

/** Crea un directorio temporal único */
async function makeTempDir(prefix) {
  const dir = path.join('/tmp', `synkia_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Lista archivos recursivamente en un directorio */
async function listFilesRecursive(dir) {
  const results = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await listFilesRecursive(full));
      } else {
        results.push(full);
      }
    }
  } catch { /* ignorar errores de permisos */ }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLASIFICADORES DE EXTENSIÓN / MIME
// ═══════════════════════════════════════════════════════════════════════════

function isImageExt(ext) {
  return ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.bmp', '.gif', '.heic', '.heif', '.avif'].includes(ext);
}

function isSpreadsheetExt(ext) {
  return ['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods', '.csv'].includes(ext);
}

function isSpreadsheetMime(mime) {
  return mime.includes('spreadsheetml') || mime.includes('ms-excel') ||
         mime.includes('opendocument.spreadsheet') || mime.includes('vnd.ms-excel');
}

function isCodeOrTextExt(ext) {
  return [
    '.txt', '.log', '.md', '.rst', '.json', '.xml', '.yaml', '.yml',
    '.toml', '.ini', '.cfg', '.conf', '.env', '.sh', '.bash', '.zsh',
    '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.php', '.go', '.java',
    '.cs', '.cpp', '.c', '.h', '.rs', '.swift', '.kt', '.r', '.sql',
    '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
    '.graphql', '.proto', '.tf', '.hcl', '.dockerfile',
  ].includes(ext);
}

/** Extensiones que vale la pena extraer dentro de un archivo comprimido */
function isExtractableExt(ext) {
  return [
    // Documentos
    '.pdf', '.docx', '.doc', '.odt', '.pptx', '.ppt', '.odp', '.xlsx', '.xls', '.ods',
    // Texto y código
    '.txt', '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini',
    '.md', '.rst', '.log', '.html', '.htm', '.rtf',
    // Email
    '.eml', '.msg',
    // Imágenes
    '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp',
    // Código
    '.js', '.ts', '.py', '.sh', '.sql', '.rb', '.go', '.java', '.cs', '.php',
  ].includes(ext);
}

/** Convierte extensión a MIME type para imágenes */
function extToMime(ext) {
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
    '.tiff': 'image/tiff', '.tif': 'image/tiff',
    '.heic': 'image/heic', '.heif': 'image/heif',
  };
  return map[ext] || 'image/jpeg';
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONSTRUCTORES DE RESPUESTA
// ═══════════════════════════════════════════════════════════════════════════

/** Construye una respuesta exitosa */
function ok(text, method, meta = {}) {
  return {
    ok:       true,
    text:     text || '',
    method,
    metadata: {
      pages:       undefined,
      sheets:      undefined,
      slides:      undefined,
      file_count:  undefined,
      language_hint: undefined,
      has_tables:  false,
      has_images:  false,
      encoding:    undefined,
      ...Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)),
    },
  };
}

/** Construye una respuesta de error (nunca lanza excepción) */
function fail(method, error, meta = {}) {
  console.warn(`[EXTRACTOR] ✗ ${method}: ${error}`);
  return {
    ok:       false,
    text:     '',
    method,
    error,
    metadata: {
      pages: undefined, sheets: undefined, slides: undefined,
      file_count: undefined, language_hint: undefined,
      has_tables: false, has_images: false, encoding: undefined,
      ...meta,
    },
  };
}

// ─── Export por defecto también, por conveniencia ─────────────────────────
export default { extract };
