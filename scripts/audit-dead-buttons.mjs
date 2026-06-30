#!/usr/bin/env node

/**
 * Audit Script: Find "dead" buttons (no onClick or href)
 * Helps identify buttons that don't have any functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(__dirname, '..', 'src', 'pages');

// Regex patterns to find buttons and links
const buttonRegex = /<Button[^>]*>/g;
const linkRegex = /<Link[^>]*>/g;
const buttonTextRegex = />([^<]+)<\/Button>/g;

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    const issues = [];
    
    // Find all Button components
    let buttonMatch;
    while ((buttonMatch = buttonRegex.exec(content)) !== null) {
      const buttonTag = buttonMatch[0];
      
      // Check if button has onClick, disabled, or className with disabled
      const hasOnClick = buttonTag.includes('onClick');
      const hasDisabled = buttonTag.includes('disabled');
      const hasHref = buttonTag.includes('href');
      const hasAsChild = buttonTag.includes('asChild');
      
      // If it has onClick or disabled or href or asChild, it's likely functional
      if (!hasOnClick && !hasDisabled && !hasHref && !hasAsChild) {
        // Extract button text to identify it
        const buttonContent = content.substring(buttonMatch.index, buttonMatch.index + 200);
        issues.push({
          type: 'dead-button',
          tag: buttonTag,
          position: buttonMatch.index,
          snippet: buttonContent.substring(0, 150),
        });
      }
    }
    
    return { fileName, issues };
  } catch (err) {
    return { fileName: path.basename(filePath), error: err.message };
  }
}

async function main() {
  console.log('\n🔍 Auditing React buttons for dead/non-functional ones...\n');
  
  const files = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.jsx'))
    .map(f => path.join(pagesDir, f));
  
  const results = files.map(analyzeFile).filter(r => r.issues && r.issues.length > 0);
  
  if (results.length === 0) {
    console.log('✓ No obvious dead buttons found!\n');
    process.exit(0);
  }
  
  console.log(`⚠️  Found potential issues in ${results.length} files:\n`);
  
  results.forEach(result => {
    console.log(`📄 ${result.fileName}`);
    result.issues.forEach(issue => {
      console.log(`   └─ Dead button at position ${issue.position}`);
      console.log(`      ${issue.snippet.replace(/\n/g, '\n      ')}...`);
    });
    console.log();
  });
  
  console.log('\n💡 Note: This is a simple heuristic. Some buttons might be controlled via parent state.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
