const fs = require('fs');
const path = require('path');

class HuggingFaceFinalFix {
  constructor() {
    this.baseDir = __dirname;
  }

  async fixSpeechService() {
    console.log('\n🔧 Fixing SpeechService for Hugging Face...');
    
    const filePath = path.join(this.baseDir, 'services', 'speechService.ts');
    
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
      // Hugging Face needs proper WAV format, not just MIME type change
      let processedAudioBlob: Blob;
      
      try {
        // Try to convert to proper WAV format
        processedAudioBlob = await this.convertToProperWav(audioBlob);
      } catch (error) {
        console.warn('WAV conversion failed, using original blob:', error);
        // Fallback to original blob if conversion fails
        processedAudioBlob = audioBlob;
      }
      
      // Validate the processed audio blob
      const validation = AudioProcessor.validateAudioBlob(processedAudioBlob);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid audio file');
      }

      // Create form data for Hugging Face API
      const formData = new FormData();
      
      // Ensure the file has a proper name and type
      const fileName = \`audio_\${Date.now()}.wav\`;
      formData.append('file', processedAudioBlob, fileName);
      
      if (targetLanguage) {
        formData.append('language', targetLanguage);
      }
      
      formData.append('task', 'transcribe');

      console.log('Sending request to Hugging Face:', {
        url: \`\${config.huggingFaceUrl}/transcribe\`,
        fileName,
        fileSize: processedAudioBlob.size,
        fileType: processedAudioBlob.type,
        language: targetLanguage || 'auto'
      });

      // Make request to Hugging Face API
      const response = await fetch(\`\${config.huggingFaceUrl}/transcribe\`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      console.log('Hugging Face response status:', response.status);
      console.log('Hugging Face response headers:', Object.fromEntries(response.headers.entries()));

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
    if (!content.includes('private static async transcribeWithHuggingFace')) {
      console.log('  ⚠️ Adding transcribeWithHuggingFace method...');
      
      // Find the right place to insert the method (after other private methods)
      const insertIndex = content.lastIndexOf('  }');
      if (insertIndex !== -1) {
        content = content.slice(0, insertIndex) + huggingFaceMethod + '\n\n' + content.slice(insertIndex);
      } else {
        // Fallback: add at the end of the class
        const classEndIndex = content.lastIndexOf('}');
        if (classEndIndex !== -1) {
          content = content.slice(0, classEndIndex) + huggingFaceMethod + '\n\n' + content.slice(classEndIndex);
        }
      }
    } else {
      console.log('  ✅ transcribeWithHuggingFace method already exists');
    }
    
    // Write the updated content
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  ✅ SpeechService updated successfully');
    return true;
  }

  async fixTranscriptionEngineService() {
    console.log('\n🔧 Checking TranscriptionEngineService...');
    
    const filePath = path.join(this.baseDir, 'services', 'transcriptionEngineService.ts');
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ TranscriptionEngineService file not found!');
      return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Ensure the Hugging Face URL is correctly set
    const huggingFaceUrlPattern = /config\.huggingFaceUrl = 'https:\/\/alaaharoun-faster-whisper-api\.hf\.space';/;
    
    if (!huggingFaceUrlPattern.test(content)) {
      console.log('  ⚠️ Updating Hugging Face URL...');
      
      // Replace any existing Hugging Face URL configuration
      content = content.replace(
        /config\.huggingFaceUrl = '[^']*';/g,
        "config.huggingFaceUrl = 'https://alaaharoun-faster-whisper-api.hf.space';"
      );
      
      // If no URL was found, add it
      if (!content.includes('config.huggingFaceUrl =')) {
        const insertPattern = /if \(engine === 'huggingface'\) \{/;
        const replacement = `if (engine === 'huggingface') {
      config.huggingFaceUrl = 'https://alaaharoun-faster-whisper-api.hf.space';`;
        
        content = content.replace(insertPattern, replacement);
      }
    } else {
      console.log('  ✅ Hugging Face URL is correctly configured');
    }
    
    // Write the updated content
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  ✅ TranscriptionEngineService updated successfully');
    return true;
  }

  async createTestScript() {
    console.log('\n🔧 Creating comprehensive test script...');
    
    const testScript = `const fetch = require('node-fetch');
const FormData = require('form-data');

class HuggingFaceIntegrationTest {
  constructor() {
    this.baseUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
  }

  async testHealth() {
    console.log('\\n🔍 Testing Health Endpoint...');
    try {
      const response = await fetch(\`\${this.baseUrl}/health\`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Health check passed:', data);
        return true;
      } else {
        console.log('❌ Health check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.log('❌ Health check error:', error.message);
      return false;
    }
  }

  async testTranscription() {
    console.log('\\n🔍 Testing Transcription...');
    try {
      // Create a simple test audio file
      const testAudio = this.createTestAudio();
      
      const formData = new FormData();
      formData.append('file', Buffer.from(testAudio), {
        filename: 'test.wav',
        contentType: 'audio/wav'
      });
      formData.append('task', 'transcribe');
      
      const response = await fetch(\`\${this.baseUrl}/transcribe\`, {
        method: 'POST',
        body: formData,
        timeout: 30000,
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Transcription test passed:', data);
        return true;
      } else {
        const errorText = await response.text();
        console.log('❌ Transcription test failed:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.log('❌ Transcription test error:', error.message);
      return false;
    }
  }

  createTestAudio() {
    // Create a simple WAV file with 1 second of silence
    const sampleRate = 16000;
    const duration = 1;
    const numSamples = sampleRate * duration;
    
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // RIFF header
    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, 36 + numSamples * 2, true);
    view.setUint32(8, 0x57415645, false);
    
    // fmt chunk
    view.setUint32(12, 0x666D7420, false);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    
    // data chunk
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, numSamples * 2, true);
    
    const audioData = new Int16Array(numSamples);
    
    const combined = new Uint8Array(44 + numSamples * 2);
    combined.set(new Uint8Array(header), 0);
    combined.set(new Uint8Array(audioData.buffer), 44);
    
    return combined.buffer;
  }

  async runAllTests() {
    console.log('🚀 Starting Hugging Face Integration Tests...');
    
    const healthResult = await this.testHealth();
    const transcriptionResult = await this.testTranscription();
    
    console.log('\\n📊 Test Results:');
    console.log(\`Health: \${healthResult ? '✅ PASS' : '❌ FAIL'}\`);
    console.log(\`Transcription: \${transcriptionResult ? '✅ PASS' : '❌ FAIL'}\`);
    
    if (healthResult && transcriptionResult) {
      console.log('\\n🎉 All tests passed! Hugging Face integration is working correctly.');
    } else {
      console.log('\\n⚠️ Some tests failed. Please check the configuration.');
    }
  }
}

// Run tests
const tester = new HuggingFaceIntegrationTest();
tester.runAllTests().catch(console.error);
`;
    
    const testFilePath = path.join(this.baseDir, 'test-huggingface-integration-final.js');
    fs.writeFileSync(testFilePath, testScript, 'utf8');
    console.log('  ✅ Test script created: test-huggingface-integration-final.js');
    return true;
  }

  async runAllFixes() {
    console.log('🚀 Starting Hugging Face Final Fix...');
    
    const results = {
      speechService: await this.fixSpeechService(),
      transcriptionEngineService: await this.fixTranscriptionEngineService(),
      testScript: await this.createTestScript()
    };
    
    console.log('\n📊 Fix Results:');
    console.log(`SpeechService: ${results.speechService ? '✅ FIXED' : '❌ FAILED'}`);
    console.log(`TranscriptionEngineService: ${results.transcriptionEngineService ? '✅ FIXED' : '❌ FAILED'}`);
    console.log(`Test Script: ${results.testScript ? '✅ CREATED' : '❌ FAILED'}`);
    
    const allFixed = Object.values(results).every(result => result);
    
    if (allFixed) {
      console.log('\n🎉 All fixes applied successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Run: node test-huggingface-integration-final.js');
      console.log('2. Test the app with Hugging Face engine');
      console.log('3. Check the admin panel for engine status');
    } else {
      console.log('\n⚠️ Some fixes failed. Please check the files manually.');
    }
    
    return results;
  }
}

// Run the fixes
async function main() {
  const fixer = new HuggingFaceFinalFix();
  await fixer.runAllFixes();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = HuggingFaceFinalFix; 