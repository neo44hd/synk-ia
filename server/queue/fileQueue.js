// ═══════════════════════════════════════════════════════════════════════════════
//  File Processing Queue — SQLite-based (no Redis dependency)
//  Manages document uploads asynchronously with retry logic
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'file-queue.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Queue State (in-memory with disk persistence) ──────────────────────────────
let queue = [];
let documentHashes = {}; // { hash: documentId } — para detectar duplicados rápidamente

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      queue = data.jobs || [];
      documentHashes = data.hashes || {};
    }
  } catch (err) {
    console.error('[QUEUE] Error loading queue:', err.message);
  }
}

function saveQueue() {
  try {
    fs.writeFileSync(
      QUEUE_FILE,
      JSON.stringify({ jobs: queue, hashes: documentHashes }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('[QUEUE] Error saving queue:', err.message);
  }
}

// Load queue on startup
loadQueue();

// ═══════════════════════════════════════════════════════════════════════════════
//  Job Structure
// ═══════════════════════════════════════════════════════════════════════════════
// {
//   id: UUID,
//   fileHash: SHA-256 of file content,
//   providerId: string (sanitized),
//   fileName: original file name,
//   filePath: where raw file was saved,
//   status: 'pending' | 'processing' | 'completed' | 'failed',
//   attempts: number,
//   maxAttempts: 3,
//   createdAt: ISO timestamp,
//   startedAt: ISO timestamp | null,
//   completedAt: ISO timestamp | null,
//   error: string | null,
// }

export function addJob(documentId, fileHash, providerId, fileName, filePath) {
  const job = {
    id: documentId,
    fileHash,
    providerId,
    fileName,
    filePath,
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null,
  };

  queue.push(job);
  documentHashes[fileHash] = documentId;
  saveQueue();
  return job;
}

export function checkDuplicate(fileHash) {
  return documentHashes[fileHash] || null;
}

export function getJob(documentId) {
  return queue.find(job => job.id === documentId);
}

export function getNextPendingJob() {
  return queue.find(job => job.status === 'pending');
}

export function updateJobStatus(documentId, status, options = {}) {
  const job = queue.find(j => j.id === documentId);
  if (!job) return null;

  job.status = status;
  if (status === 'processing') {
    job.startedAt = new Date().toISOString();
    job.attempts++;
  }
  if (status === 'completed') {
    job.completedAt = new Date().toISOString();
  }
  if (status === 'failed') {
    job.completedAt = new Date().toISOString();
    job.error = options.error || 'Unknown error';
  }

  saveQueue();
  return job;
}

export function canRetry(documentId) {
  const job = queue.find(j => j.id === documentId);
  if (!job) return false;
  return job.attempts < job.maxAttempts;
}

export function retryJob(documentId) {
  const job = queue.find(j => j.id === documentId);
  if (!job || !canRetry(documentId)) return null;

  job.status = 'pending';
  job.error = null;
  saveQueue();
  return job;
}

export function getQueueStats() {
  const stats = {
    total: queue.length,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const job of queue) {
    stats[job.status]++;
  }

  return stats;
}

export function getQueue() {
  return queue;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Compute file hash (SHA-256)
// ═══════════════════════════════════════════════════════════════════════════════
export function computeFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
