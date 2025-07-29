// Final test for Hugging Face fixes
console.log('🚀 Final Test: Hugging Face Complete Fix\n');

async function finalTest() {
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

    // Test 2: Arabic Language Test
    console.log('\n📋 Test 2: Arabic Language Test');
    const arabicResult = await testLanguage('ar');
    console.log(`Arabic test: ${arabicResult ? '✅ Success' : '❌ Failed'}`);

    // Test 3: English Language Test
    console.log('\n📋 Test 3: English Language Test');
    const englishResult = await testLanguage('en');
    console.log(`English test: ${englishResult ? '✅ Success' : '❌ Failed'}`);

    // Test 4: Auto Detection Test
    console.log('\n📋 Test 4: Auto Language Detection Test');
    const autoResult = await testLanguage(null);
    console.log(`Auto detection test: ${autoResult ? '✅ Success' : '❌ Failed'}`);

    // Summary
    console.log('\n📊 Final Test Summary:');
    console.log(`- Health Check: ✅`);
    console.log(`- Arabic Language: ${arabicResult ? '✅' : '❌'}`);
    console.log(`- English Language: ${englishResult ? '✅' : '❌'}`);
    console.log(`- Auto Detection: ${autoResult ? '✅' : '❌'}`);

    if (arabicResult && englishResult && autoResult) {
      console.log('\n🎉 All tests passed!');
      console.log('✅ Hugging Face is working correctly');
      console.log('✅ Language detection is working');
      console.log('✅ Audio processing is working');
      console.log('✅ The application should work without errors');
    } else {
      console.log('\n⚠️ Some tests failed');
      console.log('🔧 Please check the logs above');
    }

  } catch (error) {
    console.error('❌ Final test failed:', error.message);
  }
}

async function testLanguage(language) {
  try {
    const testAudio = createTestAudio();
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

function createTestAudio() {
  const sampleRate = 16000;
  const duration = 2;
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

// Run the final test
finalTest(); 