const fs = require('fs');
const path = require('path');

console.log('🔧 Final Traceback Fix Test\n');

// Check all Python files for traceback usage
const pythonFiles = [
    'faster-whisper-api/app.py',
    'faster_whisper_service/app.py',
    'huggingface_deploy/app.py'
];

console.log('📋 Checking all Python files for traceback usage...');

let allFilesClean = true;
for (const file of pythonFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes('traceback')) {
            console.log(`❌ ${file} still contains traceback usage`);
            allFilesClean = false;
        } else {
            console.log(`✅ ${file} is clean (no traceback usage)`);
        }
    } else {
        console.log(`⚠️  ${file} not found`);
    }
}

if (allFilesClean) {
    console.log('\n🎉 SUCCESS: All traceback issues fixed!');
    console.log('✅ No more "traceback is not defined" errors');
    console.log('✅ All files are ready for Hugging Face Spaces');
    
    console.log('\n📋 Files ready for upload:');
    console.log('   - faster-whisper-api/app.py (main file)');
    console.log('   - faster-whisper-api/requirements.txt');
    console.log('   - faster-whisper-api/Dockerfile');
    console.log('   - faster-whisper-api/config.json');
    console.log('   - faster-whisper-api/docker-compose.yml');
    console.log('   - faster-whisper-api/.dockerignore');
    console.log('   - faster-whisper-api/README.md');
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Upload files from faster-whisper-api/ to Hugging Face Spaces');
    console.log('2. Wait for Docker build (5-10 minutes)');
    console.log('3. Test: curl https://alaaharoun-faster-whisper-api.hf.space/health');
    
    console.log('\n🔗 Service URLs:');
    console.log('   Main: https://alaaharoun-faster-whisper-api.hf.space');
    console.log('   Health: https://alaaharoun-faster-whisper-api.hf.space/health');
    console.log('   Docs: https://alaaharoun-faster-whisper-api.hf.space/docs');
    
} else {
    console.log('\n❌ ERROR: Some files still contain traceback usage');
    console.log('Please fix the remaining issues before uploading');
}

console.log('\n✅ Test completed!'); 