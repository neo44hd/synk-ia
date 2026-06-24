import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ENDPOINT = `${API_URL}/api/filebrain/upload`;

/**
 * Test file upload with FormData
 */
async function testFileUpload(filePath, filename) {
  console.log(`\n📤 Testing upload: ${filename}`);

  try {
    // Create FormData
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    form.append('file', fileStream, filename);

    // Send request
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 30000,
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      const error = await response.text();
      console.error('Response:', error);
      return null;
    }

    const result = await response.json();
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

/**
 * Create dummy test files
 */
async function createTestFiles() {
  const testDir = path.join(__dirname, 'test-files');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Text file
  const txtFile = path.join(testDir, 'test-document.txt');
  fs.writeFileSync(txtFile, 'This is a test document.\nIt contains some sample text.\nMultiple lines for testing.');

  // JSON file
  const jsonFile = path.join(testDir, 'test-data.json');
  fs.writeFileSync(jsonFile, JSON.stringify({
    name: 'Test Invoice',
    amount: 1250.50,
    date: '2026-06-24',
    vendor: 'Test Supplier Inc.'
  }, null, 2));

  // Markdown file
  const mdFile = path.join(testDir, 'test-contract.md');
  fs.writeFileSync(mdFile, `# Contract Sample

## Parties
- Vendor: Test Company
- Client: Your Organization

## Terms
- Amount: EUR 5,000
- Duration: 12 months
- Payment: Net 30

## Signature
Date: 2026-06-24`);

  return { txtFile, jsonFile, mdFile };
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🔍 FileBrain Upload Endpoint Test Suite');
  console.log('=====================================');
  console.log(`Target: ${ENDPOINT}\n`);

  // Check if server is running
  try {
    const health = await fetch(`${API_URL}/api/health`, { timeout: 5000 });
    if (!health.ok) {
      throw new Error(`Server returned ${health.status}`);
    }
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Server is not accessible:');
    console.error(`   ${API_URL}`);
    console.error(`   Error: ${error.message}\n`);
    console.error('Make sure the server is running with: npm start');
    process.exit(1);
  }

  // Create test files
  console.log('📝 Creating test files...');
  const { txtFile, jsonFile, mdFile } = await createTestFiles();
  console.log('✅ Test files created in ./test-files/\n');

  // Run upload tests
  const results = [];
  results.push(await testFileUpload(txtFile, 'invoice-sample.txt'));
  results.push(await testFileUpload(jsonFile, 'contract-data.json'));
  results.push(await testFileUpload(mdFile, 'document-sample.md'));

  // Summary
  console.log('\n📊 Test Summary');
  console.log('==============');
  const successful = results.filter(r => r !== null).length;
  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${results.length - successful}`);

  if (successful === results.length) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
