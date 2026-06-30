#!/usr/bin/env node

/**
 * Integration test for persistent queue system
 * Tests:
 * 1. Queue persistence across module reloads
 * 2. Job state transitions
 * 3. Progress tracking
 * 4. Error handling
 * 5. History management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'job_queue.json');

// Helper: Clear queue file
function resetQueue() {
  if (fs.existsSync(QUEUE_FILE)) {
    fs.unlinkSync(QUEUE_FILE);
  }
}

// Helper: Read queue from disk
function readQueueFile() {
  if (!fs.existsSync(QUEUE_FILE)) return { jobs: [], history: [] };
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  PERSISTENT QUEUE INTEGRATION TEST SUITE');
console.log('═══════════════════════════════════════════════════\n');

// Test 1: Module imports
console.log('TEST 1: Module Imports');
console.log('─────────────────────────────────────────────────');
try {
  const { enqueueJob, getQueueStatus, loadQueue, completeJob, updateJobProgress } = 
    await import('../server/services/persistentJobQueue.js');
  console.log('✓ All required functions imported');

  // Test 2: Queue persistence
  console.log('\nTEST 2: Queue Persistence');
  console.log('─────────────────────────────────────────────────');
  resetQueue();
  
  const job1 = enqueueJob('reprocess-all', { batch: 1 });
  console.log(`✓ Job 1 enqueued: ${job1.id}`);
  
  // Verify file created
  if (fs.existsSync(QUEUE_FILE)) {
    console.log('✓ Queue file created at', QUEUE_FILE);
  } else {
    throw new Error('Queue file not created');
  }

  // Test 3: Load queue after "server restart"
  console.log('\nTEST 3: Queue Recovery (Simulated Restart)');
  console.log('─────────────────────────────────────────────────');
  loadQueue(); // Simulate server restart loading queue
  const status1 = getQueueStatus();
  if (status1.pending === 1 && status1.jobs[0].id === job1.id) {
    console.log('✓ Queue recovered successfully after simulated restart');
    console.log(`  - Pending jobs: ${status1.pending}`);
  } else {
    throw new Error('Queue recovery failed');
  }

  // Test 4: Multiple jobs
  console.log('\nTEST 4: Multiple Jobs in Queue');
  console.log('─────────────────────────────────────────────────');
  const job2 = enqueueJob('sync-emails');
  const job3 = enqueueJob('verify');
  const status2 = getQueueStatus();
  if (status2.pending === 3) {
    console.log(`✓ Three jobs enqueued and queued`);
    console.log(`  - Jobs: ${status2.jobs.map(j => j.type).join(', ')}`);
  } else {
    throw new Error(`Expected 3 pending jobs, got ${status2.pending}`);
  }

  // Test 5: Progress tracking
  console.log('\nTEST 5: Progress Tracking');
  console.log('─────────────────────────────────────────────────');
  updateJobProgress(job1.id, '42/182');
  const queueData = readQueueFile();
  const updatedJob = queueData.jobs.find(j => j.id === job1.id);
  if (updatedJob.progress === '42/182') {
    console.log('✓ Progress updated successfully');
    console.log(`  - Current: ${updatedJob.progress}`);
  } else {
    throw new Error('Progress tracking failed');
  }

  // Test 6: Job completion
  console.log('\nTEST 6: Job Completion & History');
  console.log('─────────────────────────────────────────────────');
  completeJob(job1.id, true);
  const status3 = getQueueStatus();
  if (status3.pending === 2 && status3.completed === 1) {
    console.log('✓ Job moved to history');
    console.log(`  - Pending: ${status3.pending}`);
    console.log(`  - Completed: ${status3.completed}`);
  } else {
    throw new Error('Job completion failed');
  }

  // Test 7: Error tracking
  console.log('\nTEST 7: Error Tracking');
  console.log('─────────────────────────────────────────────────');
  completeJob(job2.id, false, 'Test error message');
  // Read from file directly to check error
  const historyData = readQueueFile();
  const failedJob = historyData.history.find(j => j.id === job2.id);
  if (failedJob && failedJob.error === 'Test error message') {
    console.log('✓ Error message tracked');
    console.log(`  - Error: ${failedJob.error}`);
  } else {
    throw new Error('Error tracking failed');
  }

  // Test 8: Current job detection
  console.log('\nTEST 8: Current Job Detection');
  console.log('─────────────────────────────────────────────────');
  const currentJob = getQueueStatus().currentJob;
  if (!currentJob) {
    console.log('✓ No job currently running (as expected)');
  } else {
    console.log('ℹ Current job:', currentJob.id);
  }

  // Test 9: File integrity
  console.log('\nTEST 9: File Integrity Check');
  console.log('─────────────────────────────────────────────────');
  const fileData = readQueueFile();
  if (Array.isArray(fileData.jobs) && Array.isArray(fileData.history)) {
    console.log('✓ Queue file structure valid');
    console.log(`  - Jobs: ${fileData.jobs.length}`);
    console.log(`  - History: ${fileData.history.length}`);
  } else {
    throw new Error('Queue file structure invalid');
  }

  // Test 10: All jobs accounted for
  console.log('\nTEST 10: Total Jobs Accounting');
  console.log('─────────────────────────────────────────────────');
  const total = fileData.jobs.length + fileData.history.length;
  if (total === 3) {
    console.log('✓ All 3 jobs accounted for');
    console.log(`  - Pending: ${fileData.jobs.length}`);
    console.log(`  - History: ${fileData.history.length}`);
  } else {
    throw new Error(`Expected 3 total jobs, got ${total}`);
  }

  // Cleanup
  resetQueue();
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✓ ALL TESTS PASSED');
  console.log('═══════════════════════════════════════════════════\n');

} catch (err) {
  console.error('\n✗ TEST FAILED');
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
