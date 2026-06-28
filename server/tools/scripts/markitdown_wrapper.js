// ════════════════════════════════════════════════════════
//  WRAPPER MARKITDOWN — Conversión unificada a Markdown
// ════════════════════════════════════════════════════════

import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process?.env?.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const MARKITDOWN_EXE = process?.env?.MARKITDOWN_EXE;

const execAsync = promisify(execFile);

/**
 * Convierte un archivo a Markdown usando MarkItDown.
 * Si falla, intenta fallback (pdftotext + Tesseract).
 */
export async function toMarkdown(file) {
  if (!file || !file.filePath || !MARKITDOWN_EXE) return null;

  try {
    const output = await execAsync(
      MARKITDOWN_EXE,
      [
        '--no-markdown', // Salto: queremos texto plano limpio, sin markdown en el output
        file.filePath,   // Entrada
      ],
      { encoding: 'utf8' }
    );

    return normalizeText(output);
  } catch (err) {
    console.error(`[MARKITDOWN] Error con ${file.original_name}:`, err.message);

    // ❌ FALLBACK: Extraer texto crudo + líneas de contexto
    try {
      const [pdftotext, tesseract] = await Promise.all([
        execAsync('pdftotext', ['-layout', file.filePath]),
        new Promise((res) => {
          // OCR si es imagen/PDF escaneado
          if (file.mime_type?.match(/image|pdf/i)) {
            execAsync('pdftoppm', [file.filePath, 'tmp'])
              .then(() => res(true))
              .catch(() => res(false));
          } else res(false);
        }),
      ]);

      return pdftotext.trim();
    } catch {
      return null; // Último recurso: devolver error estructurado
    }
  }
}

/** Limpia el texto crudo eliminando ruido */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';

  // Eliminar líneas muy largas de código (no son contenido del documento)
  const lines = text.split('\n');
  const clean = [];
  for (const line of lines) {
    // Mantener: texto legible, números, fechas, tablas simples
    if (/^[a-zA-Z0-9éíóúäöüèùàêîôûçñ\s.,!?():;\'\"\-=+]/.test(line)) {
      clean.push(line);
    } else if (line.trim().length < 80 && !/^\s*`/.test(line)) {
      // Línea corta razonable
      clean.push(line);
    }
  }

  return clean.join('\n').trim();
}

export default { toMarkdown };