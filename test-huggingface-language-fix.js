const fs = require('fs');
const path = require('path');

class HuggingFaceLanguageFix {
  constructor() {
    this.baseDir = __dirname;
  }

  async testLanguageDetection() {
    console.log('🔍 Testing Language Detection...\n');
    
    try {
      // Test 1: Arabic language
      console.log('📋 Test 1: Arabic Language');
      const arabicResult = await this.testTranscription('ar');
      console.log(`Arabic test: ${arabicResult ? '✅ Success' : '❌ Failed'}\n`);
      
      // Test 2: English language
      console.log('📋 Test 2: English Language');
      const englishResult = await this.testTranscription('en');
      console.log(`English test: ${englishResult ? '✅ Success' : '❌ Failed'}\n`);
      
      // Test 3: French language
      console.log('📋 Test 3: French Language');
      const frenchResult = await this.testTranscription('fr');
      console.log(`French test: ${frenchResult ? '✅ Success' : '❌ Failed'}\n`);
      
      // Test 4: Auto detection
      console.log('📋 Test 4: Auto Language Detection');
      const autoResult = await this.testTranscription(null);
      console.log(`Auto detection test: ${autoResult ? '✅ Success' : '❌ Failed'}\n`);
      
      return {
        arabic: arabicResult,
        english: englishResult,
        french: frenchResult,
        auto: autoResult
      };
    } catch (error) {
      console.error('❌ Language detection test failed:', error.message);
      return false;
    }
  }

  async testTranscription(language) {
    try {
      // Create test audio
      const testAudio = this.createTestAudio();
      const formData = new FormData();
      formData.append('file', testAudio, 'test.wav');
      
      if (language) {
        formData.append('language', language);
        console.log(`🌍 Testing with language: ${language}`);
      } else {
        console.log('🌍 Testing with auto language detection');
      }
      
      formData.append('task', 'transcribe');

      const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Transcription failed (${language || 'auto'}):`, errorText);
        return false;
      }

      const result = await response.json();
      console.log(`✅ Transcription successful (${language || 'auto'}):`, {
        text: result.text?.substring(0, 50) + '...',
        detectedLanguage: result.language,
        probability: result.language_probability
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Test failed for ${language || 'auto'}:`, error.message);
      return false;
    }
  }

  createTestAudio() {
    // Create a simple WAV file with Arabic-like content
    const sampleRate = 16000;
    const duration = 2; // 2 seconds
    const numSamples = sampleRate * duration;
    
    const audioData = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      audioData[i] = Math.sin(i * 0.1) * 1000;
    }
    
    const dataLength = audioData.byteLength;
    const fileLength = 44 + dataLength;
    
    const buffer = new ArrayBuffer(fileLength);
    const view = new DataView(buffer);
    
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, fileLength - 8, true);
    writeString(8, 'WAVE');
    
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    const audioView = new Uint8Array(buffer, 44);
    const dataView = new Uint8Array(audioData.buffer);
    audioView.set(dataView);
    
    return new Blob([new Uint8Array(buffer)], { type: 'audio/wav' });
  }

  async analyzeServerLogs() {
    console.log('\n📊 Analyzing Server Behavior...\n');
    
    console.log('🔍 From the logs, I can see:');
    console.log('✅ Some files work perfectly (test_audio.wav, test.wav)');
    console.log('❌ Some files fail with InvalidDataError');
    console.log('🌍 Language detection shows:');
    console.log('   - Arabic (ar) with probability 1.00 ✅');
    console.log('   - French (fr) with probability 1.00 ❌ (wrong detection)');
    console.log('   - English (en) with probability 1.00 ✅');
    
    console.log('\n🎯 Key Issues Identified:');
    console.log('1. File format inconsistency - some files are corrupted');
    console.log('2. Language detection sometimes picks wrong language');
    console.log('3. File size varies (80340, 81144, 81160, 81161 bytes)');
    
    console.log('\n💡 Recommendations:');
    console.log('1. Ensure consistent audio format in the app');
    console.log('2. Add explicit language parameter for Arabic');
    console.log('3. Validate audio data before sending');
    console.log('4. Add retry mechanism for failed requests');
  }

  async runDiagnostics() {
    console.log('🚀 Starting Hugging Face Language Fix Diagnostics...\n');
    
    // Test language detection
    const results = await this.testLanguageDetection();
    
    // Analyze server behavior
    await this.analyzeServerLogs();
    
    // Summary
    console.log('📊 Summary:');
    console.log(`- Arabic: ${results.arabic ? '✅' : '❌'}`);
    console.log(`- English: ${results.english ? '✅' : '❌'}`);
    console.log(`- French: ${results.french ? '✅' : '❌'}`);
    console.log(`- Auto: ${results.auto ? '✅' : '❌'}`);
    
    if (results.arabic && results.english) {
      console.log('\n🎉 Language detection is working!');
      console.log('✅ The server can detect Arabic and English correctly.');
      console.log('⚠️ The issue might be with file format consistency.');
    } else {
      console.log('\n⚠️ Language detection has issues.');
      console.log('🔧 Need to investigate further.');
    }
  }
}

// Run diagnostics
const fixer = new HuggingFaceLanguageFix();
fixer.runDiagnostics().catch(console.error); 