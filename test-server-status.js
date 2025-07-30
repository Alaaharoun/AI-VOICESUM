const fetch = require('node-fetch');
const WebSocket = require('ws');

console.log('🔍 Testing Server Status and WebSocket Connection');
console.log('================================================');

async function testServerStatus() {
  const serverUrl = 'https://ai-voicesum.onrender.com';
  
  try {
    // Test health endpoint
    console.log('\n1️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${serverUrl}/health`);
    console.log(`   Health Status: ${healthResponse.status} ${healthResponse.statusText}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log(`   Health Data:`, healthData);
    }
    
    // Test root endpoint
    console.log('\n2️⃣ Testing root endpoint...');
    const rootResponse = await fetch(serverUrl);
    console.log(`   Root Status: ${rootResponse.status} ${rootResponse.statusText}`);
    
    // Test WebSocket endpoint
    console.log('\n3️⃣ Testing WebSocket endpoint...');
    const wsResponse = await fetch(`${serverUrl}/ws`);
    console.log(`   WebSocket Status: ${wsResponse.status} ${wsResponse.statusText}`);
    
    if (wsResponse.status === 404) {
      console.log('   ❌ WebSocket endpoint not found!');
      console.log('   💡 This confirms the server mismatch issue.');
    }
    
    // Test WebSocket connection
    console.log('\n4️⃣ Testing WebSocket connection...');
    await testWebSocketConnection(`${serverUrl.replace('https://', 'wss://')}/ws`);
    
  } catch (error) {
    console.error('❌ Error testing server:', error.message);
  }
}

async function testWebSocketConnection(wsUrl) {
  return new Promise((resolve) => {
    console.log(`   Attempting to connect to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('   ✅ WebSocket connection opened!');
      
      // Send test message
      const testMessage = {
        type: 'init',
        language: 'en-US',
        targetLanguage: 'ar-SA',
        clientSideTranslation: true,
        realTimeMode: true,
        autoDetection: true
      };
      
      console.log('   📤 Sending test init message...');
      ws.send(JSON.stringify(testMessage));
      
      // Wait for response
      setTimeout(() => {
        console.log('   ⏰ No response received within 5 seconds');
        ws.close();
        resolve();
      }, 5000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('   📨 Received message:', message);
      } catch (error) {
        console.log('   📨 Received non-JSON message:', data.toString().substring(0, 100));
      }
    });
    
    ws.on('error', (error) => {
      console.log('   ❌ WebSocket error:', error.message);
      resolve();
    });
    
    ws.on('close', (code, reason) => {
      console.log(`   🔌 WebSocket closed: ${code} - ${reason}`);
      resolve();
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log('   ⏰ Connection timeout');
        ws.close();
        resolve();
      }
    }, 10000);
  });
}

function provideRecommendations() {
  console.log('\n📋 RECOMMENDATIONS');
  console.log('==================');
  console.log('');
  console.log('🔧 IMMEDIATE ACTIONS:');
  console.log('1. Deploy Azure Speech Service server using azure-server.js');
  console.log('2. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables');
  console.log('3. Update client configuration to use the new server URL');
  console.log('');
  console.log('💡 ALTERNATIVE SOLUTIONS:');
  console.log('1. Update client to work with Faster Whisper protocol');
  console.log('2. Use Hugging Face Spaces for transcription');
  console.log('3. Implement local Azure Speech Service');
  console.log('');
  console.log('📁 FILES AVAILABLE:');
  console.log('- azure-server.js (Azure Speech Service server)');
  console.log('- azure-package.json (Server dependencies)');
  console.log('- AZURE_DEPLOYMENT_GUIDE.md (Deployment instructions)');
  console.log('- WEBSOCKET_SERVER_MISMATCH_SOLUTION.md (Complete solution guide)');
  console.log('');
  console.log('🚀 NEXT STEPS:');
  console.log('1. Choose deployment option (new Render service or update existing)');
  console.log('2. Deploy Azure server with proper environment variables');
  console.log('3. Update client configuration');
  console.log('4. Test WebSocket connection');
  console.log('5. Verify real-time transcription works');
}

// Run the test
testServerStatus().then(() => {
  provideRecommendations();
}); 