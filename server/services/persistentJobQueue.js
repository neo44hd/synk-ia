/**
 * Persistent Job Queue
 * Survives server restarts - jobs continue from where they left off
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'job_queue.json');
const LOCK_FILE = path.join(DATA_DIR, 'job_queue.lock');

// In-memory state
let currentJob = null;
let queueData = { jobs: [], history: [] };

/**
 * Load queue from disk
 */
export function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      queueData = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
      console.log('[QUEUE] Loaded queue with', queueData.jobs.length, 'pending jobs');
    }
  } catch (err) {
    console.error('[QUEUE] Error loading queue:', err.message);
    queueData = { jobs: [], history: [] };
  }
}

/**
 * Save queue to disk
 */
function saveQueue() {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueData, null, 2), 'utf-8');
  } catch (err) {
    console.error('[QUEUE] Error saving queue:', err.message);
  }
}

/**
 * Add job to queue
 */
export function enqueueJob(jobType, config = {}) {
  const job = {
    id: `${jobType}-${Date.now()}`,
    type: jobType,
    status: 'pending',
    config,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    progress: '0/0',
    error: null,
  };

  queueData.jobs.push(job);
  saveQueue();
  console.log('[QUEUE] Enqueued job:', job.id);
  return job;
}

/**
 * Get current job or next from queue
 */
export function getCurrentOrNextJob() {
  if (currentJob && currentJob.status === 'running') {
    return currentJob;
  }

  const pending = queueData.jobs.find(j => j.status === 'pending');
  if (pending) {
    pending.status = 'running';
    pending.startedAt = new Date().toISOString();
    currentJob = pending;
    saveQueue();
    console.log('[QUEUE] Started job:', pending.id);
    return pending;
  }

  return null;
}

/**
 * Update job progress
 */
export function updateJobProgress(jobId, progress, details = {}) {
  const job = queueData.jobs.find(j => j.id === jobId);
  if (job) {
    job.progress = progress;
    Object.assign(job, details);
    saveQueue();
  }
}

/**
 * Complete job
 */
export function completeJob(jobId, success = true, error = null) {
  const job = queueData.jobs.find(j => j.id === jobId);
  if (job) {
    job.status = success ? 'completed' : 'failed';
    job.completedAt = new Date().toISOString();
    if (error) job.error = error;
    
    // Move to history
    queueData.history.push(job);
    queueData.jobs = queueData.jobs.filter(j => j.id !== jobId);
    
    currentJob = null;
    saveQueue();
    console.log('[QUEUE] Completed job:', jobId, success ? '✓' : '✗');
  }
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return {
    currentJob: currentJob ? { ...currentJob } : null,
    pending: queueData.jobs.length,
    completed: queueData.history.length,
    jobs: queueData.jobs.map(j => ({
      id: j.id,
      type: j.type,
      status: j.status,
      progress: j.progress,
      createdAt: j.createdAt,
    })),
    history: queueData.history.slice(-10).map(j => ({
      id: j.id,
      type: j.type,
      status: j.status,
      completedAt: j.completedAt,
    })),
  };
}

/**
 * Process queue continuously
 */
export async function startQueueProcessor() {
  console.log('[QUEUE] Starting persistent job processor');

  // Load any pending jobs from last session
  loadQueue();

  // Process queue
  setInterval(async () => {
    const job = getCurrentOrNextJob();
    if (!job) return;

    console.log('[QUEUE] Processing job:', job.id, `(${job.type})`);

    try {
      // Execute job based on type
      const result = await executeJob(job);
      completeJob(job.id, true);
    } catch (err) {
      console.error('[QUEUE] Job error:', err.message);
      completeJob(job.id, false, err.message);
    }
  }, 5000); // Check every 5 seconds
}

/**
 * Execute a specific job
 */
async function executeJob(job) {
  return new Promise((resolve, reject) => {
    let scriptPath;
    let args = [];

    // Map job type to script
    switch (job.type) {
      case 'sync-emails':
        scriptPath = path.join(__dirname, '..', '..', 'scripts', 'manual-email-sync.mjs');
        break;
      case 'reprocess-failed':
        scriptPath = path.join(__dirname, '..', '..', 'scripts', 'reprocess-failed.mjs');
        break;
      case 'reprocess-all':
        scriptPath = path.join(__dirname, '..', '..', 'scripts', 'reprocess-all.mjs');
        break;
      case 'rebuild':
        scriptPath = path.join(__dirname, '..', '..', 'scripts', 'reprocess-fresh.mjs');
        break;
      case 'verify':
        scriptPath = path.join(__dirname, '..', '..', 'scripts', 'verify-integrity.mjs');
        break;
      default:
        return reject(new Error(`Unknown job type: ${job.type}`));
    }

    // Spawn process
    const child = spawn('node', [scriptPath], {
      cwd: path.dirname(scriptPath),
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let logBuffer = [];
    let progressPattern = /(\d+)\/(\d+)/;

    // Capture output
    child.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        logBuffer.push(line);
        
        // Try to extract progress
        const match = line.match(progressPattern);
        if (match) {
          updateJobProgress(job.id, `${match[1]}/${match[2]}`);
        }
      }
    });

    child.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        logBuffer.push(`[ERROR] ${line}`);
      }
    });

    // Handle completion
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, logs: logBuffer });
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start process: ${err.message}`));
    });

    // Timeout after 2 hours
    setTimeout(() => {
      child.kill();
      reject(new Error('Job timeout (2 hours)'));
    }, 7200000);
  });
}

export default {
  loadQueue,
  enqueueJob,
  getCurrentOrNextJob,
  updateJobProgress,
  completeJob,
  getQueueStatus,
  startQueueProcessor,
};
