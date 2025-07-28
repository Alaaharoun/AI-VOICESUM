// Fix script for Hugging Face production issue
// This addresses the "undefined is not a function" error

const fs = require('fs');
const path = require('path');

// Check if the SpeechService file exists and has the correct content
function checkSpeechServiceFile() {
  console.log('🔍 Checking SpeechService file...');
  
  const filePath = path.join(__dirname, 'services', 'speechService.ts');
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ SpeechService file not found!');
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for key components
  const checks = {
    hasTranscribeWithHuggingFace: content.includes('transcribeWithHuggingFace'),
    hasTranscribeAudio: content.includes('transcribeAudio'),
    hasEngineCheck: content.includes('engine === \'huggingface\''),
    hasFormData: content.includes('FormData'),
    hasFetch: content.includes('fetch'),
    hasExport: content.includes('export class SpeechService'),
  };
  
  console.log('📋 File checks:');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  return Object.values(checks).every(Boolean);
}

// Create a backup of the current file
function createBackup() {
  console.log('\n📋 Creating backup...');
  
  const sourcePath = path.join(__dirname, 'services', 'speechService.ts');
  const backupPath = path.join(__dirname, 'services', 'speechService.backup.ts');
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, backupPath);
    console.log('✅ Backup created: speechService.backup.ts');
  }
}

// Fix the SpeechService file to ensure Hugging Face support
function fixSpeechServiceFile() {
  console.log('\n🔧 Fixing SpeechService file...');
  
  const filePath = path.join(__dirname, 'services', 'speechService.ts');
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ SpeechService file not found!');
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Ensure the transcribeWithHuggingFace method is properly defined
  const huggingFaceMethod = `
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

  // Check if the method already exists
  if (!content.includes('transcribeWithHuggingFace')) {
    console.log('❌ transcribeWithHuggingFace method not found! Adding it...');
    
    // Find the right place to insert the method (after transcribeWithAssemblyAI)
    const insertAfter = 'private static async transcribeWithAssemblyAI';
    const insertIndex = content.indexOf(insertAfter);
    
    if (insertIndex !== -1) {
      // Find the end of the transcribeWithAssemblyAI method
      const methodEnd = content.indexOf('}', insertIndex);
      if (methodEnd !== -1) {
        const beforeMethod = content.substring(0, methodEnd + 1);
        const afterMethod = content.substring(methodEnd + 1);
        
        content = beforeMethod + '\n\n' + huggingFaceMethod + afterMethod;
        console.log('✅ Added transcribeWithHuggingFace method');
      }
    }
  } else {
    console.log('✅ transcribeWithHuggingFace method already exists');
  }
  
  // Ensure the transcribeAudio method properly calls transcribeWithHuggingFace
  if (!content.includes('this.transcribeWithHuggingFace')) {
    console.log('❌ transcribeAudio method not calling transcribeWithHuggingFace! Fixing...');
    
    // Replace the engine check logic
    const oldPattern = /if \(engine === 'huggingface'\) \{[\s\S]*?return await this\.transcribeWithHuggingFace\(audioBlob, targetLanguage\);/;
    const newPattern = `if (engine === 'huggingface') {
        return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
      }`;
    
    if (oldPattern.test(content)) {
      content = content.replace(oldPattern, newPattern);
      console.log('✅ Fixed transcribeAudio method');
    } else {
      console.log('⚠️ Could not find the exact pattern to replace');
    }
  } else {
    console.log('✅ transcribeAudio method correctly calls transcribeWithHuggingFace');
  }
  
  // Write the fixed content back
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ SpeechService file updated');
  
  return true;
}

// Check transcriptionEngineService file
function checkTranscriptionEngineService() {
  console.log('\n🔍 Checking TranscriptionEngineService file...');
  
  const filePath = path.join(__dirname, 'services', 'transcriptionEngineService.ts');
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ TranscriptionEngineService file not found!');
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const checks = {
    hasHuggingFaceUrl: content.includes('huggingFaceUrl'),
    hasGetEngineConfig: content.includes('getEngineConfig'),
    hasGetCurrentEngine: content.includes('getCurrentEngine'),
    hasExport: content.includes('export const transcriptionEngineService'),
  };
  
  console.log('📋 TranscriptionEngineService checks:');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  return Object.values(checks).every(Boolean);
}

// Create a test file to verify the fix
function createTestFile() {
  console.log('\n📋 Creating test file...');
  
  const testContent = `
// Test file to verify Hugging Face functionality
import { SpeechService } from './services/speechService';

async function testHuggingFace() {
  try {
    console.log('🧪 Testing Hugging Face functionality...');
    
    // Create a mock audio blob
    const mockAudioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
    
    // Test transcription
    const result = await SpeechService.transcribeAudio(mockAudioBlob, 'en');
    console.log('✅ Test successful:', result);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testHuggingFace();
`;

  const testPath = path.join(__dirname, 'test-huggingface-fix.js');
  fs.writeFileSync(testPath, testContent, 'utf8');
  console.log('✅ Test file created: test-huggingface-fix.js');
}

// Main fix function
async function fixHuggingFaceProduction() {
  console.log('🚀 Fixing Hugging Face Production Issue...\n');
  
  // Step 1: Check current state
  const speechServiceOk = checkSpeechServiceFile();
  const engineServiceOk = checkTranscriptionEngineService();
  
  if (!speechServiceOk || !engineServiceOk) {
    console.log('\n❌ Issues found! Proceeding with fixes...');
    
    // Step 2: Create backup
    createBackup();
    
    // Step 3: Fix files
    const speechFixed = fixSpeechServiceFile();
    
    if (speechFixed) {
      console.log('\n✅ Fixes applied successfully!');
    } else {
      console.log('\n❌ Failed to apply fixes');
      return;
    }
  } else {
    console.log('\n✅ All files look good!');
  }
  
  // Step 4: Create test file
  createTestFile();
  
  console.log('\n📊 Summary:');
  console.log('===========');
  console.log('✅ Checked SpeechService file');
  console.log('✅ Checked TranscriptionEngineService file');
  console.log('✅ Created backup (if needed)');
  console.log('✅ Applied fixes (if needed)');
  console.log('✅ Created test file');
  console.log('');
  console.log('🔧 Next steps:');
  console.log('1. Rebuild the app: npm run build');
  console.log('2. Test on device: npm run start');
  console.log('3. Run test: node test-huggingface-fix.js');
}

// Run the fix
if (require.main === module) {
  fixHuggingFaceProduction().catch(console.error);
}

module.exports = {
  fixHuggingFaceProduction,
  checkSpeechServiceFile,
  checkTranscriptionEngineService
}; 