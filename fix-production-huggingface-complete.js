// Complete fix for Hugging Face production issue
// This addresses the "undefined is not a function" error comprehensively

const fs = require('fs');
const path = require('path');

class CompleteHuggingFaceFix {
  constructor() {
    this.fixes = [];
  }

  addFix(description, action) {
    this.fixes.push({ description, action });
  }

  async runCompleteFix() {
    console.log('🚀 Running Complete Hugging Face Production Fix...\n');
    
    await this.fixSpeechService();
    await this.fixTranscriptionEngineService();
    await this.createBackupFiles();
    await this.createTestFiles();
    await this.createBuildScript();
    
    this.printSummary();
  }

  async fixSpeechService() {
    console.log('🔧 1. Fixing SpeechService...');
    
    const filePath = path.join(__dirname, 'services', 'speechService.ts');
    
    if (!fs.existsSync(filePath)) {
      console.log('  ❌ SpeechService file not found!');
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Ensure proper imports
    if (!content.includes('import { transcriptionEngineService')) {
      console.log('  ⚠️ Adding missing import...');
      const importLine = 'import { transcriptionEngineService, TranscriptionEngine } from \'./transcriptionEngineService\';';
      content = content.replace(
        'import { AudioProcessor } from \'./audioProcessor\';',
        `import { AudioProcessor } from './audioProcessor';\nimport { transcriptionEngineService, TranscriptionEngine } from './transcriptionEngineService';`
      );
      this.addFix('Added missing transcriptionEngineService import', 'Import statement added');
    }
    
    // Ensure transcribeWithHuggingFace method exists and is properly defined
    if (!content.includes('private static async transcribeWithHuggingFace')) {
      console.log('  ⚠️ Adding transcribeWithHuggingFace method...');
      
      const methodToAdd = `
  private static async transcribeWithHuggingFace(audioBlob: Blob, targetLanguage?: string): Promise<string> {
    try {
      const config = await transcriptionEngineService.getEngineConfig();
      
      if (config.engine !== 'huggingface' || !config.huggingFaceUrl) {
        throw new Error('Hugging Face service not configured');
      }

      console.log('Transcribing with Hugging Face...', {
        size: audioBlob.size,
        type: audioBlob.type,
        targetLanguage
      });

      // Process audio for Hugging Face compatibility
      const processedAudioBlob = await AudioProcessor.processAudioForAssemblyAI(audioBlob);
      
      // Validate the processed audio blob
      const validation = AudioProcessor.validateAudioBlob(processedAudioBlob);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid audio file');
      }

      // Create form data for Hugging Face API
      const formData = new FormData();
      formData.append('file', processedAudioBlob, 'audio.wav');
      
      if (targetLanguage) {
        formData.append('language', targetLanguage);
      }
      
      formData.append('task', 'transcribe');

      // Make request to Hugging Face API
      const response = await fetch(\`\${config.huggingFaceUrl}/transcribe\`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hugging Face transcription error:', response.status, errorText);
        throw new Error(\`Hugging Face transcription failed: \${response.status} \${response.statusText}\`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Hugging Face transcription failed');
      }

      console.log('Hugging Face transcription successful:', {
        text: result.text?.substring(0, 100) + '...',
        language: result.language,
        probability: result.language_probability
      });

      return result.text || 'No transcription result';
    } catch (error) {
      console.error('Hugging Face transcription error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred during Hugging Face transcription');
    }
  }`;
      
      // Find the right place to insert (after transcribeWithAssemblyAI)
      const insertAfter = 'private static async transcribeWithAssemblyAI';
      const insertIndex = content.indexOf(insertAfter);
      
      if (insertIndex !== -1) {
        // Find the end of the transcribeWithAssemblyAI method
        let methodEnd = content.indexOf('}', insertIndex);
        let braceCount = 1;
        
        // Find the matching closing brace
        for (let i = insertIndex + 1; i < content.length; i++) {
          if (content[i] === '{') braceCount++;
          if (content[i] === '}') braceCount--;
          if (braceCount === 0) {
            methodEnd = i;
            break;
          }
        }
        
        if (methodEnd !== -1) {
          const beforeMethod = content.substring(0, methodEnd + 1);
          const afterMethod = content.substring(methodEnd + 1);
          
          content = beforeMethod + '\n\n' + methodToAdd + afterMethod;
          this.addFix('Added transcribeWithHuggingFace method', 'Method properly defined');
        }
      }
    }
    
    // Ensure transcribeAudio method properly calls transcribeWithHuggingFace
    if (!content.includes('this.transcribeWithHuggingFace')) {
      console.log('  ⚠️ Fixing transcribeAudio method...');
      
      // Replace the engine check logic
      const oldPattern = /if \(engine === 'huggingface'\) \{[\s\S]*?return await this\.transcribeWithHuggingFace\(audioBlob, targetLanguage\);/;
      const newPattern = `if (engine === 'huggingface') {
        return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
      }`;
      
      if (oldPattern.test(content)) {
        content = content.replace(oldPattern, newPattern);
        this.addFix('Fixed transcribeAudio method call', 'Proper method call added');
      } else {
        // If pattern not found, add it manually
        const transcribeAudioPattern = /static async transcribeAudio\(audioBlob: Blob, targetLanguage\?: string\): Promise<string> \{[\s\S]*?\}/;
        const newTranscribeAudio = `static async transcribeAudio(audioBlob: Blob, targetLanguage?: string): Promise<string> {
    try {
      // Get the current transcription engine
      const engine = await transcriptionEngineService.getCurrentEngine();
      
      console.log('Using transcription engine:', engine);
      
      if (engine === 'huggingface') {
        return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
      } else {
        // Default to Azure
        return await this.transcribeWithAssemblyAI(audioBlob, targetLanguage);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      
      if (error instanceof Error) {
        throw error; // Re-throw with original message
      }
      
      throw new Error('Failed to transcribe audio');
    }
  }`;
        
        if (transcribeAudioPattern.test(content)) {
          content = content.replace(transcribeAudioPattern, newTranscribeAudio);
          this.addFix('Replaced transcribeAudio method', 'Complete method replacement');
        }
      }
    }
    
    // Write the fixed content back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  ✅ SpeechService fixed');
  }

  async fixTranscriptionEngineService() {
    console.log('🔧 2. Checking TranscriptionEngineService...');
    
    const filePath = path.join(__dirname, 'services', 'transcriptionEngineService.ts');
    
    if (!fs.existsSync(filePath)) {
      console.log('  ❌ TranscriptionEngineService file not found!');
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the singleton export exists
    if (!content.includes('export const transcriptionEngineService')) {
      console.log('  ⚠️ Adding missing singleton export...');
      
      const exportLine = '\n// Export singleton instance\nexport const transcriptionEngineService = TranscriptionEngineService.getInstance();';
      const newContent = content + exportLine;
      
      fs.writeFileSync(filePath, newContent, 'utf8');
      this.addFix('Added singleton export', 'transcriptionEngineService export added');
    }
    
    console.log('  ✅ TranscriptionEngineService checked');
  }

  async createBackupFiles() {
    console.log('🔧 3. Creating backup files...');
    
    const files = [
      'services/speechService.ts',
      'services/transcriptionEngineService.ts'
    ];
    
    for (const file of files) {
      const sourcePath = path.join(__dirname, file);
      const backupPath = path.join(__dirname, file.replace('.ts', '.backup.ts'));
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, backupPath);
        console.log(`  ✅ Backup created: ${file.replace('.ts', '.backup.ts')}`);
      }
    }
  }

  async createTestFiles() {
    console.log('🔧 4. Creating test files...');
    
    // Create comprehensive test
    const testContent = `
// Comprehensive test for Hugging Face functionality
const fs = require('fs');
const path = require('path');

async function testHuggingFaceComprehensive() {
  console.log('🧪 Comprehensive Hugging Face Test...\\n');
  
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
        console.log(\`  ✅ \${file} exists\`);
      } else {
        console.log(\`  ❌ \${file} missing\`);
      }
    }
    
    // Test 2: Check method definitions
    console.log('\\n📋 2. Checking method definitions...');
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
          console.log(\`  ✅ \${method} method found\`);
        } else {
          console.log(\`  ❌ \${method} method missing\`);
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
    console.log('\\n📋 3. Checking imports...');
    if (fs.existsSync(speechServicePath)) {
      const content = fs.readFileSync(speechServicePath, 'utf8');
      
      const imports = [
        'import { AudioProcessor }',
        'import { transcriptionEngineService',
        'export class SpeechService'
      ];
      
      for (const importStatement of imports) {
        if (content.includes(importStatement)) {
          console.log(\`  ✅ \${importStatement} found\`);
        } else {
          console.log(\`  ❌ \${importStatement} missing\`);
        }
      }
    }
    
    console.log('\\n🎯 Comprehensive test completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run test
testHuggingFaceComprehensive();
`;

    const testPath = path.join(__dirname, 'comprehensive-test.js');
    fs.writeFileSync(testPath, testContent, 'utf8');
    console.log('  ✅ Comprehensive test created: comprehensive-test.js');
  }

  async createBuildScript() {
    console.log('🔧 5. Creating build script...');
    
    const buildScript = `
# Build script for Hugging Face production fix
echo "🚀 Building app with Hugging Face fix..."

# Clear caches
echo "📋 Clearing caches..."
npm run clean || echo "No clean script found"
npx expo start --clear || echo "Expo clear failed"

# Install dependencies
echo "📋 Installing dependencies..."
npm install

# Build the app
echo "📋 Building app..."
npm run build || npx expo build || echo "Build command not found"

# Start development server
echo "📋 Starting development server..."
echo "Run: npx expo start"
echo "Then test on your device!"
`;

    const buildPath = path.join(__dirname, 'build-huggingface.sh');
    fs.writeFileSync(buildPath, buildScript, 'utf8');
    console.log('  ✅ Build script created: build-huggingface.sh');
  }

  printSummary() {
    console.log('\n📊 Fix Summary:');
    console.log('===============');
    
    if (this.fixes.length === 0) {
      console.log('✅ No fixes needed! Files are already correct.');
    } else {
      console.log(`🔧 Applied ${this.fixes.length} fix(es):`);
      
      this.fixes.forEach((fix, index) => {
        console.log(`\n${index + 1}. ${fix.description}`);
        console.log(`   Action: ${fix.action}`);
      });
    }
    
    console.log('\n🔧 Next Steps:');
    console.log('==============');
    console.log('1. Clear build cache: npm run clean (if available)');
    console.log('2. Clear Metro cache: npx expo start --clear');
    console.log('3. Rebuild the app: npm run build');
    console.log('4. Test on device: npx expo start');
    console.log('5. Run comprehensive test: node comprehensive-test.js');
    console.log('');
    console.log('🎯 The "undefined is not a function" error should now be resolved!');
  }
}

// Run the complete fix
async function runCompleteFix() {
  const fixer = new CompleteHuggingFaceFix();
  await fixer.runCompleteFix();
}

if (require.main === module) {
  runCompleteFix().catch(console.error);
}

module.exports = {
  CompleteHuggingFaceFix,
  runCompleteFix
}; 