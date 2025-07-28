const fetch = require('node-fetch');

console.log('🔐 Testing Hugging Face API with Token Authentication');

// Configuration
const HF_API_URL = 'https://alaaharoun-faster-whisper-api.hf.space';
const API_TOKEN = process.env.FASTER_WHISPER_API_TOKEN || 'hf_...BgUc'; // Replace with your actual token

console.log('📋 Configuration:');
console.log('   API URL:', HF_API_URL);
console.log('   API Token:', API_TOKEN ? 'Configured' : 'Not configured');

async function testWithToken() {
  console.log('\n🧪 Testing API with token authentication...');
  
  try {
    // Test 1: Health check with token
    console.log('\n1️⃣ Testing health endpoint with token...');
    
    const healthResponse = await fetch(`${HF_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('   Status:', healthResponse.status);
    console.log('   Headers:', Object.fromEntries(healthResponse.headers.entries()));
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Health check successful:', healthData);
    } else {
      const errorText = await healthResponse.text();
      console.log('   ❌ Health check failed:', errorText);
    }
    
    // Test 2: Health check without token
    console.log('\n2️⃣ Testing health endpoint without token...');
    
    const healthResponseNoToken = await fetch(`${HF_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('   Status:', healthResponseNoToken.status);
    
    if (healthResponseNoToken.ok) {
      const healthDataNoToken = await healthResponseNoToken.json();
      console.log('   ✅ Health check without token successful:', healthDataNoToken);
    } else {
      const errorText = await healthResponseNoToken.text();
      console.log('   ❌ Health check without token failed:', errorText);
    }
    
    // Test 3: Transcribe endpoint with token
    console.log('\n3️⃣ Testing transcribe endpoint with token...');
    
    // Create a simple test audio blob
    const testAudioData = Buffer.from('test audio data');
    const formData = new FormData();
    formData.append('file', new Blob([testAudioData], { type: 'audio/wav' }), 'test.wav');
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    const transcribeResponse = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    console.log('   Status:', transcribeResponse.status);
    
    if (transcribeResponse.ok) {
      const transcribeData = await transcribeResponse.json();
      console.log('   ✅ Transcribe with token successful:', transcribeData);
    } else {
      const errorText = await transcribeResponse.text();
      console.log('   ❌ Transcribe with token failed:', errorText);
    }
    
    // Test 4: Transcribe endpoint without token
    console.log('\n4️⃣ Testing transcribe endpoint without token...');
    
    const transcribeResponseNoToken = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    console.log('   Status:', transcribeResponseNoToken.status);
    
    if (transcribeResponseNoToken.ok) {
      const transcribeDataNoToken = await transcribeResponseNoToken.json();
      console.log('   ✅ Transcribe without token successful:', transcribeDataNoToken);
    } else {
      const errorText = await transcribeResponseNoToken.text();
      console.log('   ❌ Transcribe without token failed:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

async function testAppConfiguration() {
  console.log('\n📱 Testing App Configuration...');
  
  // Simulate the app's current configuration
  const appConfig = {
    engine: 'huggingface',
    huggingFaceUrl: HF_API_URL,
    apiToken: API_TOKEN
  };
  
  console.log('   Current app config:', {
    engine: appConfig.engine,
    url: appConfig.huggingFaceUrl,
    hasToken: !!appConfig.apiToken
  });
  
  // Test what the app would send
  try {
    console.log('\n🔍 Testing app-style request...');
    
    const testAudioData = Buffer.from('test audio data');
    const formData = new FormData();
    formData.append('file', new Blob([testAudioData], { type: 'audio/wav' }), 'audio.wav');
    formData.append('language', 'en');
    formData.append('task', 'transcribe');
    
    const headers = {};
    if (appConfig.apiToken) {
      headers['Authorization'] = `Bearer ${appConfig.apiToken}`;
    }
    
    const response = await fetch(`${appConfig.huggingFaceUrl}/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    
    console.log('   App request status:', response.status);
    console.log('   App request headers sent:', headers);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ App request successful:', data);
    } else {
      const errorText = await response.text();
      console.log('   ❌ App request failed:', errorText);
    }
    
  } catch (error) {
    console.error('   ❌ App configuration test error:', error.message);
  }
}

async function checkHuggingFaceSpaceStatus() {
  console.log('\n🌐 Checking Hugging Face Space Status...');
  
  try {
    // Check if the space is accessible
    const response = await fetch(HF_API_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('   Space accessibility status:', response.status);
    console.log('   Space headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      console.log('   ✅ Hugging Face Space is accessible');
    } else {
      console.log('   ❌ Hugging Face Space is not accessible');
    }
    
  } catch (error) {
    console.error('   ❌ Space status check error:', error.message);
  }
}

// Main execution
async function runTests() {
  console.log('🚀 Starting Hugging Face Token Authentication Tests...\n');
  
  try {
    await checkHuggingFaceSpaceStatus();
    await testWithToken();
    await testAppConfiguration();
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log('✅ Tests completed');
    console.log('📝 Check the results above to determine if token is required');
    console.log('🔧 If token is required, add it to your app configuration');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 