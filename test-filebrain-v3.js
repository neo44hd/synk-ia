#!/usr/bin/env node

// Test script for FileBrain v3 — uploads and polling

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const PROVIDER_ID = process.env.PROVIDER_ID || 'test-provider';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUpload() {
  console.log('\n🔍 FileBrain v3 Test Suite');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Create test file
  console.log('📝 Creating test file...');
  const testContent = `TEST INVOICE
  
  Invoice #: INV-2024-001
  Date: 2024-06-27
  Customer: Test Company
  Amount: €1,234.56
  
  Items:
  - Service A: €500.00
  - Service B: €734.56
  
  Total: €1,234.56`;

  const testFile = '/tmp/test-invoice.txt';
  fs.writeFileSync(testFile, testContent, 'utf8');
  console.log(`✅ Test file created: ${testFile}\n`);

  // 2. Upload file
  console.log('📤 Uploading document...');
  const form = new FormData();
  form.append('file', fs.createReadStream(testFile));
  form.append('providerId', PROVIDER_ID);

  let uploadResponse;
  try {
    uploadResponse = await fetch(`${API_URL}/api/filebrain/upload`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
  } catch (err) {
    console.error(`❌ Upload failed (connection): ${err.message}`);
    console.error(`   Make sure server is running: npm start`);
    process.exit(1);
  }

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    console.error(`❌ Upload failed (${uploadResponse.status}): ${error}`);
    process.exit(1);
  }

  const uploadData = await uploadResponse.json();
  console.log(`✅ Document uploaded!`);
  console.log(`   Document ID: ${uploadData.documentId}`);
  console.log(`   Provider ID: ${uploadData.providerId}`);
  console.log(`   Status: ${uploadData.status}`);
  console.log(`   Message: ${uploadData.message}\n`);

  const documentId = uploadData.documentId;

  // 3. Poll status until complete
  console.log('⏳ Polling status...');
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max (1s interval)

  while (attempts < maxAttempts) {
    await sleep(1000);
    attempts++;

    try {
      const statusResponse = await fetch(
        `${API_URL}/api/filebrain/status/${documentId}`
      );
      if (!statusResponse.ok) {
        console.error(`❌ Status check failed (${statusResponse.status})`);
        break;
      }

      const statusData = await statusResponse.json();
      process.stdout.write(
        `   [${attempts}s] Status: ${statusData.status} | Attempts: ${statusData.attempts}/${statusData.maxAttempts}\r`
      );

      if (statusData.status === 'completed') {
        console.log(
          `\n✅ Document processed successfully!                     \n`
        );
        console.log(`   Created At: ${statusData.createdAt}`);
        console.log(`   Started At: ${statusData.startedAt}`);
        console.log(`   Completed At: ${statusData.completedAt}`);
        console.log(`   Total Time: ${new Date(statusData.completedAt) - new Date(statusData.createdAt)}ms\n`);
        return true;
      } else if (statusData.status === 'failed') {
        console.log(`\n❌ Document processing failed!                     \n`);
        console.log(`   Error: ${statusData.error}\n`);
        return false;
      }
    } catch (err) {
      console.error(`\n❌ Status check error: ${err.message}`);
      break;
    }
  }

  if (attempts >= maxAttempts) {
    console.log(`\n⚠️  Timeout waiting for processing                     \n`);
    console.log('   Make sure worker is running: npm run worker\n');
    return false;
  }

  return false;
}

async function testDuplicateDetection() {
  console.log('🔍 Testing duplicate detection...\n');

  const testContent = `DUPLICATE TEST FILE\nThis is a test to detect duplicates.`;
  const testFile = '/tmp/test-duplicate.txt';
  fs.writeFileSync(testFile, testContent, 'utf8');

  // Upload first time
  const form1 = new FormData();
  form1.append('file', fs.createReadStream(testFile));
  form1.append('providerId', 'test-duplicate');

  const res1 = await fetch(`${API_URL}/api/filebrain/upload`, {
    method: 'POST',
    body: form1,
    headers: form1.getHeaders(),
  });

  const data1 = await res1.json();
  console.log(`✅ First upload: ${data1.documentId}`);

  // Upload same file again
  const form2 = new FormData();
  form2.append('file', fs.createReadStream(testFile));
  form2.append('providerId', 'test-duplicate');

  const res2 = await fetch(`${API_URL}/api/filebrain/upload`, {
    method: 'POST',
    body: form2,
    headers: form2.getHeaders(),
  });

  if (res2.status === 409) {
    const data2 = await res2.json();
    console.log(`✅ Duplicate detected (409)!`);
    console.log(`   Existing ID: ${data2.existingDocumentId}`);
    console.log(`   Message: ${data2.error}\n`);
    return true;
  } else {
    console.log(`❌ Duplicate NOT detected (status: ${res2.status})\n`);
    return false;
  }
}

async function testQueueStats() {
  console.log('📊 Checking queue stats...\n');

  const res = await fetch(`${API_URL}/api/filebrain/queue/stats`);
  if (!res.ok) {
    console.error(`❌ Failed to get queue stats (${res.status})`);
    return;
  }

  const data = await res.json();
  console.log(`Queue Statistics:`);
  console.log(`  Total:     ${data.stats.total}`);
  console.log(`  Pending:   ${data.stats.pending}`);
  console.log(`  Processing: ${data.stats.processing}`);
  console.log(`  Completed: ${data.stats.completed}`);
  console.log(`  Failed:    ${data.stats.failed}\n`);
}

async function main() {
  console.log(`📡 API URL: ${API_URL}`);
  console.log(`📦 Provider: ${PROVIDER_ID}\n`);

  const uploadSuccess = await testUpload();
  const dupSuccess = await testDuplicateDetection();
  await testQueueStats();

  console.log('═══════════════════════════════════════════════════════════');
  if (uploadSuccess && dupSuccess) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
