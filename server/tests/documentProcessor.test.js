/**
 * documentProcessor.test.js — Test básico para DocumentProcessor
 * ==============================================================
 * Verifica que los procesadores se inicialicen correctamente
 * Requiere: npm test (si existe test runner configurado)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import {
  detectDocumentType,
  validateDocumentBuffer,
  processDocument,
  SUPPORTED_TYPES,
} from '../services/documentProcessor/universalProcessor.js';
import {
  isPDF,
  isExcel,
  isDocx,
  isImage,
} from '../services/documentProcessor/pdfProcessor.js';

describe('DocumentProcessor', () => {
  describe('Type Detection', () => {
    it('should detect PDF files', () => {
      assert.strictEqual(detectDocumentType('application/pdf', 'test.pdf'), 'pdf');
      assert.strictEqual(detectDocumentType('', 'test.pdf'), 'pdf');
    });

    it('should detect Excel files', () => {
      assert.strictEqual(
        detectDocumentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'data.xlsx'),
        'excel'
      );
      assert.strictEqual(detectDocumentType('', 'data.xlsx'), 'excel');
      assert.strictEqual(detectDocumentType('text/csv', 'data.csv'), 'excel');
    });

    it('should detect DOCX files', () => {
      assert.strictEqual(
        detectDocumentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'doc.docx'),
        'docx'
      );
      assert.strictEqual(detectDocumentType('', 'doc.docx'), 'docx');
    });

    it('should detect image files', () => {
      assert.strictEqual(detectDocumentType('image/png', 'image.png'), 'image');
      assert.strictEqual(detectDocumentType('image/jpeg', 'photo.jpg'), 'image');
      assert.strictEqual(detectDocumentType('', 'photo.jpg'), 'image');
    });

    it('should detect text files', () => {
      assert.strictEqual(detectDocumentType('text/plain', 'file.txt'), 'text');
      assert.strictEqual(detectDocumentType('', 'file.txt'), 'text');
    });

    it('should return unknown for unsupported types', () => {
      assert.strictEqual(detectDocumentType('application/unknown', 'file.xyz'), 'unknown');
    });
  });

  describe('Buffer Validation', () => {
    it('should reject empty buffers', () => {
      const validation = validateDocumentBuffer(Buffer.from(''), 'application/pdf', 'test.pdf');
      assert.strictEqual(validation.valid, false);
    });

    it('should reject non-Buffer objects', () => {
      const validation = validateDocumentBuffer('not a buffer', 'application/pdf', 'test.pdf');
      assert.strictEqual(validation.valid, false);
    });

    it('should reject unknown document types', () => {
      const validation = validateDocumentBuffer(Buffer.from('test'), 'application/unknown', 'test.xyz');
      assert.strictEqual(validation.valid, false);
    });

    it('should accept valid PDF buffer', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\ntest content');
      const validation = validateDocumentBuffer(pdfBuffer, 'application/pdf', 'test.pdf');
      assert.strictEqual(validation.valid, true);
    });

    it('should accept valid text buffer', () => {
      const textBuffer = Buffer.from('This is text content');
      const validation = validateDocumentBuffer(textBuffer, 'text/plain', 'test.txt');
      assert.strictEqual(validation.valid, true);
    });

    it('should reject files > 500MB', () => {
      const largeBuffer = Buffer.alloc(501 * 1024 * 1024);
      const validation = validateDocumentBuffer(largeBuffer, 'text/plain', 'test.txt');
      assert.strictEqual(validation.valid, false);
      assert(validation.error.includes('too large'));
    });
  });

  describe('Processor Imports', () => {
    it('should import PDF processor', async () => {
      const { isPDF: isPdfFunc } = await import('../services/documentProcessor/pdfProcessor.js');
      assert.strictEqual(typeof isPdfFunc, 'function');
    });

    it('should import Excel processor', async () => {
      const { isExcel: isExcelFunc } = await import('../services/documentProcessor/excelProcessor.js');
      assert.strictEqual(typeof isExcelFunc, 'function');
    });

    it('should import DOCX processor', async () => {
      const { isDocx: isDocxFunc } = await import('../services/documentProcessor/docxProcessor.js');
      assert.strictEqual(typeof isDocxFunc, 'function');
    });

    it('should import Image processor', async () => {
      const { isImage: isImageFunc } = await import('../services/documentProcessor/imageProcessor.js');
      assert.strictEqual(typeof isImageFunc, 'function');
    });
  });

  describe('Supported Types', () => {
    it('should export SUPPORTED_TYPES', () => {
      assert(typeof SUPPORTED_TYPES === 'object');
      assert(SUPPORTED_TYPES.PDF);
      assert(SUPPORTED_TYPES.XLSX);
      assert(SUPPORTED_TYPES.DOCX);
      assert(SUPPORTED_TYPES.PNG);
    });

    it('should have correct MIME types', () => {
      assert.strictEqual(SUPPORTED_TYPES.PDF, 'application/pdf');
      assert.strictEqual(SUPPORTED_TYPES.XLSX, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      assert.strictEqual(SUPPORTED_TYPES.CSV, 'text/csv');
    });
  });

  describe('Document Processing', () => {
    it('should process text buffer successfully', async () => {
      const textBuffer = Buffer.from('Hello World - This is test content');
      const result = await processDocument(textBuffer, 'text/plain', 'test.txt');

      assert.strictEqual(result.documentType, 'text');
      assert.strictEqual(result.status, 'success');
      assert(result.content.text.includes('Hello World'));
      assert(result.processingTime >= 0);
      assert.strictEqual(result.error, null);
    });

    it('should handle unknown document types gracefully', async () => {
      const buffer = Buffer.from('unknown content');
      const result = await processDocument(buffer, 'application/unknown', 'test.xyz');

      assert.strictEqual(result.documentType, 'unknown');
      // Debería intentar procesar como raw buffer
      assert(result.status === 'success' || result.status === 'error');
    });

    it('should include filename and metadata', async () => {
      const textBuffer = Buffer.from('Test data');
      const result = await processDocument(textBuffer, 'text/plain', 'myfile.txt');

      assert.strictEqual(result.filename, 'myfile.txt');
      assert.strictEqual(result.mimeType, 'text/plain');
      assert(result.timestamp);
      assert(result.size > 0);
    });
  });
});

// Nota: Para ejecutar estos tests:
// 1. Asegurar que package.json incluya "test" script que use node --test
// 2. Ejecutar: npm test
// 3. O manualmente: node --test server/tests/documentProcessor.test.js
