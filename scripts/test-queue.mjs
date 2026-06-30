#!/usr/bin/env node

/**
 * Test persistent queue system
 */

import { enqueueJob, getQueueStatus, loadQueue, completeJob } from '../server/services/persistentJobQueue.js';

console.log('[TEST] Testing persistent queue system\n');

// Load existing queue
loadQueue();

// Test 1: Enqueue a job
console.log('1. Enqueuing test job...');
const job1 = enqueueJob('reprocess-all', { testMode: true });
console.log(`   Job ID: ${job1.id}`);
console.log(`   Status: ${job1.status}`);

// Test 2: Check status
console.log('\n2. Checking queue status...');
const status = getQueueStatus();
console.log(`   Pending jobs: ${status.pending}`);
console.log(`   Completed jobs: ${status.completed}`);
console.log(`   Current job: ${status.currentJob?.id || 'none'}`);

// Test 3: Enqueue another job
console.log('\n3. Enqueuing second job...');
const job2 = enqueueJob('sync-emails');
console.log(`   Job ID: ${job2.id}`);

// Test 4: Check status again
console.log('\n4. Checking queue status again...');
const status2 = getQueueStatus();
console.log(`   Pending jobs: ${status2.pending}`);
console.log(`   Jobs: ${status2.jobs.map(j => j.id).join(', ')}`);

// Test 5: Complete first job
console.log('\n5. Completing first job...');
completeJob(job1.id, true);
const status3 = getQueueStatus();
console.log(`   Pending jobs: ${status3.pending}`);
console.log(`   Completed jobs: ${status3.completed}`);

console.log('\n✓ Queue test completed successfully');
