const fetch = require('node-fetch');
const FormData = require('form-data');

class HuggingFaceIntegrationTest {
  constructor() {
    this.baseUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
  }

  async testHealth() {
    console.log('\n🔍 Testing Health Endpoint...');
    try {
      const response = await fetch(`${this.baseUrl}/health`);
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
    console.log('\n🔍 Testing Transcription...');
    try {
      // Create a simple test audio file
      const testAudio = this.createTestAudio();
      
      const formData = new FormData();
      formData.append('file', Buffer.from(testAudio), {
        filename: 'test.wav',
        contentType: 'audio/wav'
      });
      formData.append('task', 'transcribe');
      
      const response = await fetch(`${this.baseUrl}/transcribe`, {
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
    
    console.log('\n📊 Test Results:');
    console.log(`Health: ${healthResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Transcription: ${transcriptionResult ? '✅ PASS' : '❌ FAIL'}`);
    
    if (healthResult && transcriptionResult) {
      console.log('\n🎉 All tests passed! Hugging Face integration is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please check the configuration.');
    }
  }
}

// Run tests
const tester = new HuggingFaceIntegrationTest();
tester.runAllTests().catch(console.error);
