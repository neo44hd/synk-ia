/**
 * Job Manager Service
 * Manages background job execution with global locking and process detection.
 * Prevents concurrent reprocessing and tracks job progress.
 */

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const LOCK_FILE = path.join(DATA_DIR, 'job.lock');
const JOBS_FILE = path.join(DATA_DIR, 'control_jobs.json');

// In-memory job tracking
let jobState = {
  currentJob: null,
  jobs: {},
};

// Load persisted jobs on startup
function loadJobs() {
  if (fs.existsSync(JOBS_FILE)) {
    try {
      jobState.jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
    } catch (e) {
      console.error('[JOB-MANAGER] Error loading jobs:', e.message);
    }
  }
}

// Save jobs to disk
function saveJobs() {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobState.jobs, null, 2), 'utf8');
  } catch (e) {
    console.error('[JOB-MANAGER] Error saving jobs:', e.message);
  }
}

// Create lock file
function createLock() {
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString() }), 'utf8');
  } catch (e) {
    console.error('[JOB-MANAGER] Error creating lock:', e.message);
  }
}

// Remove lock file
function removeLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (e) {
    console.error('[JOB-MANAGER] Error removing lock:', e.message);
  }
}

// Check if a process is running via pgrep
function isProcessRunning(processName) {
  try {
    execSync(`pgrep -f "${processName}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Check if any heavy job is running
export function isJobBusy() {
  // Check lock file
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      // Verify process is still alive
      try {
        execSync(`ps -p ${lock.pid}`, { stdio: 'pipe' });
        return true;
      } catch {
        // Process died, remove stale lock
        removeLock();
      }
    } catch (e) {
      removeLock();
    }
  }

  // Check for externally launched processes (via terminal)
  if (isProcessRunning('reprocess-fresh') || isProcessRunning('reprocess-failed')) {
    return true;
  }

  return false;
}

// Get current job status
export function getJobStatus() {
  return {
    busy: isJobBusy(),
    currentJob: jobState.currentJob,
    jobs: jobState.jobs,
  };
}

// Get specific job
export function getJob(jobId) {
  return jobState.jobs[jobId] || null;
}

// Get job logs (last N lines)
export function getJobLogs(jobName, lines = 50) {
  const logsFile = path.join(DATA_DIR, `job-${jobName}.log`);
  if (!fs.existsSync(logsFile)) return [];
  
  try {
    const content = fs.readFileSync(logsFile, 'utf8');
    return content.split('\n').slice(-lines).filter(l => l.trim());
  } catch (e) {
    return [];
  }
}

// Launch a job script
export async function launchJob(jobType, options = {}) {
  // Check if already busy
  if (isJobBusy()) {
    return {
      success: false,
      error: 'Another job is already running. Please wait for it to complete.',
    };
  }

  const jobId = `${jobType}-${Date.now()}`;
  const scriptMap = {
    'sync-emails': 'manual-email-sync.mjs',
    'reprocess-failed': 'reprocess-failed.mjs',
    'reprocess-all': 'reprocess-all.mjs',
    'rebuild': 'reprocess-fresh.mjs',
    'verify': 'verify-integrity.mjs',
  };

  const scriptName = scriptMap[jobType];
  if (!scriptName) {
    return { success: false, error: `Unknown job type: ${jobType}` };
  }

  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) {
    return { success: false, error: `Script not found: ${scriptName}` };
  }

  // Create lock
  createLock();
  jobState.currentJob = jobId;

  // Initialize job record
  jobState.jobs[jobId] = {
    id: jobId,
    type: jobType,
    status: 'running',
    progress: '0/0',
    startTime: new Date().toISOString(),
    endTime: null,
    log: [],
    error: null,
  };
  saveJobs();

  const logsFile = path.join(DATA_DIR, `job-${jobType}.log`);

  // Spawn script
  const child = spawn('node', [scriptPath], {
    cwd: SCRIPTS_DIR,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  // Capture output
  let logBuffer = [];
  const logStream = fs.createWriteStream(logsFile, { flags: 'a' });

  child.stdout?.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logBuffer.push(line);
      logStream.write(line + '\n');
      
      // Try to extract progress (e.g., "123/500")
      const progressMatch = line.match(/(\d+)\/(\d+)/);
      if (progressMatch) {
        jobState.jobs[jobId].progress = `${progressMatch[1]}/${progressMatch[2]}`;
      }
    }
  });

  child.stderr?.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logBuffer.push(`[ERROR] ${line}`);
      logStream.write(`[ERROR] ${line}\n`);
    }
  });

  // Wait for completion
  return new Promise((resolve) => {
    child.on('close', (code) => {
      logStream.end();

      jobState.jobs[jobId].status = code === 0 ? 'done' : 'error';
      jobState.jobs[jobId].endTime = new Date().toISOString();
      if (code !== 0) {
        jobState.jobs[jobId].error = `Process exited with code ${code}`;
      }
      saveJobs();

      removeLock();
      jobState.currentJob = null;

      resolve({
        success: code === 0,
        jobId,
        status: jobState.jobs[jobId].status,
        logs: logBuffer,
      });
    });

    child.on('error', (err) => {
      logStream.end();

      jobState.jobs[jobId].status = 'error';
      jobState.jobs[jobId].endTime = new Date().toISOString();
      jobState.jobs[jobId].error = err.message;
      saveJobs();

      removeLock();
      jobState.currentJob = null;

      resolve({
        success: false,
        jobId,
        error: err.message,
      });
    });
  });
}

// Manual backup function for rebuild operation
export async function backupData() {
  const timestamp = new Date().toISOString().replace(/[:\-\.]/g, '').slice(0, 14);
  const backupDir = path.join(path.dirname(DATA_DIR), `data_backup_${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    // Copy all JSON files
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const src = path.join(DATA_DIR, file);
      const dst = path.join(backupDir, file);
      fs.copyFileSync(src, dst);
    }
    return { success: true, backupDir, filesCount: files.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Initialize on module load
loadJobs();

console.log('[JOB-MANAGER] ✓ Initialized');
