/**
 * imageProcessor.js — Procesa imágenes (PNG, JPG, TIFF)
 * ======================================================
 * OCR con Tesseract.js si está disponible, fallback a metadata
 * Soporta procesamiento sin dependencias externas de C++
 */

import { execSync } from 'child_process';

/**
 * Detecta si es una imagen válida
 */
export function isImage(mimeType, filename) {
  const type = mimeType?.toLowerCase() || '';
  const fname = filename?.toLowerCase() || '';

  return (
    type.startsWith('image/') ||
    fname.match(/\.(png|jpg|jpeg|tiff|tif|webp|bmp|gif)$/i)
  );
}

/**
 * Procesa una imagen y extrae texto mediante OCR
 * Fallback robusto si Tesseract no está disponible
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} filename - Nombre original
 * @returns {Promise<{text: string, metadata: Object, method: string, success: boolean, error?: string}>}
 */
export async function processImage(buffer, filename) {
  const result = {
    text: '',
    metadata: extractImageMetadata(buffer),
    method: 'raw',
    success: false,
    error: null,
  };

  try {
    // Intento 1: Usar tesseract-ocr del sistema si está disponible
    try {
      const tempFile = `/tmp/img_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
      const { writeFileSync, unlinkSync } = await import('fs');
      writeFileSync(tempFile, buffer);

      try {
        // Verificar si tesseract está instalado
        execSync('which tesseract', { stdio: 'ignore' });

        // Usar tesseract vía CLI
        const text = execSync(`tesseract '${tempFile}' stdout 2>/dev/null`, {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 15000,
        });

        result.text = text.trim();
        result.method = 'tesseract-system';
        result.success = result.text.length > 10;
        unlinkSync(tempFile);
        return result;
      } catch {
        try { unlinkSync(tempFile); } catch {}
      }
    } catch {
      // No system tesseract, try npm module
    }

    // Intento 2: Usar tesseract.js (npm) si está instalado
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa', 1);
      const recognizeResult = await worker.recognize(buffer);
      result.text = recognizeResult.data.text;
      result.method = 'tesseract.js';
      result.success = result.text.trim().length > 10;
      await worker.terminate();
      return result;
    } catch (err) {
      // tesseract.js no disponible o error
      if (err.message?.includes('Cannot find module')) {
        // Module not installed, use fallback
      } else {
        console.warn('[OCR] Tesseract.js error:', err.message);
      }
    }

    // Fallback: Usar pytesseract vía python si está disponible
    try {
      const tempFile = `/tmp/img_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
      const { writeFileSync, unlinkSync } = await import('fs');
      writeFileSync(tempFile, buffer);

      try {
        const text = execSync(
          `python3 -c "import pytesseract; from PIL import Image; print(pytesseract.image_to_string(Image.open('${tempFile}')))" 2>/dev/null`,
          {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: 15000,
          }
        );

        result.text = text.trim();
        result.method = 'pytesseract';
        result.success = result.text.length > 10;
        unlinkSync(tempFile);
        return result;
      } catch {
        try { unlinkSync(tempFile); } catch {}
      }
    } catch {
      // Python no disponible
    }

    // Fallback final: Solo metadata, sin OCR
    result.text = '';
    result.method = 'metadata-only';
    result.success = Object.keys(result.metadata).length > 0;
    result.error = 'OCR no disponible (tesseract, tesseract.js o pytesseract no instalados)';
  } catch (err) {
    result.error = err.message;
    result.success = false;
  }

  return result;
}

/**
 * Extrae metadata básica de la imagen (sin OCR)
 * Rápido y sin dependencias
 */
function extractImageMetadata(buffer) {
  const metadata = {
    size: buffer.length,
    format: detectImageFormat(buffer),
  };

  // Intentar extraer EXIF si está disponible
  try {
    const { exifParser } = require('exif-parser');
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    if (result.tags) {
      metadata.exif = {
        width: result.tags.ImageWidth,
        height: result.tags.ImageHeight,
        make: result.tags.Make,
        model: result.tags.Model,
        dateTime: result.tags.DateTime,
        gpsLatitude: result.tags.GPSLatitude,
        gpsLongitude: result.tags.GPSLongitude,
      };
    }
  } catch {
    // EXIF no disponible, es normal
  }

  // Detectar dimensiones básicas de headers de imagen
  const dims = detectImageDimensions(buffer, metadata.format);
  if (dims) {
    metadata.width = dims.width;
    metadata.height = dims.height;
  }

  return metadata;
}

/**
 * Detecta el formato de imagen mirando la firma (magic bytes)
 */
function detectImageFormat(buffer) {
  if (buffer.length < 4) return 'unknown';

  const hex = buffer.slice(0, 4).toString('hex').toUpperCase();

  if (hex.startsWith('FFD8FF')) return 'JPEG';
  if (hex.startsWith('89504E47')) return 'PNG';
  if (hex.startsWith('49492A00') || hex.startsWith('4D4D002A')) return 'TIFF';
  if (hex.startsWith('47494638')) return 'GIF';
  if (hex.startsWith('52494646')) return 'WEBP'; // RIFF format

  return 'unknown';
}

/**
 * Intenta extraer dimensiones de imagen de los headers
 * Soporta PNG, JPEG básico, TIFF
 */
function detectImageDimensions(buffer, format) {
  try {
    if (format === 'PNG') {
      // PNG: width y height están en bytes 16-24
      if (buffer.length >= 24) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    } else if (format === 'JPEG') {
      // JPEG: buscar SOF (Start of Frame) marker
      for (let i = 2; i < Math.min(buffer.length, 50000); i++) {
        if (buffer[i] === 0xFF && (buffer[i + 1] & 0xF0) === 0xC0) {
          // Found SOF, dimensions at offset +5 y +7
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
      }
    }
  } catch {
    // Error extrayendo dimensiones
  }

  return null;
}

/**
 * Genera un thumbnail/preview de la imagen
 * Requiere Sharp si está disponible
 */
export async function generateThumbnail(buffer, maxWidth = 200, maxHeight = 200) {
  try {
    const sharp = await import('sharp');
    const thumbnail = await sharp.default(buffer)
      .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    return {
      success: true,
      buffer: thumbnail,
      method: 'sharp',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Sharp no disponible',
      method: 'none',
    };
  }
}
