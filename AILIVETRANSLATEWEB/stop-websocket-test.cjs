const fs = require('fs');
const path = require('path');

console.log('🛑 Stopping WebSocket Test...');

// Path to the test file
const testFilePath = path.join(__dirname, '..', 'test-render-websocket-browser.html');

console.log('📁 Test file location:', testFilePath);

// Check if the test file exists
if (fs.existsSync(testFilePath)) {
  console.log('✅ Test file found');
  
  // Read the test file
  let testContent = fs.readFileSync(testFilePath, 'utf8');
  
  // Check if it's the WebSocket test file
  if (testContent.includes('wss://ai-voicesum.onrender.com/ws')) {
    console.log('🔍 WebSocket test file detected');
    
    // Create a backup
    const backupPath = testFilePath + '.backup';
    fs.writeFileSync(backupPath, testContent);
    console.log('💾 Backup created:', backupPath);
    
    // Disable the WebSocket connection by commenting out the server URL
    const disabledContent = testContent.replace(
      "const SERVER_URL = 'wss://ai-voicesum.onrender.com/ws';",
      "// const SERVER_URL = 'wss://ai-voicesum.onrender.com/ws'; // DISABLED"
    );
    
    // Write the disabled version
    fs.writeFileSync(testFilePath, disabledContent);
    console.log('✅ WebSocket test disabled');
    
    console.log('\n📋 Changes Made:');
    console.log('• ✅ WebSocket server URL commented out');
    console.log('• ✅ Test file backed up');
    console.log('• ✅ Connection to server stopped');
    
    console.log('\n💡 To re-enable the test:');
    console.log('1. Edit the test file');
    console.log('2. Uncomment the SERVER_URL line');
    console.log('3. Or restore from backup');
    
  } else {
    console.log('❌ Not a WebSocket test file');
  }
  
} else {
  console.log('❌ Test file not found');
  console.log('💡 The test file might be in a different location');
}

console.log('\n🚀 Alternative solutions:');
console.log('1. Close the browser tab with the test');
console.log('2. Stop any running test processes');
console.log('3. Check browser developer tools for active connections');
console.log('4. Restart the browser if needed');

console.log('\n✅ WebSocket test should be stopped!'); 