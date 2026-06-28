// ═══════════════════════════════════════════════════════════════════════════════
//  File Processor Worker — Async document processing
//  - Reads from file-queue.json
//  - Processes documents (PDF extraction, metadata, etc)
//  - Updates status in queue
//  - Runs in Worker Threads to avoid blocking main thread
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import fsExtra from 'fs-extra';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import {
  getNextPendingJob,
  updateJobStatus,
  canRetry,
  retryJob,
  getQueueStats,
} from '../queue/fileQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─ Configuration ──────────────────────────────────────────────────────────────
const WORKER_INTERVAL = 2000; // Check queue every 2 seconds
const MAX_CONCURRENT_JOBS = 2; // Process 2 files in parallel
let activeJobCount = 0;

// ─ Data directories ──────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MARKDOWN_DIR = path.join(DATA_DIR, 'markdown');
const RAW_DIR = path.join(DATA_DIR, 'raw');

// Ensure directories exist
[DATA_DIR, MARKDOWN_DIR, RAW_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Document Processing Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    } else {
      // TXT, MD, JSON, etc
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error(`[WORKER] Error extracting text from ${filePath}:`, err.message);
    return '';
  }
}

async function extractMetadata(rawText) {
  // Placeholder: integrate with your actual metadata extraction logic
  // In future: use AgentCore for classification
  return {
    pages: (rawText.match(/\n/g) || []).length,
    language: 'es', // Default to Spanish for Chicken Palace
    summary: rawText.substring(0, 300),
    wordCount: rawText.split(/\s+/).length,
  };
}

async function processDocument(job) {
  const { id: documentId, filePath, fileName, providerId } = job;

  try {
    console.log(`[WORKER] 🔄 Processing document ${documentId}...`);
    updateJobStatus(documentId, 'processing');

    // 1. Extract text from file
    const rawText = await extractTextFromFile(filePath);
    if (!rawText) {
      throw new Error('Could not extract text from file');
    }

    // 2. Extract metadata
    const metadata = await extractMetadata(rawText);

    // 3. Build document with frontmatter
    const frontMatter = {
      id: documentId,
      fileName,
      providerId,
      uploadedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      status: 'completed',
      ...metadata,
    };

    // 4. Create markdown file
    const mdContent =
      '---\n' +
      Object.entries(frontMatter)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n') +
      '\n---\n\n' +
      rawText;

    const mdFileName = `${documentId}.md`;
    const mdPath = path.join(MARKDOWN_DIR, mdFileName);
    await fsExtra.writeFile(mdPath, mdContent, 'utf8');

    // 5. Update queue status
    updateJobStatus(documentId, 'completed');
    console.log(`[WORKER] ✅ Document ${documentId} processed successfully`);

    return {
      success: true,
      documentId,
      mdPath,
      metadata,
    };
  } catch (err) {
    console.error(`[WORKER] ❌ Error processing ${documentId}:`, err.message);

    // Attempt retry if allowed
    if (canRetry(documentId)) {
      console.log(`[WORKER] ⚠️  Retrying ${documentId} (attempt ${job.attempts + 1}/${job.maxAttempts})`);
      retryJob(documentId);
      return { success: false, retry: true, error: err.message };
    } else {
      // Mark as failed
      updateJobStatus(documentId, 'failed', { error: err.message });
      return { success: false, retry: false, error: err.message };
    }
  } finally {
    activeJobCount--;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Worker Loop
// ═══════════════════════════════════════════════════════════════════════════════

async function workerLoop() {
  while (true) {
    // Check if we can process more jobs
    if (activeJobCount >= MAX_CONCURRENT_JOBS) {
      await new Promise(resolve => setTimeout(resolve, WORKER_INTERVAL));
      continue;
    }

    // Get next pending job
    const job = getNextPendingJob();
    if (!job) {
      // No pending jobs, log stats periodically
      if (Math.random() < 0.1) {
        const stats = getQueueStats();
        console.log(
          `[WORKER] Queue stats: ${stats.pending} pending, ${stats.processing} processing, ${stats.completed} completed, ${stats.failed} failed`
        );
      }
      await new Promise(resolve => setTimeout(resolve, WORKER_INTERVAL));
      continue;
    }

    // Process the job
    activeJobCount++;
    processDocument(job).catch(err => {
      console.error('[WORKER] Unhandled error in processDocument:', err);
      activeJobCount--;
    });

    // Brief delay between starting jobs
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Startup
// ═══════════════════════════════════════════════════════════════════════════════

console.log('[WORKER] 👷 File processor worker starting...');
console.log(`[WORKER] Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
console.log(`[WORKER] Check interval: ${WORKER_INTERVAL}ms`);

// Start worker loop
workerLoop().catch(err => {
  console.error('[WORKER] Fatal error in worker loop:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WORKER] ⏹️  Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WORKER] ⏹️  Shutting down gracefully...');
  process.exit(0);
});
