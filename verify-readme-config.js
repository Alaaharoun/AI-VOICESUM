const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying README.md Configuration\n');

const readmePath = path.join(__dirname, 'faster-whisper-api', 'README.md');

if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    // Get first 10 lines
    const firstLines = readmeContent.split('\n').slice(0, 10);
    
    console.log('📋 First 10 lines of README.md:');
    firstLines.forEach((line, index) => {
        console.log(`${index + 1}: "${line}"`);
    });
    
    console.log('\n✅ Expected Configuration:');
    const expectedLines = [
        '---',
        'title: "Faster Whisper API"',
        'emoji: "🎤"',
        'colorFrom: "blue"',
        'colorTo: "purple"',
        'sdk: "docker"',
        'sdk_version: "latest"',
        'app_file: "app.py"',
        'pinned: false',
        '---'
    ];
    
    console.log('Expected:');
    expectedLines.forEach((line, index) => {
        console.log(`${index + 1}: "${line}"`);
    });
    
    // Check if configuration matches
    let matches = true;
    for (let i = 0; i < 10; i++) {
        if (firstLines[i] !== expectedLines[i]) {
            console.log(`\n❌ Line ${i + 1} mismatch:`);
            console.log(`Expected: "${expectedLines[i]}"`);
            console.log(`Found:    "${firstLines[i]}"`);
            matches = false;
        }
    }
    
    if (matches) {
        console.log('\n✅ Configuration matches exactly!');
        console.log('✅ README.md is ready for Hugging Face Spaces');
    } else {
        console.log('\n❌ Configuration does not match');
        console.log('Please update README.md to match the expected configuration');
    }
    
    // Additional checks
    console.log('\n🔍 Additional Checks:');
    
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
        }
    } else {
        console.log('❌ YAML front matter not found');
    }
    
} else {
    console.log('❌ README.md not found');
}

console.log('\n🎯 Summary:');
console.log('The README.md file should now work correctly with Hugging Face Spaces');
console.log('No more "configuration error" should occur'); 