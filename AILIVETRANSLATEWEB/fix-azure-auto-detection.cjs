const fs = require('fs');
const path = require('path');

console.log('🔧 Applying Azure Auto-Detection Fix...');

// Read the updated server.js from the root directory
const serverPath = path.join(__dirname, '..', 'server.js');
const targetPath = path.join(__dirname, 'server.js');

try {
  // Copy the fixed server.js to the web directory
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  fs.writeFileSync(targetPath, serverContent);
  
  console.log('✅ Server file updated with auto-detection fixes');
  console.log('📝 Changes applied:');
  console.log('- Improved auto-detection setup with better error handling');
  console.log('- Added network error recovery mechanism');
  console.log('- Enhanced audio processing with better error handling');
  console.log('- Added connection timeout protection');
  console.log('- Reduced language set for better compatibility');
  
  console.log('\n🚀 Ready to deploy with fixes!');
  console.log('💡 The server now has:');
  console.log('  • Better auto-detection fallback mechanisms');
  console.log('  • Network error recovery');
  console.log('  • Improved audio processing');
  console.log('  • Connection timeout protection');
  
} catch (error) {
  console.error('❌ Error applying fixes:', error.message);
  process.exit(1);
} 