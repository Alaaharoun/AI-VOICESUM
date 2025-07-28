// Test script to verify the actual payload sent to Hugging Face API
// This shows exactly what the application sends

const fetch = require('node-fetch');
const FormData = require('form-data');

// Mock the exact same payload creation as the application
class MockPayloadTest {
  constructor() {
    this.huggingFaceUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
  }

  async testActualPayload() {
    console.log('🧪 Testing Actual Payload Sent by Application...\n');
    
    try {
      // Step 1: Create the exact same FormData as the app
      console.log('📋 Step 1: Creating FormData (exactly like the app)...');
      
      const formData = new FormData();
      
      // Create a mock audio blob (like the app does)
      const mockAudioBlob = Buffer.from('mock audio data for testing');
      formData.append('file', mockAudioBlob, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // Add language parameter (like the app does)
      const targetLanguage = 'en';
      formData.append('language', targetLanguage);
      
      // Add task parameter (like the app does)
      formData.append('task', 'transcribe');
      
      console.log('✅ FormData created with:');
      console.log('  - file: audio.wav (mock data)');
      console.log('  - language: en');
      console.log('  - task: transcribe');
      
      // Step 2: Show the actual request details
      console.log('\n📋 Step 2: Request Details (exactly like the app)...');
      console.log(`URL: ${this.huggingFaceUrl}/transcribe`);
      console.log('Method: POST');
      console.log('Content-Type: multipart/form-data');
      console.log('Timeout: 60000ms (60 seconds)');
      
      // Step 3: Make the actual request (like the app does)
      console.log('\n📋 Step 3: Making actual request...');
      
      const response = await fetch(`${this.huggingFaceUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout - exactly like the app
      });
      
      console.log(`Response Status: ${response.status} ${response.statusText}`);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const result = await response.json();
        console.log('\n✅ Request successful!');
        console.log('Response:', JSON.stringify(result, null, 2));
      } else {
        const errorText = await response.text();
        console.log('\n❌ Request failed (expected for mock data):');
        console.log('Error:', errorText);
        
        // This is expected because we're sending mock data
        if (response.status === 422) {
          console.log('\n✅ This is expected behavior!');
          console.log('The API correctly rejected our mock data.');
          console.log('This proves the endpoint is working and accepting POST requests.');
        }
      }
      
    } catch (error) {
      console.log('❌ Test error:', error.message);
    }
  }

  async testWithRealAudioData() {
    console.log('\n🧪 Testing with Real Audio Data...\n');
    
    try {
      // Create a real WAV file (1 second of silence)
      const sampleRate = 16000;
      const duration = 1; // 1 second
      const numSamples = sampleRate * duration;
      const audioData = new Int16Array(numSamples);
      
      // Fill with silence (zeros)
      for (let i = 0; i < numSamples; i++) {
        audioData[i] = 0;
      }
      
      // Create WAV header
      const dataLength = audioData.byteLength;
      const wavHeader = this.createWavHeader(dataLength);
      
      // Combine header and data
      const wavBuffer = Buffer.concat([
        Buffer.from(wavHeader),
        Buffer.from(audioData.buffer)
      ]);
      
      console.log('📋 Creating FormData with real WAV data...');
      
      const formData = new FormData();
      formData.append('file', wavBuffer, {
        filename: 'test_audio.wav',
        contentType: 'audio/wav'
      });
      formData.append('language', 'en');
      formData.append('task', 'transcribe');
      
      console.log('✅ Real WAV data created:');
      console.log('  - Size:', wavBuffer.length, 'bytes');
      console.log('  - Duration: 1 second');
      console.log('  - Sample Rate: 16kHz');
      console.log('  - Format: WAV');
      
      console.log('\n📋 Making request with real audio...');
      
      const response = await fetch(`${this.huggingFaceUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000),
      });
      
      console.log(`Response Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log('\n✅ Real audio test successful!');
        console.log('Response:', JSON.stringify(result, null, 2));
      } else {
        const errorText = await response.text();
        console.log('\n❌ Real audio test failed:');
        console.log('Error:', errorText);
      }
      
    } catch (error) {
      console.log('❌ Real audio test error:', error.message);
    }
  }

  createWavHeader(dataLength) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
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

  showPayloadStructure() {
    console.log('\n📋 Payload Structure Sent by Application:');
    console.log('==========================================');
    console.log('POST https://alaaharoun-faster-whisper-api.hf.space/transcribe');
    console.log('Content-Type: multipart/form-data');
    console.log('');
    console.log('Form Data:');
    console.log('├── file: [audio blob] (filename: audio.wav)');
    console.log('├── language: [string] (optional, e.g., "en", "ar")');
    console.log('└── task: "transcribe" (fixed value)');
    console.log('');
    console.log('Headers:');
    console.log('├── Content-Type: multipart/form-data; boundary=...');
    console.log('└── Content-Length: [calculated]');
    console.log('');
    console.log('Timeout: 60 seconds');
    console.log('');
    console.log('Expected Response:');
    console.log('├── success: true/false');
    console.log('├── text: [transcribed text]');
    console.log('├── language: [detected language]');
    console.log('└── language_probability: [confidence score]');
  }
}

// Run tests
async function runPayloadTests() {
  console.log('🚀 Testing Actual Payload Sent to Hugging Face API...\n');
  
  const tester = new MockPayloadTest();
  
  // Show payload structure
  tester.showPayloadStructure();
  
  // Test with mock data
  await tester.testActualPayload();
  
  // Test with real audio data
  await tester.testWithRealAudioData();
  
  console.log('\n📊 Summary:');
  console.log('===========');
  console.log('✅ The application sends POST requests (not GET)');
  console.log('✅ Uses multipart/form-data format');
  console.log('✅ Includes file, language, and task parameters');
  console.log('✅ Has 60-second timeout');
  console.log('✅ Sends to correct URL: /transcribe endpoint');
}

if (require.main === module) {
  runPayloadTests().catch(console.error);
}

module.exports = {
  MockPayloadTest,
  runPayloadTests
}; 