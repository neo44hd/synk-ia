// ═══════════════════════════════════════════════════════════════════════════════
//  Email Attachments Routes — Trigger & Monitor Sync
// ═══════════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { syncEmailAttachments } from '../workers/emailAttachmentWorker.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'email-attachments');
const METADATA_FILE = path.join(DATA_DIR, 'email-attachments-metadata.json');

export const emailAttachmentsRouter = Router();

// ── GET /api/email-attachments/status — Ver estado de la descarga ─────────────
emailAttachmentsRouter.get('/status', (req, res) => {
  try {
    let metadata = { processed: {}, stats: { total: 0, downloaded: 0, failed: 0 } };
    
    if (fs.existsSync(METADATA_FILE)) {
      metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    }

    // Contar archivos en directorio
    let attachmentCount = 0;
    let totalSize = 0;

    if (fs.existsSync(ATTACHMENTS_DIR)) {
      const files = fs.readdirSync(ATTACHMENTS_DIR);
      attachmentCount = files.length;
      
      for (const file of files) {
        try {
          const filePath = path.join(ATTACHMENTS_DIR, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        } catch (e) {
          // Ignorar errores individuales
        }
      }
    }

    res.json({
      success: true,
      stats: {
        ...metadata.stats,
        filesOnDisk: attachmentCount,
        totalSize: Math.round(totalSize / (1024 * 1024)) + 'MB', // MB
        storagePath: ATTACHMENTS_DIR,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/email-attachments/sync — Disparar sincronización ────────────────
emailAttachmentsRouter.post('/sync', async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      batchSize = 10,
      folder = 'INBOX',
      quickTest = false,
    } = req.body;

    // Si es quickTest, solo sincronizar últimos 7 días
    let fromDate = dateFrom
      ? new Date(dateFrom)
      : new Date(new Date().setDate(new Date().getDate() - (quickTest ? 7 : 180)));
    let toDate = dateTo ? new Date(dateTo) : new Date();

    console.log(`\n[EmailAttachments] 🚀 Sync iniciado`);
    console.log(`   Rango: ${fromDate.toISOString().split('T')[0]} a ${toDate.toISOString().split('T')[0]}`);
    console.log(`   Tipo: ${quickTest ? 'QUICK TEST (7 días)' : 'FULL SYNC (6 meses)'}`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Folder: ${folder}\n`);

    // Dispara la sincronización (no bloquea)
    // En background, el worker procesa por lotes
    syncEmailAttachments({
      dateFrom: fromDate,
      dateTo: toDate,
      batchSize,
      folder,
    }).then((result) => {
      console.log(`\n[EmailAttachments] ✅ Sync completado`);
      console.log(`   Resultado: ${JSON.stringify(result, null, 2)}`);
    }).catch((err) => {
      console.error(`[EmailAttachments] ❌ Sync error:`, err.message);
    });

    // Responde inmediatamente (no espera)
    res.status(202).json({
      success: true,
      message: 'Sync iniciado en background',
      config: {
        dateFrom: fromDate.toISOString(),
        dateTo: toDate.toISOString(),
        batchSize,
        folder,
        type: quickTest ? 'quick-test' : 'full-sync',
      },
      note: 'Revisa /api/email-attachments/status para monitorear progreso',
    });
  } catch (err) {
    console.error('[EmailAttachments] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/email-attachments/sync/test — Quick test (7 días) ────────────────
emailAttachmentsRouter.post('/sync/test', async (req, res) => {
  try {
    console.log('\n[EmailAttachments] 🧪 Quick Test iniciado (últimos 7 días)\n');

    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 días atrás

    syncEmailAttachments({
      dateFrom: fromDate,
      dateTo: toDate,
      batchSize: 5, // Más pequeño para test
      folder: 'INBOX',
    }).then((result) => {
      console.log(`\n[EmailAttachments] ✅ Quick test completado`);
      console.log(`   Resultado: ${JSON.stringify(result, null, 2)}`);
    }).catch((err) => {
      console.error(`[EmailAttachments] ❌ Test error:`, err.message);
    });

    res.status(202).json({
      success: true,
      message: 'Quick test iniciado (últimos 7 días)',
      note: 'Revisa /api/email-attachments/status para monitorear',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email-attachments/list — Listar archivos descargados ─────────────
emailAttachmentsRouter.get('/list', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (!fs.existsSync(ATTACHMENTS_DIR)) {
      return res.json({
        success: true,
        files: [],
        total: 0,
        message: 'No attachments downloaded yet',
      });
    }

    const files = fs.readdirSync(ATTACHMENTS_DIR)
      .sort()
      .reverse(); // Más recientes primero

    const total = files.length;
    const paginated = files.slice(offset, offset + limit);

    const fileDetails = paginated.map((file) => {
      try {
        const filePath = path.join(ATTACHMENTS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: Math.round(stats.size / 1024) + 'KB',
          created: stats.mtime.toISOString(),
          path: filePath,
        };
      } catch (e) {
        return { filename: file, error: e.message };
      }
    });

    res.json({
      success: true,
      files: fileDetails,
      pagination: {
        total,
        offset,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default emailAttachmentsRouter;
