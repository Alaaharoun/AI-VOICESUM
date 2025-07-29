// Test script for local server connection
const WebSocket = require('ws');

async function testLocalServer() {
  console.log('🔍 Testing local server connection...');
  
  try {
    // Test HTTP endpoint
    console.log('📡 Testing HTTP endpoint...');
    const httpResponse = await fetch('http://localhost:7860/health');
    if (httpResponse.ok) {
      const health = await httpResponse.json();
      console.log('✅ HTTP endpoint working:', health);
    } else {
      console.log('❌ HTTP endpoint failed:', httpResponse.status);
    }
  } catch (error) {
    console.log('❌ HTTP test failed:', error.message);
  }
  
  try {
    // Test WebSocket endpoint
    console.log('🔌 Testing WebSocket endpoint...');
    const ws = new WebSocket('ws://localhost:7860/ws');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      ws.send(JSON.stringify({
        type: 'init',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        engine: 'faster-whisper'
      }));
      
      // Close after test
      setTimeout(() => {
        ws.close();
        console.log('🔌 WebSocket test completed');
      }, 2000);
    });
    
    ws.on('message', (data) => {
      console.log('📨 WebSocket message received:', data.toString());
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log('⏰ WebSocket connection timeout');
        ws.close();
      }
    }, 5000);
    
  } catch (error) {
    console.log('❌ WebSocket test failed:', error.message);
  }
}

// Run test
testLocalServer(); 