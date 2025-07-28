const fetch = require('node-fetch');

console.log('📱 Testing App Connection to Hugging Face API');

// Simulate the app's current configuration
const appConfig = {
  engine: 'huggingface',
  huggingFaceUrl: 'https://alaaharoun-faster-whisper-api.hf.space'
};

async function testAppConnection() {
  console.log('\n🔍 Testing app connection...');
  
  try {
    // Test 1: Check if the app can reach the service
    console.log('\n1️⃣ Testing service accessibility...');
    
    const healthResponse = await fetch(`${appConfig.huggingFaceUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Service is accessible:', healthData);
    } else {
      console.log('   ❌ Service is not accessible:', healthResponse.status);
      return;
    }
    
    // Test 2: Check if the app can send a proper request
    console.log('\n2️⃣ Testing app request format...');
    
    // Create a minimal audio file (just for testing)
    const audioData = Buffer.from('RIFF00000000WAVEfmt 1000000100010000401F0000803E0000020010006461746100000000', 'hex');
    
    const formData = new FormData();
    formData.append('file', new Blob([audioData], { type: 'audio/wav' }), `audio_${Date.now()}.wav`);
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    console.log('   Sending request with:');
    console.log('   - File name: audio_[timestamp].wav');
    console.log('   - File size:', audioData.length, 'bytes');
    console.log('   - Language: en');
    console.log('   - Task: transcribe');
    
    const response = await fetch(`${appConfig.huggingFaceUrl}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    console.log('   Response status:', response.status);
    console.log('   Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ App request successful:', data);
    } else {
      const errorText = await response.text();
      console.log('   ❌ App request failed:', errorText);
      
      // Try to understand the error
      if (errorText.includes('Field required')) {
        console.log('   💡 Issue: File field is not being sent properly');
        console.log('   🔧 Solution: Check FormData creation in the app');
      } else if (errorText.includes('Invalid file')) {
        console.log('   💡 Issue: Audio file format is not supported');
        console.log('   🔧 Solution: Ensure audio is in WAV format');
      } else {
        console.log('   💡 Issue: Unknown error, check server logs');
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

async function testRealAudioFile() {
  console.log('\n🎵 Testing with real audio file...');
  
  try {
    // Create a proper WAV file
    const sampleRate = 16000;
    const duration = 2; // 2 seconds
    const samples = sampleRate * duration;
    
    // WAV header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + samples * 2, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(samples * 2, 40);
    
    // Create audio data (sine wave)
    const audioData = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
      const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 * 32767;
      audioData.writeInt16LE(Math.round(value), i * 2);
    }
    
    const wavData = Buffer.concat([header, audioData]);
    
    const formData = new FormData();
    formData.append('file', new Blob([wavData], { type: 'audio/wav' }), `test_${Date.now()}.wav`);
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    console.log('   Sending real audio file:');
    console.log('   - File size:', wavData.length, 'bytes');
    console.log('   - Duration: 2 seconds');
    console.log('   - Sample rate: 16kHz');
    
    const response = await fetch(`${appConfig.huggingFaceUrl}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    console.log('   Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Real audio test successful:', data);
    } else {
      const errorText = await response.text();
      console.log('   ❌ Real audio test failed:', errorText);
    }
    
  } catch (error) {
    console.error('   ❌ Real audio test error:', error.message);
  }
}

// Main execution
async function runTests() {
  console.log('🚀 Starting App Connection Tests...\n');
  
  try {
    await testAppConnection();
    await testRealAudioFile();
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log('✅ Tests completed');
    console.log('📝 Check results above for connection issues');
    console.log('🔧 If tests pass, the app should work correctly');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 