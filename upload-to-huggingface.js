const fs = require('fs');
const path = require('path');

console.log('🚀 Hugging Face Spaces Upload Helper\n');

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

console.log('\n📋 Upload Instructions:');
console.log('1. Go to your Hugging Face Spaces dashboard');
console.log('2. Navigate to: https://huggingface.co/spaces/alaaharoun/alaaharoun-faster-whisper-api');
console.log('3. Click on "Files" tab');
console.log('4. Upload each file from the faster-whisper-api/ directory:');

filesToUpload.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
});

console.log('\n📋 Alternative: Git Upload');
console.log('If you have git access, you can also:');
console.log('1. Clone the repository:');
console.log('   git clone https://huggingface.co/spaces/alaaharoun/alaaharoun-faster-whisper-api');
console.log('2. Copy files from faster-whisper-api/ to the cloned directory');
console.log('3. Commit and push:');
console.log('   git add .');
console.log('   git commit -m "Fix Docker configuration and traceback error"');
console.log('   git push');

console.log('\n🔧 Manual Upload Steps:');
console.log('1. Open https://huggingface.co/spaces/alaaharoun/alaaharoun-faster-whisper-api');
console.log('2. Click "Files" tab');
console.log('3. Click "Add file" button');
console.log('4. Upload each file one by one:');

filesToUpload.forEach((file, index) => {
    const filePath = path.join(__dirname, 'faster-whisper-api', file);
    if (fs.existsSync(filePath)) {
        console.log(`   📁 ${file}`);
    }
});

console.log('\n⏱️ After Upload:');
console.log('1. Wait 5-10 minutes for Docker build');
console.log('2. Check build logs in the "Settings" tab');
console.log('3. Test the service: https://alaaharoun-faster-whisper-api.hf.space/health');

console.log('\n🧪 Test Commands:');
console.log('After successful deployment, test with:');
console.log('curl https://alaaharoun-faster-whisper-api.hf.space/health');

console.log('\n📊 Expected Results:');
console.log('✅ Health endpoint should return 200 OK');
console.log('✅ Transcription should work without 500 errors');
console.log('✅ No more "traceback" errors');

console.log('\n🔗 Important URLs:');
console.log('   Main Service: https://alaaharoun-faster-whisper-api.hf.space');
console.log('   Health Check: https://alaaharoun-faster-whisper-api.hf.space/health');
console.log('   API Docs: https://alaaharoun-faster-whisper-api.hf.space/docs');

console.log('\n✅ Upload helper completed!');
console.log('Follow the instructions above to upload your files to Hugging Face Spaces.'); 