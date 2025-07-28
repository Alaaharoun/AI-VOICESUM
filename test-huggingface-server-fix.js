const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class HuggingFaceServerTester {
  constructor() {
    this.baseUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
    this.endpoints = {
      health: '/health',
      transcribe: '/transcribe',
      root: '/'
    };
  }

  async testHealthEndpoint() {
    console.log('\n🔍 Testing Health Endpoint...');
    console.log(`URL: ${this.baseUrl}${this.endpoints.health}`);
    
    try {
      const response = await fetch(`${this.baseUrl}${this.endpoints.health}`, {
        method: 'GET',
        timeout: 10000,
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Health check successful:');
        console.log(JSON.stringify(data, null, 2));
        return true;
      } else {
        const errorText = await response.text();
        console.log('❌ Health check failed:');
        console.log(errorText);
        return false;
      }
    } catch (error) {
      console.log('❌ Health check error:');
      console.log(error.message);
      return false;
    }
  }

  async testRootEndpoint() {
    console.log('\n🔍 Testing Root Endpoint...');
    console.log(`URL: ${this.baseUrl}${this.endpoints.root}`);
    
    try {
      const response = await fetch(`${this.baseUrl}${this.endpoints.root}`, {
        method: 'GET',
        timeout: 10000,
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Root endpoint successful:');
        console.log(JSON.stringify(data, null, 2));
        return true;
      } else {
        const errorText = await response.text();
        console.log('❌ Root endpoint failed:');
        console.log(errorText);
        return false;
      }
    } catch (error) {
      console.log('❌ Root endpoint error:');
      console.log(error.message);
      return false;
    }
  }

  async testTranscribeEndpoint() {
    console.log('\n🔍 Testing Transcribe Endpoint...');
    console.log(`URL: ${this.baseUrl}${this.endpoints.transcribe}`);
    
    try {
      // Create a simple test audio file (1 second of silence)
      const testAudioBuffer = this.createTestAudioBuffer();
      
      const formData = new FormData();
      formData.append('file', Buffer.from(testAudioBuffer), {
        filename: 'test.wav',
        contentType: 'audio/wav'
      });
      formData.append('task', 'transcribe');
      
      const response = await fetch(`${this.baseUrl}${this.endpoints.transcribe}`, {
        method: 'POST',
        body: formData,
        timeout: 30000,
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Transcribe endpoint successful:');
        console.log(JSON.stringify(data, null, 2));
        return true;
      } else {
        const errorText = await response.text();
        console.log('❌ Transcribe endpoint failed:');
        console.log(errorText);
        return false;
      }
    } catch (error) {
      console.log('❌ Transcribe endpoint error:');
      console.log(error.message);
      return false;
    }
  }

  createTestAudioBuffer() {
    // Create a simple WAV file with 1 second of silence
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const numSamples = sampleRate * duration;
    
    // WAV header (44 bytes)
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + numSamples * 2, true); // File size
    view.setUint32(8, 0x57415645, false); // "WAVE"
    
    // fmt chunk
    view.setUint32(12, 0x666D7420, false); // "fmt "
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, 1, true); // Number of channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    
    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, numSamples * 2, true); // Data size
    
    // Create silent audio data
    const audioData = new Int16Array(numSamples);
    
    // Combine header and audio data
    const combined = new Uint8Array(44 + numSamples * 2);
    combined.set(new Uint8Array(header), 0);
    combined.set(new Uint8Array(audioData.buffer), 44);
    
    return combined.buffer;
  }

  async runAllTests() {
    console.log('🚀 Starting Hugging Face Server Tests...');
    console.log(`Base URL: ${this.baseUrl}`);
    
    const results = {
      health: await this.testHealthEndpoint(),
      root: await this.testRootEndpoint(),
      transcribe: await this.testTranscribeEndpoint()
    };
    
    console.log('\n📊 Test Results:');
    console.log(`Health Endpoint: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Root Endpoint: ${results.root ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Transcribe Endpoint: ${results.transcribe ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
      console.log('\n🎉 All tests passed! Hugging Face server is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please check the server configuration.');
    }
    
    return results;
  }
}

// Run the tests
async function main() {
  const tester = new HuggingFaceServerTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = HuggingFaceServerTester; 