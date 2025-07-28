// Test script to verify actual engine switching in the application
// This simulates the exact flow that happens when transcription is requested

const fetch = require('node-fetch');

// Mock the exact same logic as the application
class MockSpeechService {
  constructor() {
    this.currentEngine = 'azure'; // Default
  }

  async getCurrentEngine() {
    // Simulate database fetch
    return this.currentEngine;
  }

  async setEngine(engine) {
    console.log(`🔄 Setting engine to: ${engine}`);
    this.currentEngine = engine;
  }

  async transcribeAudio(audioBlob, targetLanguage) {
    console.log('🎤 transcribeAudio called');
    console.log(`Current engine: ${this.currentEngine}`);
    
    try {
      // Get the current transcription engine - EXACT SAME LOGIC AS THE APP
      const engine = await this.getCurrentEngine();
      
      console.log('Using transcription engine:', engine);
      
      if (engine === 'huggingface') {
        return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
      } else {
        // Default to Azure
        return await this.transcribeWithAssemblyAI(audioBlob, targetLanguage);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  async transcribeWithHuggingFace(audioBlob, targetLanguage) {
    console.log('🔍 transcribeWithHuggingFace called');
    
    try {
      const config = await this.getEngineConfig();
      
      if (config.engine !== 'huggingface' || !config.huggingFaceUrl) {
        throw new Error('Hugging Face service not configured');
      }

      console.log('Transcribing with Hugging Face...', {
        size: audioBlob.size,
        type: audioBlob.type,
        targetLanguage,
        url: config.huggingFaceUrl
      });

      // Create form data for Hugging Face API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      
      if (targetLanguage) {
        formData.append('language', targetLanguage);
      }
      
      formData.append('task', 'transcribe');

      // Make request to Hugging Face API - EXACT SAME URL AS THE APP
      const response = await fetch(`${config.huggingFaceUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hugging Face transcription error:', response.status, errorText);
        throw new Error(`Hugging Face transcription failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Hugging Face transcription failed');
      }

      console.log('✅ Hugging Face transcription successful:', {
        text: result.text?.substring(0, 100) + '...',
        language: result.language,
        probability: result.language_probability
      });

      return result.text || 'No transcription result';
    } catch (error) {
      console.error('❌ Hugging Face transcription error:', error);
      throw error;
    }
  }

  async transcribeWithAssemblyAI(audioBlob, targetLanguage) {
    console.log('🔍 transcribeWithAssemblyAI called');
    console.log('This would use the old Render server or Azure API');
    return 'Mock Azure transcription result';
  }

  async getEngineConfig() {
    const engine = await this.getCurrentEngine();
    
    const config = {
      engine,
    };

    // Get Hugging Face URL if needed - EXACT SAME LOGIC AS THE APP
    if (engine === 'huggingface') {
      config.huggingFaceUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
    }

    return config;
  }
}

// Test scenarios
async function testScenario1() {
  console.log('\n🔬 Scenario 1: Default Engine (Azure)');
  console.log('=====================================');
  
  const speechService = new MockSpeechService();
  
  // Create a mock audio blob
  const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
  
  console.log('1. Testing with default engine (azure)...');
  const result1 = await speechService.transcribeAudio(mockAudioBlob, 'en');
  console.log('Result:', result1);
}

async function testScenario2() {
  console.log('\n🔬 Scenario 2: Switch to Hugging Face');
  console.log('=====================================');
  
  const speechService = new MockSpeechService();
  
  // Switch to Hugging Face
  await speechService.setEngine('huggingface');
  
  // Create a mock audio blob
  const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
  
  console.log('1. Testing with Hugging Face engine...');
  const result2 = await speechService.transcribeAudio(mockAudioBlob, 'en');
  console.log('Result:', result2);
}

async function testScenario3() {
  console.log('\n🔬 Scenario 3: Real Hugging Face Test');
  console.log('=====================================');
  
  const speechService = new MockSpeechService();
  
  // Switch to Hugging Face
  await speechService.setEngine('huggingface');
  
  // Create a real test audio blob (small WAV file)
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const audioData = new Int16Array(numSamples);
  
  // Create a simple sine wave
  for (let i = 0; i < numSamples; i++) {
    audioData[i] = Math.sin(i * 0.1) * 1000;
  }
  
  // Create WAV header
  const dataLength = audioData.byteLength;
  const wavHeader = createWavHeader(dataLength);
  
  // Combine header and data
  const wavBlob = new Blob([wavHeader, audioData], { type: 'audio/wav' });
  
  console.log('1. Testing with real audio data...');
  console.log('Audio blob size:', wavBlob.size);
  console.log('Audio blob type:', wavBlob.type);
  
  try {
    const result3 = await speechService.transcribeAudio(wavBlob, 'en');
    console.log('✅ Real test successful!');
    console.log('Result:', result3);
  } catch (error) {
    console.log('❌ Real test failed:', error.message);
  }
}

function createWavHeader(dataLength) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  
  return buffer;
}

// Main test function
async function runAllTests() {
  console.log('🚀 Testing Actual Engine Switching in Application...\n');
  
  await testScenario1();
  await testScenario2();
  await testScenario3();
  
  console.log('\n📊 Analysis:');
  console.log('============');
  console.log('✅ If Scenario 2 shows "Hugging Face transcription successful",');
  console.log('   then the app is correctly using Hugging Face API.');
  console.log('✅ If Scenario 3 works, then real transcription is functional.');
  console.log('❌ If both fail, there might be an issue with the API or network.');
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  MockSpeechService,
  testScenario1,
  testScenario2,
  testScenario3,
  runAllTests
}; 