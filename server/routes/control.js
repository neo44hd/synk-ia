/**
 * Control API Routes
 * Exposes endpoints for job management, sync, reprocessing, and integrity checks
 */

import { Router } from 'express';
import {
  enqueueJob,
  getQueueStatus,
} from '../services/persistentJobQueue.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncAll } from '../services/dataSync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

// Helper to read entities (replicate from data.js)
function readEntity(entity) {
  const name = entity.toLowerCase();
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('[CONTROL] Read error:', e.message);
    return [];
  }
}

export const controlRouter = Router();

/**
 * GET /api/control/status
 * Returns current system status: job busy, data counts, worker info
 */
controlRouter.get('/status', async (_req, res) => {
  try {
    const queueStatus = getQueueStatus();
    
    // Count documents by state
    const documents = readEntity('document') || [];
    const processed = documents.filter(d => d.state === 'processed').length;
    const failed = documents.filter(d => d.state === 'failed' || d.state === 'error').length;
    
    // Count other entities
    const invoices = readEntity('invoice') || [];
    const providers = readEntity('provider') || [];
    const emails = readEntity('emailmessage') || [];
    const uploads = readEntity('uploadedfile') || [];

    res.json({
      success: true,
      busy: !!queueStatus.currentJob,
      currentJob: queueStatus.currentJob,
      queue: {
        pending: queueStatus.pending,
        completed: queueStatus.completed,
      },
      data: {
        documents: documents.length,
        processed,
        failed,
        invoices: invoices.length,
        providers: providers.length,
        emails: emails.length,
        uploads: uploads.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/control/sync-emails
 * Manually trigger email synchronization
 */
controlRouter.post('/sync-emails', async (req, res) => {
  try {
    const job = enqueueJob('sync-emails');
    res.json({
      success: true,
      message: 'Email sync job enqueued',
      jobId: job.id,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/control/reprocess-failed
 * Reprocess only documents that failed extraction
 */
controlRouter.post('/reprocess-failed', async (req, res) => {
  try {
    const job = enqueueJob('reprocess-failed');
    res.json({
      success: true,
      message: 'Reprocess failed job enqueued',
      jobId: job.id,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/control/reprocess-all
 * Reprocess all documents with the current pipeline
 */
controlRouter.post('/reprocess-all', async (req, res) => {
  try {
    const job = enqueueJob('reprocess-all');
    res.json({
      success: true,
      message: 'Reprocess all job enqueued',
      jobId: job.id,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/control/rebuild
 * Destructive: backup data, reset stores, reprocess from scratch
 * Requires confirmation via { confirm: "RECONSTRUIR" }
 */
controlRouter.post('/rebuild', async (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'RECONSTRUIR') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Set { confirm: "RECONSTRUIR" } in request body.',
      });
    }

    const job = enqueueJob('rebuild');
    res.json({
      success: true,
      message: 'Rebuild job enqueued. Data will be backed up automatically.',
      jobId: job.id,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/control/verify
 * Run integrity verification on data stores
 */
controlRouter.post('/verify', async (req, res) => {
  try {
    const job = enqueueJob('verify');
    res.json({
      success: true,
      message: 'Integrity verification job enqueued',
      jobId: job.id,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/control/queue
 * Get queue status including all jobs and history
 */
controlRouter.get('/queue', (req, res) => {
  try {
    const status = getQueueStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default controlRouter;
