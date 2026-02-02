#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the push notification handlers from sw-push.js
const swPushPath = path.join(__dirname, '../public/sw-push.js');
const swPath = path.join(__dirname, '../public/sw.js');

try {
  // Read both files
  let swPushContent = fs.readFileSync(swPushPath, 'utf8');
  let swContent = fs.readFileSync(swPath, 'utf8');

  // Check if handlers already exist
  if (swContent.includes('notificationclick')) {
    console.log('✓ Push notification handlers already present in sw.js');
    process.exit(0);
  }

  // Extract push notification handlers from sw-push.js
  // Get the handler code (skip header comments)
  const lines = swPushContent.split('\n');
  const startIdx = lines.findIndex(line => line.includes('Handle push notification events'));
  const handlers = lines.slice(startIdx).join('\n').trim();

  // Append handlers to sw.js before the last closing brace/parenthesis
  const newSwContent = swContent.trimEnd() + '\n\n' + handlers + '\n';
  
  fs.writeFileSync(swPath, newSwContent, 'utf8');
  console.log('✓ Push notification handlers merged into sw.js');
} catch (error) {
  console.error('Error merging service worker files:', error);
  process.exit(1);
}
