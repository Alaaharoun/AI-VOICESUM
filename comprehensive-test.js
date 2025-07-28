
// Comprehensive test for Hugging Face functionality
const fs = require('fs');
const path = require('path');

async function testHuggingFaceComprehensive() {
  console.log('🧪 Comprehensive Hugging Face Test...\n');
  
  try {
    // Test 1: Check file existence
    console.log('📋 1. Checking file existence...');
    const files = [
      'services/speechService.ts',
      'services/transcriptionEngineService.ts',
      'services/audioProcessor.ts'
    ];
    
    for (const file of files) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file} exists`);
      } else {
        console.log(`  ❌ ${file} missing`);
      }
    }
    
    // Test 2: Check method definitions
    console.log('\n📋 2. Checking method definitions...');
    const speechServicePath = path.join(__dirname, 'services', 'speechService.ts');
    if (fs.existsSync(speechServicePath)) {
      const content = fs.readFileSync(speechServicePath, 'utf8');
      
      const methods = [
        'transcribeWithHuggingFace',
        'transcribeWithAssemblyAI',
        'transcribeAudio'
      ];
      
      for (const method of methods) {
        if (content.includes(method)) {
          console.log(`  ✅ ${method} method found`);
        } else {
          console.log(`  ❌ ${method} method missing`);
        }
      }
      
      // Check for proper method calls
      if (content.includes('this.transcribeWithHuggingFace')) {
        console.log('  ✅ transcribeWithHuggingFace is properly called');
      } else {
        console.log('  ❌ transcribeWithHuggingFace not properly called');
      }
    }
    
    // Test 3: Check imports
    console.log('\n📋 3. Checking imports...');
    if (fs.existsSync(speechServicePath)) {
      const content = fs.readFileSync(speechServicePath, 'utf8');
      
      const imports = [
        'import { AudioProcessor }',
        'import { transcriptionEngineService',
        'export class SpeechService'
      ];
      
      for (const importStatement of imports) {
        if (content.includes(importStatement)) {
          console.log(`  ✅ ${importStatement} found`);
        } else {
          console.log(`  ❌ ${importStatement} missing`);
        }
      }
    }
    
    console.log('\n🎯 Comprehensive test completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run test
testHuggingFaceComprehensive();
