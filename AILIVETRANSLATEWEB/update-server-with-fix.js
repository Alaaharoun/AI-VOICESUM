// Update Server with Azure Speech SDK WebSocket Fix
// This script updates the server to use the fixed WebSocket implementation

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Updating server with Azure Speech SDK WebSocket fix...');

// Read the current server file
const serverPath = path.join(__dirname, 'server.js');
let serverContent = '';

try {
  serverContent = fs.readFileSync(serverPath, 'utf8');
  console.log('✅ Server file read successfully');
} catch (error) {
  console.error('❌ Error reading server file:', error.message);
  process.exit(1);
}

// Check if the fix is already applied
if (serverContent.includes('createFixedWebSocketServer')) {
  console.log('✅ Fix already applied to server');
  process.exit(0);
}

// Import the fix
const fixImport = `
// Import Azure Speech SDK WebSocket fix
import { createFixedWebSocketServer } from './fix-azure-websocket.js';
`;

// Replace the old WebSocket server creation
const oldWebSocketPattern = /function startWebSocketServer\(server\) \{[\s\S]*?\}/;
const newWebSocketImplementation = `function startWebSocketServer(server) {
  // Use the fixed WebSocket server implementation
  return createFixedWebSocketServer(server);
}`;

// Apply the fix
let updatedContent = serverContent;

// Add import at the top
if (!updatedContent.includes('createFixedWebSocketServer')) {
  updatedContent = fixImport + updatedContent;
}

// Replace the WebSocket server function
if (oldWebSocketPattern.test(updatedContent)) {
  updatedContent = updatedContent.replace(oldWebSocketPattern, newWebSocketImplementation);
  console.log('✅ WebSocket server function updated');
} else {
  console.log('⚠️ Could not find WebSocket server function to replace');
}

// Write the updated content back to the file
try {
  fs.writeFileSync(serverPath, updatedContent, 'utf8');
  console.log('✅ Server file updated successfully');
} catch (error) {
  console.error('❌ Error writing server file:', error.message);
  process.exit(1);
}

console.log('🎉 Server update completed successfully!');
console.log('📝 The server now uses the fixed Azure Speech SDK WebSocket implementation');
console.log('🚀 Restart your server to apply the changes');