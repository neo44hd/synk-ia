import path from 'path';
import { v4 as uuid } from 'uuid';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import MDRepository from './MDRepository.js';

const mdRepo = new MDRepository();

// Dummy AgentCore - replace with actual implementation
const AgentCore = {
  classifyDocument: async (text) => {
    // TODO: Implement actual document classification with AI
    return { type: 'document', confidence: 0.5 };
  }
};

async function textFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return '';
  }
}

async function textFromImage(buffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    return text;
  } catch (error) {
    console.error('Error in OCR:', error);
    return '';
  }
}

async function extractMetadata(rawText, type) {
  // TODO: Implement actual metadata extraction based on document type
  return {
    pages: 1,
    language: 'en',
    summary: rawText.substring(0, 200)
  };
}

async function ingest(file) {
  // file: { originalname, buffer, mimetype }
  const ext = path.extname(file.originalname).toLowerCase();
  let rawText = '';

  if (ext === '.pdf') {
    rawText = await textFromPdf(file.buffer);
  } else if (ext.match(/\.(png|jpe?g|tiff|bmp)$/)) {
    rawText = await textFromImage(file.buffer);
  } else {
    rawText = file.buffer.toString('utf8');
  }

  // 1️⃣ Determinar tipo de documento (invoice, contract, …) con AgentCore
  const classification = await AgentCore.classifyDocument(rawText);
  const type = classification.type || 'unknown';
  const confidence = classification.confidence || 0;

  // 2️⃣ Extraer metadatos relevantes
  const metadataPayload = await extractMetadata(rawText, type);

  // 3️⃣ Construct metadata front‑matter
  const meta = {
    type,
    confidence,
    fileName: file.originalname,
    uploadedAt: new Date().toISOString(),
    ...metadataPayload
  };

  const finalText = `---
${Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join('\n')}
---

${rawText}`;

  const id = uuid();
  const filePath = await mdRepo.saveDocument(id, {}, finalText); // metadata ya incluido en content

  return { id, meta, filePath };
}

export { ingest };
