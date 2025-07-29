const fs = require('fs');
const path = require('path');

console.log('🔧 Testing Configuration Fix\n');

// Check README.md configuration
const readmePath = path.join(__dirname, 'faster-whisper-api', 'README.md');
if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    console.log('📋 Checking README.md configuration...');
    
    // Check for YAML front matter
    const yamlMatch = readmeContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    
    if (yamlMatch) {
        console.log('✅ YAML front matter found');
        
        const yamlContent = yamlMatch[1];
        const requiredFields = [
            'title: "Faster Whisper API"',
            'emoji: "🎤"',
            'colorFrom: "blue"',
            'colorTo: "purple"',
            'sdk: "docker"',
            'sdk_version: "latest"',
            'app_file: "app.py"',
            'pinned: false'
        ];
        
        let allFieldsPresent = true;
        for (const field of requiredFields) {
            if (yamlContent.includes(field)) {
                console.log(`✅ ${field}`);
            } else {
                console.log(`❌ ${field} - Missing`);
                allFieldsPresent = false;
            }
        }
        
        if (allFieldsPresent) {
            console.log('\n✅ README.md configuration is complete');
        } else {
            console.log('\n❌ README.md configuration is incomplete');
        }
    } else {
        console.log('❌ YAML front matter not found in README.md');
    }
} else {
    console.log('❌ README.md not found');
}

// Check config.json
const configPath = path.join(__dirname, 'faster-whisper-api', 'config.json');
if (fs.existsSync(configPath)) {
    try {
        const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        console.log('\n📋 Checking config.json...');
        
        if (configContent.sdk === 'docker' && configContent.app_file === 'app.py') {
            console.log('✅ config.json is correctly configured');
        } else {
            console.log('❌ config.json has incorrect configuration');
            console.log('Expected: {"sdk": "docker", "app_file": "app.py"}');
            console.log('Found:', JSON.stringify(configContent));
        }
    } catch (error) {
        console.log('❌ config.json is not valid JSON');
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
    
    console.log('\n🚀 Recommended Steps:');
    console.log('1. Delete current Space on Hugging Face');
    console.log('2. Create new Space with Docker SDK');
    console.log('3. Upload files in this order:');
    console.log('   - README.md (first)');
    console.log('   - config.json');
    console.log('   - app.py');
    console.log('   - requirements.txt');
    console.log('   - Dockerfile');
    console.log('   - docker-compose.yml');
    console.log('   - .dockerignore');
    console.log('4. Wait 5-10 minutes for build');
    console.log('5. Test: curl https://alaaharoun-faster-whisper-api.hf.space/health');
    
} else {
    console.log('❌ Some required files are missing');
    console.log('Please ensure all files are present before uploading');
}

console.log('\n✅ Configuration test completed!'); 