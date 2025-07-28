const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

console.log('🔍 Testing Hugging Face Faster Whisper API (Fixed Version)...');

const HF_API_URL = 'https://alaaharoun-faster-whisper-api.hf.space';

// Create test audio data (WAV format)
function createTestWavAudio() {
  const sampleRate = 16000;
  const duration = 2; // 2 seconds
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

// Test 1: Health Check
async function testHealthCheck() {
  console.log('\n📋 Test 1: Health Check');
  try {
    const response = await fetch(`${HF_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health check successful:', data);
      return { success: true, data };
    } else {
      console.log('❌ Health check failed:', response.status, response.statusText);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: Root endpoint
async function testRootEndpoint() {
  console.log('\n📋 Test 2: Root Endpoint');
  try {
    const response = await fetch(`${HF_API_URL}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Root endpoint successful:', data);
      return { success: true, data };
    } else {
      console.log('❌ Root endpoint failed:', response.status, response.statusText);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.log('❌ Root endpoint error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Language Detection
async function testLanguageDetection() {
  console.log('\n📋 Test 3: Language Detection');
  try {
    const testAudio = createTestWavAudio();
    
    const formData = new FormData();
    formData.append('file', testAudio, {
      filename: 'test_audio.wav',
      contentType: 'audio/wav'
    });
    
    const response = await fetch(`${HF_API_URL}/detect-language`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Language detection successful:', data);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log('❌ Language detection failed:', response.status, errorText);
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    console.log('❌ Language detection error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 4: Transcription (English)
async function testTranscriptionEnglish() {
  console.log('\n📋 Test 4: Transcription (English)');
  try {
    const testAudio = createTestWavAudio();
    
    const formData = new FormData();
    formData.append('file', testAudio, {
      filename: 'test_audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    const response = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ English transcription successful:', data);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log('❌ English transcription failed:', response.status, errorText);
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    console.log('❌ English transcription error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 5: Transcription (Arabic)
async function testTranscriptionArabic() {
  console.log('\n📋 Test 5: Transcription (Arabic)');
  try {
    const testAudio = createTestWavAudio();
    
    const formData = new FormData();
    formData.append('file', testAudio, {
      filename: 'test_audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('language', 'ar');
    formData.append('task', 'transcribe');
    
    const response = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Arabic transcription successful:', data);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log('❌ Arabic transcription failed:', response.status, errorText);
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    console.log('❌ Arabic transcription error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 6: Auto Language Detection
async function testAutoLanguageDetection() {
  console.log('\n📋 Test 6: Auto Language Detection');
  try {
    const testAudio = createTestWavAudio();
    
    const formData = new FormData();
    formData.append('file', testAudio, {
      filename: 'test_audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('task', 'transcribe');
    // No language specified - should auto-detect
    
    const response = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Auto language detection successful:', data);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log('❌ Auto language detection failed:', response.status, errorText);
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    console.log('❌ Auto language detection error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 7: Translation
async function testTranslation() {
  console.log('\n📋 Test 7: Translation');
  try {
    const testAudio = createTestWavAudio();
    
    const formData = new FormData();
    formData.append('file', testAudio, {
      filename: 'test_audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('language', 'en');
    formData.append('task', 'translate');
    
    const response = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Translation successful:', data);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log('❌ Translation failed:', response.status, errorText);
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    console.log('❌ Translation error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 8: Performance Test
async function testPerformance() {
  console.log('\n📋 Test 8: Performance Test');
  const startTime = Date.now();
  
  try {
    const testAudio = createTestWavAudio();
    
    const formData = new FormData();
    formData.append('file', testAudio, {
      filename: 'test_audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('task', 'transcribe');
    
    const response = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000) // 60 seconds timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Performance test successful: ${duration}ms`);
      console.log('Response:', data);
      return { success: true, duration, data };
    } else {
      const errorText = await response.text();
      console.log(`❌ Performance test failed: ${duration}ms`, response.status, errorText);
      return { success: false, duration, status: response.status, error: errorText };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`❌ Performance test error: ${duration}ms`, error.message);
    return { success: false, duration, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Hugging Face API tests (Fixed Version)...\n');
  
  const results = {
    healthCheck: await testHealthCheck(),
    rootEndpoint: await testRootEndpoint(),
    languageDetection: await testLanguageDetection(),
    transcriptionEnglish: await testTranscriptionEnglish(),
    transcriptionArabic: await testTranscriptionArabic(),
    autoLanguageDetection: await testAutoLanguageDetection(),
    translation: await testTranslation(),
    performance: await testPerformance()
  };
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  // Detailed results
  console.log('\n📋 Detailed Results:');
  Object.entries(results).forEach(([testName, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);
    if (result.duration) {
      console.log(`   Duration: ${result.duration}ms`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (results.healthCheck.success) {
    console.log('✅ Hugging Face service is running and healthy');
  } else {
    console.log('❌ Hugging Face service may be down or unreachable');
  }
  
  if (results.transcriptionEnglish.success || results.transcriptionArabic.success) {
    console.log('✅ Transcription functionality is working');
  } else {
    console.log('❌ Transcription functionality has issues');
  }
  
  if (results.performance.success && results.performance.duration < 10000) {
    console.log('✅ Performance is acceptable (< 10 seconds)');
  } else if (results.performance.success) {
    console.log('⚠️ Performance is slow (> 10 seconds)');
  } else {
    console.log('❌ Performance test failed');
  }
  
  console.log('\n🎉 Hugging Face API testing completed!');
}

// Run the tests
runAllTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
}); 