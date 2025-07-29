const fs = require('fs');
const path = require('path');

console.log('🔧 Testing Hugging Face Spaces Configuration\n');

// Check README.md for required configuration
const readmePath = path.join(__dirname, 'faster-whisper-api', 'README.md');
if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    console.log('📋 Checking README.md configuration...');
    
    const requiredConfig = [
        'title: Faster Whisper API',
        'emoji: 🎤',
        'colorFrom: blue',
        'colorTo: purple',
        'sdk: docker',
        'sdk_version: "latest"',
        'app_file: app.py',
        'pinned: false'
    ];
    
    let allConfigPresent = true;
    for (const config of requiredConfig) {
        if (readmeContent.includes(config)) {
            console.log(`✅ ${config}`);
        } else {
            console.log(`❌ ${config} - Missing`);
            allConfigPresent = false;
        }
    }
    
    if (allConfigPresent) {
        console.log('\n✅ README.md configuration is correct');
    } else {
        console.log('\n❌ README.md configuration is incomplete');
    }
} else {
    console.log('❌ README.md not found');
}

// Check config.json
const configPath = path.join(__dirname, 'faster-whisper-api', 'config.json');
if (fs.existsSync(configPath)) {
    const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('\n📋 Checking config.json...');
    
    if (configContent.sdk === 'docker' && configContent.app_file === 'app.py') {
        console.log('✅ config.json is correctly configured');
    } else {
        console.log('❌ config.json has incorrect configuration');
        console.log('Expected: {"sdk": "docker", "app_file": "app.py"}');
        console.log('Found:', JSON.stringify(configContent));
    }
} else {
    console.log('❌ config.json not found');
}

// Check all required files
const requiredFiles = [
    'app.py',
    'requirements.txt',
    'Dockerfile',
    'config.json',
    'README.md'
];

console.log('\n📋 Checking required files...');
let allFilesPresent = true;
for (const file of requiredFiles) {
    const filePath = path.join(__dirname, 'faster-whisper-api', file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
        console.log(`❌ ${file} - Missing`);
        allFilesPresent = false;
    }
}

console.log('\n🎯 Summary:');
if (allFilesPresent) {
    console.log('✅ All required files are present');
    console.log('✅ Configuration should be correct for Hugging Face Spaces');
    console.log('✅ Ready for deployment');
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Upload all files from faster-whisper-api/ to Hugging Face Spaces');
    console.log('2. Wait for Docker build (5-10 minutes)');
    console.log('3. Test: curl https://alaaharoun-faster-whisper-api.hf.space/health');
    
    console.log('\n🔗 Service URLs:');
    console.log('   Main: https://alaaharoun-faster-whisper-api.hf.space');
    console.log('   Health: https://alaaharoun-faster-whisper-api.hf.space/health');
    console.log('   Docs: https://alaaharoun-faster-whisper-api.hf.space/docs');
    
} else {
    console.log('❌ Some required files are missing');
    console.log('Please ensure all files are present before uploading');
}

console.log('\n✅ Configuration test completed!'); 