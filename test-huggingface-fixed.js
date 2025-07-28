const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

console.log('🔧 Testing Hugging Face API with Proper Audio File');

// Configuration
const HF_API_URL = 'https://alaaharoun-faster-whisper-api.hf.space';

// Create a proper WAV file for testing
function createTestWavFile() {
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const samples = sampleRate * duration;
  
  // WAV header (44 bytes)
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples * 2, 4); // File size
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // Audio format (PCM)
  header.writeUInt16LE(1, 22); // Number of channels (mono)
  header.writeUInt32LE(sampleRate, 24); // Sample rate
  header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(samples * 2, 40); // Data size
  
  // Create audio data (sine wave at 440Hz)
  const audioData = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 * 32767;
    audioData.writeInt16LE(Math.round(value), i * 2);
  }
  
  return Buffer.concat([header, audioData]);
}

async function testHuggingFaceAPI() {
  console.log('\n🧪 Testing Hugging Face API with proper audio file...');
  
  try {
    // Test 1: Health check
    console.log('\n1️⃣ Health check...');
    const healthResponse = await fetch(`${HF_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Health check successful:', healthData);
    } else {
      console.log('   ❌ Health check failed:', healthResponse.status);
      return;
    }
    
    // Test 2: Transcribe with proper audio file
    console.log('\n2️⃣ Transcribe with proper audio file...');
    
    const testAudioData = createTestWavFile();
    const formData = new FormData();
    formData.append('file', new Blob([testAudioData], { type: 'audio/wav' }), 'test.wav');
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    console.log('   Audio file size:', testAudioData.length, 'bytes');
    console.log('   Audio file type: audio/wav');
    
    const transcribeResponse = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    console.log('   Response status:', transcribeResponse.status);
    console.log('   Response headers:', Object.fromEntries(transcribeResponse.headers.entries()));
    
    if (transcribeResponse.ok) {
      const transcribeData = await transcribeResponse.json();
      console.log('   ✅ Transcribe successful:', transcribeData);
    } else {
      const errorText = await transcribeResponse.text();
      console.log('   ❌ Transcribe failed:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

async function testAppStyleRequest() {
  console.log('\n📱 Testing App-style request...');
  
  try {
    // Simulate what the app would send
    const testAudioData = createTestWavFile();
    const formData = new FormData();
    formData.append('file', new Blob([testAudioData], { type: 'audio/wav' }), 'audio.wav');
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    console.log('   Simulating app request...');
    console.log('   File name: audio.wav');
    console.log('   File size:', testAudioData.length, 'bytes');
    
    const response = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    console.log('   App request status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ App request successful:', data);
    } else {
      const errorText = await response.text();
      console.log('   ❌ App request failed:', errorText);
    }
    
  } catch (error) {
    console.error('   ❌ App-style test error:', error.message);
  }
}

async function testDifferentLanguages() {
  console.log('\n🌍 Testing different languages...');
  
  const languages = ['en', 'ar', 'es', 'fr'];
  const testAudioData = createTestWavFile();
  
  for (const language of languages) {
    try {
      console.log(`\n   Testing language: ${language}`);
      
      const formData = new FormData();
      formData.append('file', new Blob([testAudioData], { type: 'audio/wav' }), 'test.wav');
      formData.append('language', language);
      formData.append('task', 'transcribe');
      
      const response = await fetch(`${HF_API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ ${language}: Success`);
        console.log(`      Text: ${data.text || 'No text'}`);
        console.log(`      Detected language: ${data.language || 'Unknown'}`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ ${language}: Failed - ${errorText}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ${language}: Error - ${error.message}`);
    }
  }
}

async function testAutoLanguageDetection() {
  console.log('\n🔍 Testing auto language detection...');
  
  try {
    const testAudioData = createTestWavFile();
    const formData = new FormData();
    formData.append('file', new Blob([testAudioData], { type: 'audio/wav' }), 'test.wav');
    formData.append('task', 'transcribe');
    // No language specified - should auto-detect
    
    const response = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Auto-detection successful:', data);
    } else {
      const errorText = await response.text();
      console.log('   ❌ Auto-detection failed:', errorText);
    }
    
  } catch (error) {
    console.error('   ❌ Auto-detection error:', error.message);
  }
}

// Main execution
async function runTests() {
  console.log('🚀 Starting Hugging Face API Tests with Proper Audio Files...\n');
  
  try {
    await testHuggingFaceAPI();
    await testAppStyleRequest();
    await testDifferentLanguages();
    await testAutoLanguageDetection();
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log('✅ All tests completed');
    console.log('📝 Check results above for any issues');
    console.log('🔧 If tests pass, the API is working correctly');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 