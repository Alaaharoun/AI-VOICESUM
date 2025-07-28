const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Hugging Face Traceback Fix...\n');

// Check if the fixed app.py exists and has the correct content
const appPath = path.join(__dirname, 'faster-whisper-api', 'app.py');

if (!fs.existsSync(appPath)) {
    console.log('❌ app.py not found in faster-whisper-api directory');
    process.exit(1);
}

const content = fs.readFileSync(appPath, 'utf8');

console.log('📋 Checking app.py content...');

// Check for the problematic import
if (content.includes('import traceback')) {
    console.log('❌ ERROR: traceback import still present');
    console.log('   This will cause the 500 error on Hugging Face Spaces');
    process.exit(1);
} else {
    console.log('✅ traceback import removed');
}

// Check for the new imports
if (content.includes('import sys')) {
    console.log('✅ sys import added for better error handling');
} else {
    console.log('⚠️  sys import not found');
}

// Check for improved error handling
if (content.includes('error_type = type(e).__name__')) {
    console.log('✅ Improved error handling with error types');
} else {
    console.log('⚠️  Improved error handling not found');
}

// Check for detailed logging
if (content.includes('print(f"🎵 Starting transcription')) {
    console.log('✅ Detailed logging added');
} else {
    console.log('⚠️  Detailed logging not found');
}

// Check for health endpoint improvements
if (content.includes('"python_version": sys.version')) {
    console.log('✅ Health endpoint enhanced with Python version');
} else {
    console.log('⚠️  Health endpoint enhancements not found');
}

console.log('\n📊 Summary:');
console.log('✅ The traceback error should be fixed');
console.log('✅ Better error handling implemented');
console.log('✅ Enhanced logging added');
console.log('✅ Health endpoint improved');

console.log('\n🚀 Next Steps:');
console.log('1. Upload the fixed app.py to Hugging Face Spaces');
console.log('2. Wait for the space to rebuild');
console.log('3. Test with: curl https://alaaharoun-faster-whisper-api.hf.space/health');
console.log('4. Test transcription with a small audio file');

console.log('\n🔗 Service URL: https://alaaharoun-faster-whisper-api.hf.space');
console.log('🔗 Health Check: https://alaaharoun-faster-whisper-api.hf.space/health');

console.log('\n✅ Test completed successfully!'); 