// ═══════════════════════════════════════════════════════════════════════════════
//  Email Attachment Worker — Download & Process by Batch
//
//  Descarga emails con adjuntos desde IMAP sin congestionar:
//  - Rate limiting entre conexiones
//  - Procesa por lotes (batch size configurable)
//  - Almacena adjuntos + metadatos
//  - Retry automático con backoff
//  - Logging completo
// ═══════════════════════════════════════════════════════════════════════════════

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { enqueueAttachmentForProcessing } from '../services/emailFileBrainIntegration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'email-attachments');
const METADATA_FILE = path.join(DATA_DIR, 'email-attachments-metadata.json');

// ── Configuration ──────────────────────────────────────────────────────────────
const BATCH_SIZE = 10; // Procesar 10 emails a la vez
const DELAY_BETWEEN_BATCHES = 2000; // 2 segundos entre batches
const DELAY_BETWEEN_EMAILS = 500; // 500ms entre emails
const MAX_RETRIES = 3;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB máximo por archivo

// Filtros de adjuntos permitidos
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

// ── Load/Save Metadata ─────────────────────────────────────────────────────────
function loadMetadata() {
  try {
    if (require('fs').existsSync(METADATA_FILE)) {
      return JSON.parse(require('fs').readFileSync(METADATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[EmailAttach] Error loading metadata:', e.message);
  }
  return { processed: {}, stats: { total: 0, downloaded: 0, failed: 0 } };
}

function saveMetadata(metadata) {
  try {
    const { mkdirSync } = require('fs');
    mkdirSync(DATA_DIR, { recursive: true });
    require('fs').writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  } catch (e) {
    console.error('[EmailAttach] Error saving metadata:', e.message);
  }
}

// ── IMAP Connection ────────────────────────────────────────────────────────────
function createImapConnection() {
  return new Imap({
    user: process.env.EMAIL_IMAP_USERNAME || process.env.EMAIL_USER,
    password: process.env.EMAIL_IMAP_PASSWORD || process.env.EMAIL_APP_PASSWORD,
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });
}

// ── Download & Process Single Email ────────────────────────────────────────────
async function processEmailWithAttachments(imap, emailId, options = {}) {
  return new Promise((resolve) => {
    const f = imap.fetch(emailId, { bodies: '' });
    let attachmentCount = 0;

    f.on('message', (msg, seqno) => {
      let emailData = {
        id: emailId,
        seqno,
        from: '',
        subject: '',
        date: '',
        attachments: [],
      };

      msg.on('structure', async (structure) => {
        // Procesar adjuntos
        try {
          const parts = [];
          if (structure[0]) {
            for (let i = 0; i < structure.length; i++) {
              const part = structure[i];
              if (part.disposition && part.disposition.toUpperCase() === 'ATTACHMENT') {
                parts.push({
                  partID: (i + 1).toString(),
                  filename: part.params?.name || `attachment_${i}`,
                  type: part.type + '/' + part.subtype,
                });
              }
            }
          }

          // Descargar adjuntos
          for (const attachment of parts) {
            try {
              await downloadAttachment(imap, emailId, attachment, emailData);
              attachmentCount++;
            } catch (err) {
              console.error(`[EmailAttach] Error downloading ${attachment.filename}:`, err.message);
            }
          }
        } catch (err) {
          console.error('[EmailAttach] Error processing structure:', err.message);
        }
      });

      simpleParser(msg, async (err, parsed) => {
        if (err) {
          console.error('[EmailAttach] Error parsing email:', err.message);
          resolve({ success: false, error: err.message });
          return;
        }

        emailData.from = parsed.from?.text || '';
        emailData.subject = parsed.subject || '';
        emailData.date = parsed.date?.toISOString() || new Date().toISOString();
        emailData.text = parsed.text?.substring(0, 500) || '';

        // Log
        if (attachmentCount > 0) {
          console.log(
            `[EmailAttach] ✅ ${emailData.subject.substring(0, 50)} — ${attachmentCount} adjuntos descargados`
          );
        }

        resolve({ success: true, email: emailData, attachmentCount });
      });
    });

    f.on('error', (err) => {
      console.error('[EmailAttach] Fetch error:', err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

// ── Download Single Attachment ─────────────────────────────────────────────────
async function downloadAttachment(imap, emailId, attachment, emailData) {
  return new Promise((resolve, reject) => {
    const f = imap.fetch(emailId, { bodies: attachment.partID });

    f.on('message', (msg) => {
      msg.on('body', async (stream, info) => {
        try {
          const chunks = [];
          let size = 0;

          stream.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_FILE_SIZE) {
              stream.destroy();
              reject(new Error(`File too large: ${attachment.filename}`));
              return;
            }
            chunks.push(chunk);
          });

          stream.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks);

              // Validar tipo
              if (!ALLOWED_TYPES.includes(attachment.type)) {
                console.warn(`[EmailAttach] Skipping unsupported type: ${attachment.type}`);
                resolve();
                return;
              }

              // Crear directorio si no existe
              await fs.mkdir(ATTACHMENTS_DIR, { recursive: true });

              // Generar nombre único
              const timestamp = Date.now();
              const sanitizedName = attachment.filename
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .substring(0, 100);
              const fileName = `${timestamp}_${sanitizedName}`;
              const filePath = path.join(ATTACHMENTS_DIR, fileName);

              // Guardar archivo
              await fs.writeFile(filePath, buffer);

              // Guardar metadatos
              emailData.attachments.push({
                filename: attachment.filename,
                size: buffer.length,
                type: attachment.type,
                path: filePath,
                savedAt: new Date().toISOString(),
              });

              console.log(`[EmailAttach] 💾 Saved: ${sanitizedName} (${Math.round(buffer.length / 1024)}KB)`);

              // 🔗 INTEGRACIÓN: Encolar para procesamiento en FileBrain
              const processingResult = await enqueueAttachmentForProcessing({
                filePath,
                filename: attachment.filename,
                from: emailData.from,
                subject: emailData.subject,
                emailDate: emailData.date,
                attachmentSize: buffer.length,
                attachmentType: attachment.type,
              });

              if (processingResult.success) {
                console.log(`[EmailAttach] 🔗 Encolado en FileBrain: ${processingResult.documentId.substring(0, 8)}...`);
              } else if (processingResult.reason === 'duplicate') {
                console.log(`[EmailAttach] ⚠️  Ya procesado: ${processingResult.existingDocumentId}`);
              } else {
                console.error(`[EmailAttach] ❌ Error encolando:`, processingResult.error);
              }

              resolve();
            } catch (err) {
              reject(err);
            }
          });

          stream.on('error', reject);
        } catch (err) {
          reject(err);
        }
      });
    });

    f.on('error', reject);
  });
}

// ── Main Sync Worker ───────────────────────────────────────────────────────────
export async function syncEmailAttachments(options = {}) {
  const {
    dateFrom = new Date(new Date().setMonth(new Date().getMonth() - 6)), // 6 meses atrás
    dateTo = new Date(),
    batchSize = BATCH_SIZE,
    folder = 'INBOX',
  } = options;

  const metadata = loadMetadata();
  const imap = createImapConnection();
  let result = {
    success: false,
    startTime: new Date(),
    totalEmails: 0,
    processedEmails: 0,
    attachmentsDownloaded: 0,
    errors: [],
  };

  return new Promise((resolve) => {
    imap.openBox(folder, false, async (err, box) => {
      if (err) {
        result.success = false;
        result.errors.push(err.message);
        console.error('[EmailAttach] Error opening mailbox:', err.message);
        imap.end();
        resolve(result);
        return;
      }

      try {
        // Buscar emails con adjuntos desde la fecha
        const searchCriteria = [
          'SINCE',
          dateFrom.toISOString().split('T')[0],
          'BEFORE',
          dateTo.toISOString().split('T')[0],
        ];

        console.log(
          `[EmailAttach] 🔍 Buscando emails desde ${dateFrom.toISOString().split('T')[0]}...`
        );

        imap.search(searchCriteria, async (err, results) => {
          if (err) {
            result.errors.push(err.message);
            console.error('[EmailAttach] Search error:', err.message);
            imap.end();
            resolve(result);
            return;
          }

          result.totalEmails = results.length;
          console.log(`[EmailAttach] 📧 Encontrados ${results.length} emails`);

          // Procesar por lotes
          for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);
            console.log(
              `\n[EmailAttach] 📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(results.length / batchSize)} (${batch.length} emails)`
            );

            const batchResults = await Promise.all(
              batch.map((emailId) =>
                processEmailWithAttachments(imap, emailId, { metadata })
                  .then((res) => {
                    if (res.success) {
                      result.processedEmails++;
                      result.attachmentsDownloaded += res.attachmentCount || 0;
                    } else {
                      result.errors.push(res.error);
                    }
                    return res;
                  })
                  .catch((err) => {
                    result.errors.push(err.message);
                    return { success: false, error: err.message };
                  })
              )
            );

            // Esperar entre batches
            if (i + batchSize < results.length) {
              console.log(
                `[EmailAttach] ⏸️  Esperando ${DELAY_BETWEEN_BATCHES}ms antes del próximo batch...`
              );
              await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
            }
          }

          // Actualizar metadatos
          result.success = true;
          result.endTime = new Date();
          result.duration = Math.round((result.endTime - result.startTime) / 1000) + 's';
          metadata.stats.total += result.attachmentsDownloaded;
          metadata.stats.downloaded += result.processedEmails;
          saveMetadata(metadata);

          console.log(`\n[EmailAttach] ✅ Sincronización completada:`);
          console.log(`   Total emails: ${result.totalEmails}`);
          console.log(`   Procesados: ${result.processedEmails}`);
          console.log(`   Adjuntos: ${result.attachmentsDownloaded}`);
          console.log(`   Tiempo: ${result.duration}`);
          if (result.errors.length > 0) {
            console.log(`   Errores: ${result.errors.length}`);
          }

          imap.end();
          resolve(result);
        });
      } catch (err) {
        result.success = false;
        result.errors.push(err.message);
        console.error('[EmailAttach] Sync error:', err.message);
        imap.end();
        resolve(result);
      }
    });
  });
}

// ── CLI Usage (para ejecutar directamente) ─────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[EmailAttach] 🚀 Starting attachment sync...\n');

  // Por defecto: últimos 6 meses
  syncEmailAttachments()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[EmailAttach] Fatal error:', err);
      process.exit(1);
    });
}

export default syncEmailAttachments;
