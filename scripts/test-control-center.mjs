#!/usr/bin/env node

/**
 * Test Control Center API
 * Validates all endpoints and basic functionality
 */

const BASE_URL = 'http://localhost:9001/api/control';

async function testEndpoint(method, path, body = null, expectStatus = 200) {
  try {
    const url = `${BASE_URL}${path}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    
    const res = await fetch(url, opts);
    const data = await res.json();
    
    const isExpected = res.status === expectStatus;
    const status = isExpected ? '✓' : '✗';
    console.log(`${status} ${method} ${path} (${res.status})`);
    
    if (!isExpected) {
      console.log(`  Error: ${data.error || 'Unknown error'} (expected ${expectStatus})`);
      return false;
    }
    
    console.log(`  Data keys: ${Object.keys(data).slice(0, 3).join(', ')}`);
    return true;
  } catch (err) {
    console.log(`✗ ${method} ${path} (Network error)`);
    console.log(`  Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🧪 Testing Control Center API Endpoints\n');
  
  const results = [];
  
  // Test GET /status
  console.log('1. Status Endpoint:');
  results.push(await testEndpoint('GET', '/status'));
  
  // Test GET /logs/:jobName (should return empty for non-existent)
  console.log('\n2. Logs Endpoint:');
  results.push(await testEndpoint('GET', '/logs/test?lines=10'));
  
  // Test job endpoints (without actual launch)
  console.log('\n3. Job Status (non-existent job):');
  results.push(await testEndpoint('GET', '/jobs/test-123', null, 404));
  
  // Test rebuild without confirmation (should fail)
  console.log('\n4. Rebuild without confirmation:');
  results.push(await testEndpoint('POST', '/rebuild', {}, 400));
  
  // Test rebuild with wrong confirmation (should fail)
  console.log('\n5. Rebuild with wrong confirmation:');
  results.push(await testEndpoint('POST', '/rebuild', { confirm: 'WRONG' }, 400));
  
  console.log('\n📊 Summary:');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✓ All basic endpoints are functional!\n');
    process.exit(0);
  } else {
    console.log('✗ Some endpoints failed. Check configuration.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
