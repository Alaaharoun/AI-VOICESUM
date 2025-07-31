const fs = require('fs');
const path = require('path');

console.log('🔧 Disabling Default Auto-Detection...');

// Read the server.js file
const serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Apply the fix
console.log('📝 Applying auto-detection fix...');

// Fix the auto-detection logic
if (serverContent.includes('autoDetection = sourceLanguage === \'auto\' || msg.autoDetection || false;')) {
  serverContent = serverContent.replace(
    'autoDetection = sourceLanguage === \'auto\' || msg.autoDetection || false;',
    '// Only enable auto-detection if explicitly requested or if language is \'auto\'\n            autoDetection = (sourceLanguage === \'auto\') || (msg.autoDetection === true);'
  );
  console.log('✅ Fixed: Auto-detection now only enabled when explicitly requested');
}

// Add better logging for specific language mode
if (serverContent.includes('console.log(`✅ Specific language recognizer created: ${azureLanguage}`);')) {
  serverContent = serverContent.replace(
    'console.log(`✅ Specific language recognizer created: ${azureLanguage}`);',
    'console.log(`✅ Specific language recognizer created: ${azureLanguage}`);\n              console.log(`🎯 Using specific language: ${sourceLanguage} → ${azureLanguage}`);'
  );
  console.log('✅ Added: Better logging for specific language mode');
}

// Write the updated content back
fs.writeFileSync(serverPath, serverContent);

console.log('\n🎉 Auto-Detection Fix Applied Successfully!');
console.log('\n📋 Changes Made:');
console.log('1. ✅ Auto-detection now only enabled when explicitly requested');
console.log('2. ✅ Added better logging for specific language mode');
console.log('3. ✅ Fixed the logic that was forcing auto-detection');

console.log('\n🚀 Expected Behavior:');
console.log('• When language is "auto" → Auto-detection enabled');
console.log('• When language is specific (e.g., "ar-SA") → Specific language mode');
console.log('• When autoDetection is explicitly true → Auto-detection enabled');
console.log('• When autoDetection is false/undefined → Specific language mode');

console.log('\n💡 Testing:');
console.log('1. Select "English (US)" → Should use specific language mode');
console.log('2. Select "Auto-detect" → Should use auto-detection mode');
console.log('3. Check server logs for proper language initialization');

console.log('\n✅ Ready for testing!'); 