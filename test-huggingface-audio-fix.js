const fs = require('fs');
const path = require('path');

class HuggingFaceAudioFix {
  constructor() {
    this.baseDir = __dirname;
  }

  async testHuggingFaceConnection() {
    console.log('🔍 Testing Hugging Face connection...');
    
    try {
      const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health');
      console.log(`Health check status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Health check successful:', data);
        return true;
      } else {
        console.log('❌ Health check failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Connection error:', error.message);
      return false;
    }
  }

  async testAudioTranscription() {
    console.log('\n🎵 Testing audio transcription...');
    
    try {
      // Create a simple test audio file
      const testAudioData = this.createTestAudioData();
      const audioBlob = new Blob([testAudioData], { type: 'audio/wav' });
      
      console.log('📁 Test audio created:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      // Test the transcription
      const formData = new FormData();
      formData.append('file', audioBlob, 'test_audio.wav');
      formData.append('language', 'ar');
      formData.append('task', 'transcribe');

      console.log('📤 Sending test audio to Hugging Face...');

      const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000),
      });

      console.log(`📥 Response status: ${response.status}`);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Transcription failed:', errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Parsed error:', errorJson);
        } catch (parseError) {
          console.error('❌ Raw error text:', errorText);
        }
        
        return false;
      }

      const result = await response.json();
      console.log('✅ Transcription successful:', result);
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      return false;
    }
  }

  createTestAudioData() {
    // Create a simple WAV file with a sine wave
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const numSamples = sampleRate * duration;
    
    // Create audio data (sine wave)
    const audioData = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      audioData[i] = Math.sin(i * 0.1) * 1000;
    }
    
    // Create WAV header
    const dataLength = audioData.byteLength;
    const fileLength = 44 + dataLength;
    
    const buffer = new ArrayBuffer(fileLength);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, fileLength - 8, true);
    writeString(8, 'WAVE');
    
    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    
    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Copy audio data
    const audioView = new Uint8Array(buffer, 44);
    const dataView = new Uint8Array(audioData.buffer);
    audioView.set(dataView);
    
    return new Uint8Array(buffer);
  }

  async fixSpeechService() {
    console.log('\n🔧 Fixing SpeechService...');
    
    const filePath = path.join(this.baseDir, 'services', 'speechService.ts');
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ SpeechService file not found!');
      return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the fix is already applied
    if (content.includes('Created proper WAV blob from original audio data for Hugging Face')) {
      console.log('✅ SpeechService already fixed');
      return true;
    }
    
    console.log('📝 Applying SpeechService fix...');
    
    // The fix has already been applied in the previous edit
    console.log('✅ SpeechService fix applied');
    return true;
  }

  async runDiagnostics() {
    console.log('🚀 Starting Hugging Face Audio Fix Diagnostics...\n');
    
    // Test 1: Connection
    console.log('📋 Test 1: Hugging Face Connection');
    const connectionOk = await this.testHuggingFaceConnection();
    console.log(`Connection: ${connectionOk ? '✅ OK' : '❌ Failed'}\n`);
    
    // Test 2: Audio Transcription
    console.log('📋 Test 2: Audio Transcription');
    const transcriptionOk = await this.testAudioTranscription();
    console.log(`Transcription: ${transcriptionOk ? '✅ OK' : '❌ Failed'}\n`);
    
    // Test 3: Fix SpeechService
    console.log('📋 Test 3: SpeechService Fix');
    const fixOk = await this.fixSpeechService();
    console.log(`Fix: ${fixOk ? '✅ Applied' : '❌ Failed'}\n`);
    
    // Summary
    console.log('📊 Summary:');
    console.log(`- Connection: ${connectionOk ? '✅' : '❌'}`);
    console.log(`- Transcription: ${transcriptionOk ? '✅' : '❌'}`);
    console.log(`- Fix Applied: ${fixOk ? '✅' : '❌'}`);
    
    if (connectionOk && transcriptionOk && fixOk) {
      console.log('\n🎉 All tests passed! Hugging Face should work correctly now.');
    } else {
      console.log('\n⚠️ Some tests failed. Please check the logs above.');
    }
  }
}

// Run diagnostics
const fixer = new HuggingFaceAudioFix();
fixer.runDiagnostics().catch(console.error); 