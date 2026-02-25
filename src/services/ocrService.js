/**
 * OCR Service - Tesseract.js Integration
 * Extracts text from images and scanned PDFs in the browser
 */

import { createWorker } from 'tesseract.js';

// OCR Configuration
const OCR_CONFIG = {
  language: 'spa+eng', // Spanish + English
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
  langPath: 'https://tessdata.projectnaptha.com/4.0.0',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
};

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.progressListeners = new Set();
  }

  // Add progress listener
  addProgressListener(callback) {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  // Notify progress
  notifyProgress(progress) {
    this.progressListeners.forEach(cb => cb(progress));
  }

  // Initialize Tesseract worker
  async initialize() {
    if (this.isInitialized && this.worker) {
      return this.worker;
    }

    this.notifyProgress({ status: 'initializing', progress: 0, message: 'Iniciando motor OCR...' });

    try {
      this.worker = await createWorker(OCR_CONFIG.language, 1, {
        workerPath: OCR_CONFIG.workerPath,
        langPath: OCR_CONFIG.langPath,
        corePath: OCR_CONFIG.corePath,
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.notifyProgress({
              status: 'processing',
              progress: Math.round(m.progress * 100),
              message: `Reconociendo texto... ${Math.round(m.progress * 100)}%`
            });
          }
        }
      });

      this.isInitialized = true;
      this.notifyProgress({ status: 'ready', progress: 100, message: 'OCR listo' });
      return this.worker;
    } catch (error) {
      console.error('Error initializing OCR:', error);
      this.notifyProgress({ status: 'error', progress: 0, message: `Error: ${error.message}` });
      throw error;
    }
  }

  // Extract text from image URL or blob
  async extractTextFromImage(imageSource) {
    try {
      const worker = await this.initialize();
      
      this.notifyProgress({ status: 'processing', progress: 10, message: 'Procesando imagen...' });

      const result = await worker.recognize(imageSource);
      
      this.notifyProgress({ status: 'complete', progress: 100, message: 'Texto extraído' });

      return {
        success: true,
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words,
        lines: result.data.lines,
        paragraphs: result.data.paragraphs,
        blocks: result.data.blocks
      };
    } catch (error) {
      console.error('OCR extraction error:', error);
      return {
        success: false,
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  // Extract text from PDF (first converts to images)
  async extractTextFromPDF(pdfUrl) {
    this.notifyProgress({ status: 'loading', progress: 5, message: 'Cargando PDF...' });

    try {
      // Load PDF.js dynamically if not available
      if (!window.pdfjsLib) {
        await this.loadPdfJs();
      }

      const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
      const numPages = pdf.numPages;
      let fullText = '';
      let totalConfidence = 0;
      const pageResults = [];

      for (let i = 1; i <= numPages; i++) {
        this.notifyProgress({
          status: 'processing',
          progress: Math.round((i / numPages) * 80),
          message: `Procesando página ${i} de ${numPages}...`
        });

        const page = await pdf.getPage(i);
        
        // First try to extract text directly from PDF
        const textContent = await page.getTextContent();
        const directText = textContent.items.map(item => item.str).join(' ');
        
        if (directText.trim().length > 50) {
          // PDF has embedded text, use it directly
          pageResults.push({
            page: i,
            text: directText,
            confidence: 100,
            method: 'direct'
          });
          fullText += directText + '\n\n';
          totalConfidence += 100;
        } else {
          // PDF is scanned, use OCR
          const imageDataUrl = await this.renderPageToImage(page);
          const ocrResult = await this.extractTextFromImage(imageDataUrl);
          
          pageResults.push({
            page: i,
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            method: 'ocr'
          });
          fullText += ocrResult.text + '\n\n';
          totalConfidence += ocrResult.confidence;
        }
      }

      this.notifyProgress({ status: 'complete', progress: 100, message: 'PDF procesado' });

      return {
        success: true,
        text: fullText.trim(),
        confidence: Math.round(totalConfidence / numPages),
        pageCount: numPages,
        pages: pageResults
      };
    } catch (error) {
      console.error('PDF OCR error:', error);
      this.notifyProgress({ status: 'error', progress: 0, message: `Error: ${error.message}` });
      return {
        success: false,
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  // Load PDF.js library
  async loadPdfJs() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Render PDF page to image
  async renderPageToImage(page, scale = 2) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return canvas.toDataURL('image/png');
  }

  // Main method: Process any document
  async processDocument(fileUrl, contentType) {
    const isImage = contentType?.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(fileUrl);
    const isPdf = contentType === 'application/pdf' || 
                  /\.pdf$/i.test(fileUrl);

    if (isImage) {
      return await this.extractTextFromImage(fileUrl);
    } else if (isPdf) {
      return await this.extractTextFromPDF(fileUrl);
    } else {
      return {
        success: false,
        text: '',
        confidence: 0,
        error: 'Tipo de archivo no soportado para OCR'
      };
    }
  }

  // Terminate worker
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

export const ocrService = new OCRService();
export default ocrService;
