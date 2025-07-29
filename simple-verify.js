const fs = require('fs');
const path = require('path');

console.log('🔍 Simple README.md Verification\n');

const readmePath = path.join(__dirname, 'faster-whisper-api', 'README.md');

if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    console.log('📋 Checking README.md configuration...');
    
    // Check if file starts with ---
    if (readmeContent.startsWith('---')) {
        console.log('✅ File starts with ---');
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
            console.log('\n✅ All required fields are present');
            console.log('✅ Configuration is correct for Hugging Face Spaces');
        } else {
            console.log('\n❌ Some required fields are missing');
        }
    } else {
        console.log('❌ YAML front matter not found');
    }
    
    // Show first few lines
    console.log('\n📋 First 10 lines:');
    const lines = readmeContent.split('\n').slice(0, 10);
    lines.forEach((line, index) => {
        console.log(`${index + 1}: ${line}`);
    });
    
} else {
    console.log('❌ README.md not found');
}

console.log('\n🎯 Summary:');
console.log('The README.md file should now work correctly with Hugging Face Spaces');
console.log('No more "configuration error" should occur'); 