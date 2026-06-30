/**
 * Manual Email Sync Script
 * Triggers immediate email synchronization from configured accounts
 * Used by Control Center's manual sync button
 */

import { syncAll } from '../server/services/dataSync.js';

async function main() {
  console.log('[SYNC] Manual email synchronization started...');
  
  try {
    const startTime = Date.now();
    await syncAll();
    const duration = Date.now() - startTime;
    
    console.log(`[SYNC] ✓ Synchronization completed in ${(duration / 1000).toFixed(1)}s`);
    process.exit(0);
  } catch (error) {
    console.error(`[SYNC] ✗ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
