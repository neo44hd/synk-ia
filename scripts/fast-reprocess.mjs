#!/usr/bin/env node

/**
 * Fast Reprocessing Script
 * Processes ALL uploaded files with maximum parallelization
 * Optimized for speed and reliability
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Configuration
const BATCH_SIZE = 10; // Process 10 files in parallel
const TIMEOUT = 120000; // 2 min per file

console.log(`\n⚡ FAST REPROCESSING INITIATED\n`);
console.log(`📂 Uploads dir: ${UPLOADS_DIR}`);
console.log(`📊 Data dir: ${DATA_DIR}`);

// Get all files
const files = fs.readdirSync(UPLOADS_DIR)
  .filter(f => /\.(pdf|jpg|jpeg|png|docx?|xlsx?|txt)$/i.test(f))
  .map(f => path.join(UPLOADS_DIR, f));

console.log(`\n📋 Found ${files.length} files to process`);

if (files.length === 0) {
  console.log('✓ No files to process');
  process.exit(0);
}

// Process in batches
let processed = 0;
let failed = 0;

async function processBatch(batch) {
  const promises = batch.map(async (filePath) => {
    try {
      console.log(`[${processed + 1}/${files.length}] Processing: ${path.basename(filePath)}`);
      
      // Call the reprocess script for each file
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), TIMEOUT);
        try {
          execSync(`node "${path.join(__dirname, 'test-doc.mjs')}" "${filePath}"`, {
            stdio: 'pipe',
            timeout: TIMEOUT
          });
          clearTimeout(timeout);
          processed++;
          resolve();
        } catch (err) {
          clearTimeout(timeout);
          failed++;
          console.error(`  ✗ Failed: ${err.message}`);
          resolve(); // Continue despite error
        }
      });
    } catch (err) {
      failed++;
      console.error(`  ✗ Error: ${err.message}`);
    }
  });

  return Promise.all(promises);
}

// Main loop
async function main() {
  const startTime = Date.now();
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await processBatch(batch);
    
    const progress = Math.round((processed / files.length) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✓ Progress: ${processed}/${files.length} (${progress}%) [${elapsed}s elapsed]\n`);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ REPROCESSING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Duration: ${duration}s`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${Math.round((processed / files.length) * 100)}%`);
  console.log('='.repeat(60) + '\n');

  // Verify data
  try {
    const docs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'documents.json'), 'utf-8'));
    const invoices = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'invoice.json'), 'utf-8'));
    const providers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'provider.json'), 'utf-8'));
    
    console.log('\n📊 Final Data State:');
    console.log(`   📄 Documents: ${docs.length}`);
    console.log(`   💰 Invoices: ${invoices.length}`);
    console.log(`   🏢 Providers: ${providers.length}`);
  } catch (err) {
    console.error('Error reading data files:', err.message);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
