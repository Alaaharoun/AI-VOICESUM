// Test Hugging Face response debugging
const fs = require('fs');
const path = require('path');

async function testHuggingFaceResponse() {
  console.log('🔍 Testing Hugging Face Response Debugging...\n');
  
  const HF_API_URL = 'https://alaaharoun-faster-whisper-api.hf.space';
  
  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${HF_API_URL}/health`);
    console.log(`   Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Health check successful:', healthData);
    } else {
      console.log('   ❌ Health check failed');
    }
    
    // Test 2: Test with sample audio file
    console.log('\n2️⃣ Testing with sample audio file...');
    
    // Create a simple test audio blob (simulating what the app sends)
    const testAudioData = new Uint8Array(32000); // 32KB of zeros
    const testBlob = new Blob([testAudioData], { type: 'audio/wav' });
    
    const formData = new FormData();
    formData.append('file', testBlob, 'test_audio.wav');
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    console.log('   Sending request to:', `${HF_API_URL}/transcribe`);
    console.log('   File size:', testBlob.size, 'bytes');
    console.log('   File type:', testBlob.type);
    
    const transcribeResponse = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000)
    });
    
    console.log(`   Response status: ${transcribeResponse.status}`);
    console.log(`   Response headers:`, Object.fromEntries(transcribeResponse.headers.entries()));
    
    if (transcribeResponse.ok) {
      const result = await transcribeResponse.json();
      console.log('   ✅ Transcribe successful:', result);
      
      if (result.success && result.text) {
        console.log('   ✅ Text received:', result.text);
      } else {
        console.log('   ⚠️ No text in response:', result);
      }
    } else {
      const errorText = await transcribeResponse.text();
      console.log('   ❌ Transcribe failed:', errorText);
    }
    
    // Test 3: Test with real audio file if available
    console.log('\n3️⃣ Testing with real audio file...');
    const audioFilePath = 'C:\\Users\\Dell\\Documents\\Sound Recordings\\Recording.wav';
    
    if (fs.existsSync(audioFilePath)) {
      console.log('   ✅ Found audio file:', audioFilePath);
      
      const audioBuffer = fs.readFileSync(audioFilePath);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      
      const realFormData = new FormData();
      realFormData.append('file', audioBlob, 'recording.wav');
      realFormData.append('language', 'en');
      realFormData.append('task', 'transcribe');
      
      console.log('   Sending real audio file...');
      console.log('   File size:', audioBlob.size, 'bytes');
      
      const realTranscribeResponse = await fetch(`${HF_API_URL}/transcribe`, {
        method: 'POST',
        body: realFormData,
        signal: AbortSignal.timeout(60000)
      });
      
      console.log(`   Response status: ${realTranscribeResponse.status}`);
      
      if (realTranscribeResponse.ok) {
        const realResult = await realTranscribeResponse.json();
        console.log('   ✅ Real transcribe successful:', realResult);
        
        if (realResult.success && realResult.text) {
          console.log('   ✅ Real text received:', realResult.text);
        } else {
          console.log('   ⚠️ No text in real response:', realResult);
        }
      } else {
        const realErrorText = await realTranscribeResponse.text();
        console.log('   ❌ Real transcribe failed:', realErrorText);
      }
    } else {
      console.log('   ⚠️ Audio file not found, skipping real file test');
    }
    
    // Test 4: Check what the app is actually sending
    console.log('\n4️⃣ Analyzing app request format...');
    
    // Simulate the exact app request
    const appAudioData = new Uint8Array(81144); // Size from console logs
    const appBlob = new Blob([appAudioData], { type: 'audio/wav' });
    
    const appFormData = new FormData();
    appFormData.append('file', appBlob, `audio_${Date.now()}.wav`);
    appFormData.append('language', 'en');
    appFormData.append('task', 'transcribe');
    
    console.log('   Simulating app request...');
    console.log('   File size:', appBlob.size, 'bytes');
    console.log('   File type:', appBlob.type);
    
    const appResponse = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: appFormData,
      signal: AbortSignal.timeout(60000)
    });
    
    console.log(`   App response status: ${appResponse.status}`);
    
    if (appResponse.ok) {
      const appResult = await appResponse.json();
      console.log('   ✅ App simulation successful:', appResult);
      
      if (appResult.success && appResult.text) {
        console.log('   ✅ App text received:', appResult.text);
      } else {
        console.log('   ⚠️ No text in app response:', appResult);
      }
    } else {
      const appErrorText = await appResponse.text();
      console.log('   ❌ App simulation failed:', appErrorText);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testHuggingFaceResponse().then(() => {
  console.log('\n🎉 Hugging Face response debugging completed!');
  console.log('\n📊 Summary:');
  console.log('   • Check if the API is responding correctly');
  console.log('   • Check if the app is sending the right format');
  console.log('   • Check if there are any CORS or network issues');
  console.log('   • Check if the response format matches what the app expects');
}).catch(error => {
  console.error('💥 Test failed:', error);
}); 