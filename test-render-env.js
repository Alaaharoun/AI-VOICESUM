const WebSocket = require('ws');

console.log('🔍 Testing Render Server Environment Variables');

function testRenderEnv() {
  console.log('\n📋 Testing Render Server Environment');
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected to Render server');
    
    // Send a simple init message
    const initMessage = {
      type: 'init',
      language: 'en-US'
    };
    
    console.log('📤 Sending simple init message:', JSON.stringify(initMessage));
    ws.send(JSON.stringify(initMessage));
    
    setTimeout(() => {
      console.log('⏰ Test timeout - checking if server responds at all');
      ws.close();
    }, 5000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 Render Server Response:', message);
      
      if (message.type === 'error') {
        console.error('❌ Server Error - likely Azure credentials issue:', message);
      } else {
        console.log('✅ Server responded successfully');
      }
    } catch (e) {
      console.log('📥 Render Server Raw Response:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Render server connection closed: ${code} - ${reason}`);
    console.log('\n💡 If no responses received, Azure credentials are likely missing on Render');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Render Server Connection Error:', err.message);
  });
}

// Start test
console.log('🚀 Starting Render environment test...\n');
testRenderEnv(); 