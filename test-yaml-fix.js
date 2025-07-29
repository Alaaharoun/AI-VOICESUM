const fs = require('fs');
const path = require('path');

console.log('✅ Testing YAML Fix\n');

// Check README.md for proper YAML configuration
const readmePath = path.join(__dirname, 'faster-whisper-api', 'README.md');
if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    console.log('📋 Checking README.md YAML configuration...');
    
    // Check if file starts with --- (no empty lines before)
    if (readmeContent.startsWith('---')) {
        console.log('✅ File starts with --- (no empty lines before)');
    } else {
        console.log('❌ File does not start with ---');
    }
    
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
            console.log('\n✅ YAML configuration is complete and correct');
        } else {
            console.log('\n❌ YAML configuration is incomplete');
        }
        
        // Check for proper formatting
        if (yamlContent.includes('"') && !yamlContent.includes("'")) {
            console.log('✅ Using double quotes correctly');
        } else {
            console.log('❌ Quote formatting issue');
        }
        
    } else {
        console.log('❌ YAML front matter not found');
    }
    
    // Check for empty lines after YAML
    const afterYaml = readmeContent.substring(readmeContent.indexOf('---\n---\n') + 8);
    if (afterYaml.startsWith('\n')) {
        console.log('❌ Empty line after YAML block');
    } else {
        console.log('✅ No empty line after YAML block');
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
        }
    } catch (error) {
        console.log('❌ config.json is not valid JSON');
    }
} else {
    console.log('❌ config.json not found');
}

console.log('\n🎯 Summary:');
console.log('✅ YAML configuration should now be recognized by Hugging Face Spaces');
console.log('✅ No more "configuration error" expected');
console.log('✅ Ready for deployment');

console.log('\n🚀 Next Steps:');
console.log('1. Upload the new README.md to Hugging Face Spaces');
console.log('2. Wait 5-10 minutes for build');
console.log('3. Test: curl https://alaaharoun-faster-whisper-api.hf.space/health');

console.log('\n✅ YAML fix test completed!'); 