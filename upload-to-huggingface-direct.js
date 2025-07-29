const fs = require('fs');
const path = require('path');

console.log('🚀 Direct Upload to Hugging Face Spaces\n');

// List all files that need to be uploaded
const filesToUpload = [
    'app.py',
    'requirements.txt',
    'Dockerfile',
    'config.json',
    'docker-compose.yml',
    '.dockerignore',
    'README.md'
];

console.log('📋 Files ready for upload:');
filesToUpload.forEach(file => {
    const filePath = path.join(__dirname, 'faster-whisper-api', file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
        console.log(`❌ ${file} (missing)`);
    }
});

console.log('\n🔧 Manual Upload Steps:');
console.log('1. Open your browser and go to:');
console.log('   https://huggingface.co/spaces/alaaharoun/alaaharoun-faster-whisper-api');
console.log('');
console.log('2. Click on "Files" tab');
console.log('');
console.log('3. Click "Add file" button for each file:');

filesToUpload.forEach((file, index) => {
    const filePath = path.join(__dirname, 'faster-whisper-api', file);
    if (fs.existsSync(filePath)) {
        console.log(`   ${index + 1}. ${file}`);
    }
});

console.log('\n📋 Alternative: Create New Space');
console.log('If the space doesn\'t exist, create a new one:');
console.log('1. Go to: https://huggingface.co/spaces');
console.log('2. Click "Create new Space"');
console.log('3. Choose "Docker" as SDK');
console.log('4. Name it: alaaharoun-faster-whisper-api');
console.log('5. Upload the files from faster-whisper-api/ directory');

console.log('\n⏱️ After Upload:');
console.log('1. Wait 5-10 minutes for Docker build');
console.log('2. Check build logs in "Settings" tab');
console.log('3. Test the service:');
console.log('   curl https://alaaharoun-faster-whisper-api.hf.space/health');

console.log('\n🧪 Test Commands:');
console.log('After successful deployment:');
console.log('curl https://alaaharoun-faster-whisper-api.hf.space/health');

console.log('\n📊 Expected Results:');
console.log('✅ Health endpoint should return 200 OK');
console.log('✅ No more "traceback" errors');
console.log('✅ No more "config error"');
console.log('✅ Transcription should work');

console.log('\n🔗 Important URLs:');
console.log('   Main Service: https://alaaharoun-faster-whisper-api.hf.space');
console.log('   Health Check: https://alaaharoun-faster-whisper-api.hf.space/health');
console.log('   API Docs: https://alaaharoun-faster-whisper-api.hf.space/docs');

console.log('\n✅ Upload instructions completed!');
console.log('Follow the manual steps above to upload your files.'); 