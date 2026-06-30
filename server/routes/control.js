/**
 * Control API Routes
 * Exposes endpoints for job management, sync, reprocessing, and integrity checks
 */

import { Router } from 'express';
import { 
  isJobBusy, 
  getJobStatus, 
  getJob, 
  getJobLogs,
  launchJob,
  backupData
} from '../services/jobManager.js';
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
    const jobStatus = getJobStatus();
    
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
      busy: jobStatus.busy,
      currentJob: jobStatus.currentJob,
      data: {
        documents: documents.length,
        processed,
        failed,
        invoices: invoices.length,
        providers: providers.length,
        emails: emails.length,
        uploads: uploads.length,
      },
      lastIntegrityCheck: null, // Could be stored/tracked
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
    if (isJobBusy()) {
      return res.status(409).json({
        success: false,
        error: 'Another job is already running. Please wait for it to complete.',
      });
    }

    // Quick sync without spawning separate process
    // (the sync worker already runs periodically, this is manual trigger)
    try {
      await syncAll();
      res.json({ success: true, message: 'Email sync completed' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
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
    const result = await launchJob('reprocess-failed');
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.json(result);
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
    const result = await launchJob('reprocess-all');
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.json(result);
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

    if (isJobBusy()) {
      return res.status(409).json({
        success: false,
        error: 'Another job is already running. Please wait for it to complete.',
      });
    }

    // Backup data first
    const backup = await backupData();
    if (!backup.success) {
      return res.status(500).json({
        success: false,
        error: `Backup failed: ${backup.error}`,
      });
    }

    // Launch reprocess-fresh
    const result = await launchJob('rebuild');
    if (!result.success) {
      return res.status(500).json({
        ...result,
        backup,
      });
    }

    res.json({
      ...result,
      backup,
      message: `Rebuild complete. Backup saved to ${backup.backupDir}`,
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
    const result = await launchJob('verify');
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/control/jobs/:jobId
 * Get detailed status of a specific job
 */
controlRouter.get('/jobs/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/control/logs/:jobName
 * Get logs for a job (streaming tail)
 */
controlRouter.get('/logs/:jobName', (req, res) => {
  try {
    const { lines = 50 } = req.query;
    const logs = getJobLogs(req.params.jobName, parseInt(lines));
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default controlRouter;
