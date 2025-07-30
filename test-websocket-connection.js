const WebSocket = require('ws');

async function testWebSocketConnection() {
  try {
    console.log('🔌 Testing WebSocket connection...');
    
    const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      
      // Send a simple test message
      const testMessage = {
        type: 'test',
        message: 'Hello from test client',
        timestamp: Date.now()
      };
      
      console.log('📤 Sending test message:', testMessage);
      ws.send(JSON.stringify(testMessage));
      
      // Send a small audio test
      setTimeout(() => {
        const audioTest = {
          type: 'audio',
          data: 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
          format: 'audio/wav',
          language: 'en-US'
        };
        
        console.log('📤 Sending small audio test...');
        ws.send(JSON.stringify(audioTest));
      }, 1000);
    });
    
    ws.on('message', (data) => {
      console.log('📨 Received message:', data.toString());
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', (code, reason) => {
      console.log('🔒 WebSocket closed:', code, reason.toString());
    });
    
    // Close after 10 seconds
    setTimeout(() => {
      console.log('⏰ Closing connection...');
      ws.close();
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error testing WebSocket:', error);
  }
}

// Run the test
testWebSocketConnection(); 