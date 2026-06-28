// ═══════════════════════════════════════════════════════════════════════════════
//  Email → FileBrain Integration
//
//  Pipeline completo:
//  1. Email descargado con adjunto
//  2. Adjunto guardado en disk
//  3. Automáticamente encolado para procesamiento en FileBrain
//  4. OCR/IA extrae metadatos
//  5. Documento clasificado y guardado
//  6. Webhook notifica cuando está listo
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { addJob, checkDuplicate, computeFileHash } from '../queue/fileQueue.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const ATTACHMENTS_PROCESSED_FILE = path.join(DATA_DIR, 'email-attachments-processing.json');

// ── Cargar/Guardar estado de procesamiento ─────────────────────────────────────
function loadProcessingState() {
  try {
    if (require('fs').existsSync(ATTACHMENTS_PROCESSED_FILE)) {
      return JSON.parse(require('fs').readFileSync(ATTACHMENTS_PROCESSED_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[EmailFileBrain] Error loading processing state:', e.message);
  }
  return {
    processed: {},      // { filePath: { documentId, status, processedAt } }
    stats: {
      downloaded: 0,    // Total descargados
      queued: 0,        // En cola para procesar
      processing: 0,    // Actualmente procesando
      completed: 0,     // Completados
      failed: 0,        // Fallidos
    },
    webhooks: [],       // Log de webhooks enviados
  };
}

function saveProcessingState(state) {
  try {
    require('fs').mkdirSync(DATA_DIR, { recursive: true });
    require('fs').writeFileSync(ATTACHMENTS_PROCESSED_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[EmailFileBrain] Error saving processing state:', e.message);
  }
}

// ── Enqueuer: Mandar adjunto a FileBrain para procesamiento ────────────────────
export async function enqueueAttachmentForProcessing(attachmentData) {
  const {
    filePath,           // Ruta del archivo descargado
    filename,           // Nombre original del archivo
    from,              // Email del remitente
    subject,           // Asunto del email
    emailDate,         // Fecha del email
    attachmentSize,    // Tamaño del archivo
    attachmentType,    // Tipo MIME
  } = attachmentData;

  console.log(`\n[EmailFileBrain] 📤 Encolando para procesamiento: ${filename}`);

  try {
    // 1. Leer archivo para computar hash (detectar duplicados)
    const buffer = await fs.readFile(filePath);
    const fileHash = computeFileHash(buffer);

    // 2. Verificar si ya fue procesado
    const existingDoc = checkDuplicate(fileHash);
    if (existingDoc) {
      console.log(
        `[EmailFileBrain] ⚠️  Archivo ya procesado anteriormente: ${existingDoc}`
      );
      return {
        success: false,
        reason: 'duplicate',
        existingDocumentId: existingDoc,
      };
    }

    // 3. Extraer información del email
    const senderName = extractSenderName(from);
    const providerId = sanitizeProviderId(senderName);

    // 4. Crear job en FileBrain queue
    const documentId = crypto.randomUUID();
    const job = addJob(documentId, fileHash, providerId, filename, filePath);

    // 5. Guardar estado de integración
    const state = loadProcessingState();
    state.processed[filePath] = {
      documentId,
      filename,
      from,
      subject,
      emailDate,
      enqueuedAt: new Date().toISOString(),
      status: 'queued',
      attachmentSize,
      attachmentType,
      fileHash,
    };
    state.stats.downloaded++;
    state.stats.queued++;
    saveProcessingState(state);

    console.log(
      `[EmailFileBrain] ✅ Encolado correctamente (ID: ${documentId.substring(0, 8)}...)`
    );
    console.log(`   Remitente: ${from}`);
    console.log(`   Asunto: ${subject}`);
    console.log(`   Tamaño: ${Math.round(attachmentSize / 1024)}KB`);
    console.log(`   Provider: ${providerId}`);

    return {
      success: true,
      documentId,
      providerId,
      status: 'queued',
    };
  } catch (err) {
    console.error(`[EmailFileBrain] ❌ Error encolando adjunto:`, err.message);
    return { success: false, error: err.message };
  }
}

// ── Update Processing Status (llamado por FileBrain worker cuando procesa) ─────
export function updateProcessingStatus(filePath, documentId, status, metadata = {}) {
  const state = loadProcessingState();

  if (state.processed[filePath]) {
    state.processed[filePath].status = status;
    state.processed[filePath].updatedAt = new Date().toISOString();

    // Actualizar contadores
    if (status === 'completed') {
      state.stats.queued--;
      state.stats.completed++;
      state.processed[filePath].completedAt = new Date().toISOString();
      state.processed[filePath].metadata = metadata;
    } else if (status === 'failed') {
      state.stats.queued--;
      state.stats.failed++;
      state.processed[filePath].error = metadata.error;
    } else if (status === 'processing') {
      state.stats.processing++;
      state.stats.queued--;
    }

    saveProcessingState(state);

    console.log(`[EmailFileBrain] 🔄 Estado actualizado: ${status} (${documentId.substring(0, 8)}...)`);

    // Disparar webhook si está completado
    if (status === 'completed') {
      triggerWebhook({
        event: 'attachment-processed',
        documentId,
        filename: state.processed[filePath].filename,
        from: state.processed[filePath].from,
        subject: state.processed[filePath].subject,
        metadata,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// ── Webhook Trigger ─────────────────────────────────────────────────────────────
function triggerWebhook(payload) {
  // Placeholder para webhook externo (se puede configurar en .env)
  const webhookUrl = process.env.EMAIL_FILEBRAIN_WEBHOOK;

  if (!webhookUrl) {
    console.log(`[EmailFileBrain] 🔔 Webhook (configurado): evento listo`);
    return;
  }

  // En producción, hacer POST al webhook
  console.log(`[EmailFileBrain] 🔔 Enviando webhook a ${webhookUrl}`);

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      console.log(`[EmailFileBrain] ✅ Webhook enviado (${res.status})`);
    })
    .catch((err) => {
      console.error(`[EmailFileBrain] ❌ Error enviando webhook:`, err.message);
    });
}

// ── Helper: Extract Sender Name ─────────────────────────────────────────────────
function extractSenderName(emailString) {
  // "Company Name <email@example.com>" → "Company Name"
  // "email@example.com" → "email"
  const match = emailString.match(/^(.+?)\s*<.*>$/) || emailString.match(/^([^@]+)/);
  return match ? match[1].trim() : 'unknown';
}

// ── Helper: Sanitize Provider ID ────────────────────────────────────────────────
function sanitizeProviderId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .substring(0, 50);
}

// ── Get Integration Stats ───────────────────────────────────────────────────────
export function getIntegrationStats() {
  const state = loadProcessingState();
  return {
    stats: state.stats,
    recentProcessed: Object.entries(state.processed)
      .sort(([, a], [, b]) => new Date(b.enqueuedAt) - new Date(a.enqueuedAt))
      .slice(0, 20)
      .map(([path, data]) => ({
        filename: data.filename,
        from: data.from,
        status: data.status,
        enqueuedAt: data.enqueuedAt,
        completedAt: data.completedAt,
        documentId: data.documentId,
      })),
  };
}

// ── Monitor Pipeline Health ─────────────────────────────────────────────────────
export function getPipelineHealth() {
  const state = loadProcessingState();
  const { stats } = state;
  const total = stats.downloaded;

  return {
    status: total === 0 ? 'idle' : 'active',
    progress: {
      total,
      queued: stats.queued,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
      successRate:
        total > 0
          ? Math.round((stats.completed / (stats.completed + stats.failed)) * 100) || 0
          : 0,
    },
    bottlenecks: {
      hasQueueBacklog: stats.queued > 10,
      hasFailures: stats.failed > 0,
      avgTimeToProcess: calculateAvgProcessingTime(state),
    },
  };
}

// ── Calculate Average Processing Time ───────────────────────────────────────────
function calculateAvgProcessingTime(state) {
  const completed = Object.values(state.processed)
    .filter((p) => p.status === 'completed' && p.completedAt && p.enqueuedAt)
    .map((p) => new Date(p.completedAt) - new Date(p.enqueuedAt));

  if (completed.length === 0) return null;

  const avgMs = completed.reduce((a, b) => a + b, 0) / completed.length;
  return Math.round(avgMs / 1000) + 's'; // Convertir a segundos
}

export default {
  enqueueAttachmentForProcessing,
  updateProcessingStatus,
  getIntegrationStats,
  getPipelineHealth,
};
