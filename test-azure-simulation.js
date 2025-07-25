const WebSocket = require('ws');

console.log('🎭 Azure Speech Simulation Test - Showing How Real-Time Translation Should Work');

function createSimulatedServer() {
  const wss = new WebSocket.Server({ port: 8081 });
  console.log('🎭 Mock Azure Speech server started on port 8081');
  
  wss.on('connection', (ws) => {
    console.log('📱 Client connected to mock server');
    let initialized = false;
    let language = 'en-US';
    
    ws.on('message', (data) => {
      try {
        // Try to parse as JSON first (init message)
        if (!initialized) {
          const msg = JSON.parse(data.toString());
          console.log('📥 Mock server received init:', msg.type, msg.language);
          
          if (msg.type === 'init') {
            language = msg.language;
            initialized = true;
            
            // Send status messages like real Azure
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'status', message: 'Recognition session started' }));
              console.log('📤 Mock: Sent session started');
            }, 500);
            
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));
              console.log('📤 Mock: Sent ready for audio');
            }, 1000);
          }
          return;
        }
        
        // Handle audio data (simulate Azure processing)
        if (data instanceof Buffer) {
          console.log(`🎵 Mock: Received audio ${data.length} bytes`);
          
          // Simulate Azure Speech recognition with delays
          setTimeout(() => {
            // Send partial transcription (recognizing event)
            const partialText = language === 'ar-SA' ? 'مرحبا بك' : 'Hello there';
            ws.send(JSON.stringify({ 
              type: 'transcription', 
              text: partialText
            }));
            console.log('📤 Mock: Sent partial transcription:', partialText);
          }, 1000);
          
          setTimeout(() => {
            // Send final transcription (recognized event)
            const finalText = language === 'ar-SA' ? 'مرحبا بك في تطبيق الترجمة الفورية' : 'Hello there welcome to live translation app';
            ws.send(JSON.stringify({ 
              type: 'final', 
              text: finalText
            }));
            console.log('📤 Mock: Sent final transcription:', finalText);
          }, 2500);
        }
        
      } catch (parseError) {
        // Audio data or invalid JSON
        if (data instanceof Buffer) {
          console.log(`🎵 Mock: Processing audio chunk ${data.length} bytes`);
        }
      }
    });
    
    ws.on('close', () => {
      console.log('📱 Client disconnected from mock server');
    });
  });
  
  return wss;
}

function testClientWithMockServer() {
  console.log('\n📱 Testing client with mock Azure server...');
  
  const ws = new WebSocket('ws://localhost:8081');
  let messageCount = 0;
  
  ws.on('open', () => {
    console.log('✅ Connected to mock server');
    
    // Send init message
    const initMsg = {
      type: 'init',
      language: 'en-US',
      targetLanguage: 'ar-SA',
      realTimeMode: true
    };
    
    console.log('📤 Client: Sending init message');
    ws.send(JSON.stringify(initMsg));
    
    // Send mock audio after initialization
    setTimeout(() => {
      const mockAudio = Buffer.alloc(32000, 65); // Mock audio data
      console.log('📤 Client: Sending audio chunk');
      ws.send(mockAudio);
    }, 2000);
    
    // Send second chunk
    setTimeout(() => {
      const mockAudio2 = Buffer.alloc(32000, 66);
      console.log('📤 Client: Sending second audio chunk');
      ws.send(mockAudio2);
    }, 4000);
    
    // Close after demonstration
    setTimeout(() => {
      console.log('⏰ Demo completed, closing connection');
      ws.close();
    }, 8000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      messageCount++;
      
      console.log(`📥 Client received (${messageCount}):`, message.type, '-', message.text || message.message);
      
      // Simulate what the React app would do
      if (message.type === 'transcription') {
        console.log('🔄 Real-time transcription updated:', message.text);
        console.log('   → This would appear immediately in LIVE Original section');
      } else if (message.type === 'final') {
        console.log('✅ Final transcription received:', message.text);
        console.log('   → This would trigger translation and update both sections');
      } else if (message.type === 'status') {
        console.log('ℹ️ Status update:', message.message);
      }
      
    } catch (e) {
      console.log('📥 Client received raw:', data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log('🔒 Client disconnected');
    console.log(`\n📊 Total messages received: ${messageCount}`);
    console.log('\n✨ This demonstrates how Azure Speech transcription should appear in real-time!');
    process.exit(0);
  });
  
  ws.on('error', (err) => {
    console.log('❌ Client error:', err.message);
  });
}

// Start the demonstration
console.log('🚀 Starting Azure Speech simulation...\n');

// Create mock server
const mockServer = createSimulatedServer();

// Wait a bit then test with client
setTimeout(() => {
  testClientWithMockServer();
}, 1000);

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mock server...');
  mockServer.close();
  process.exit(0);
}); 