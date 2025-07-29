// Quick test for Hugging Face fix
console.log('🚀 Quick Test: Hugging Face Audio Fix\n');

async function quickTest() {
  try {
    // Test 1: Health Check
    console.log('📋 Test 1: Health Check');
    const healthResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health');
    console.log(`Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check passed:', healthData.status);
    } else {
      console.log('❌ Health check failed');
      return;
    }

    // Test 2: Create test audio
    console.log('\n📋 Test 2: Audio Creation');
    const testAudio = createTestAudio();
    console.log(`✅ Test audio created: ${testAudio.size} bytes`);

    // Test 3: Transcription
    console.log('\n📋 Test 3: Transcription');
    const formData = new FormData();
    formData.append('file', testAudio, 'test.wav');
    formData.append('language', 'ar');
    formData.append('task', 'transcribe');

    const transcribeResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });

    console.log(`Status: ${transcribeResponse.status}`);

    if (transcribeResponse.ok) {
      const result = await transcribeResponse.json();
      console.log('✅ Transcription successful!');
      console.log(`Text: ${result.text?.substring(0, 50)}...`);
      console.log(`Language: ${result.language}`);
    } else {
      const errorText = await transcribeResponse.text();
      console.log('❌ Transcription failed:', errorText);
      return;
    }

    console.log('\n🎉 All tests passed! Hugging Face is working correctly.');
    console.log('✅ The audio fix has been successfully applied.');
    console.log('✅ Your application should now work without 500 errors.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function createTestAudio() {
  // Create a simple WAV file
  const sampleRate = 16000;
  const duration = 1;
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

// Run the test
quickTest(); 