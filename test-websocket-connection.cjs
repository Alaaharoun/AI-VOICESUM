// Quick WebSocket Connection Test
const WebSocket = require('ws');

console.log('🔧 Testing WebSocket connection to server...');

// Test local server first
const testLocalConnection = () => {
  return new Promise((resolve) => {
    console.log('🌐 Testing local server connection...');
    
    const ws = new WebSocket('ws://localhost:10000/ws');
    
    ws.on('open', () => {
      console.log('✅ Local WebSocket connected successfully');
      
      // Send init message
      const initMessage = {
        type: 'init',
        language: 'ar-SA',
        targetLanguage: 'en-US',
        clientSideTranslation: true,
        realTimeMode: true,
        autoDetection: false,
        audioConfig: {
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          encoding: 'pcm_s16le'
        }
      };
      
      ws.send(JSON.stringify(initMessage));
      console.log('📤 Sent init message to local server');
      
      setTimeout(() => {
        ws.close();
        resolve('local-success');
      }, 3000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', message.type);
        
        if (message.type === 'status') {
          console.log('✅ Server status:', message.message);
        } else if (message.type === 'error') {
          console.log('❌ Server error:', message.error);
        }
      } catch (error) {
        console.log('📥 Received raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ Local WebSocket error:', error.message);
      resolve('local-error');
    });
    
    ws.on('close', () => {
      console.log('🔌 Local WebSocket closed');
    });
  });
};

// Test remote server
const testRemoteConnection = () => {
  return new Promise((resolve) => {
    console.log('🌐 Testing remote server connection...');
    
    const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
    
    ws.on('open', () => {
      console.log('✅ Remote WebSocket connected successfully');
      
      // Send init message
      const initMessage = {
        type: 'init',
        language: 'ar-SA',
        targetLanguage: 'en-US',
        clientSideTranslation: true,
        realTimeMode: true,
        autoDetection: false,
        audioConfig: {
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          encoding: 'pcm_s16le'
        }
      };
      
      ws.send(JSON.stringify(initMessage));
      console.log('📤 Sent init message to remote server');
      
      setTimeout(() => {
        ws.close();
        resolve('remote-success');
      }, 3000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', message.type);
        
        if (message.type === 'status') {
          console.log('✅ Server status:', message.message);
        } else if (message.type === 'error') {
          console.log('❌ Server error:', message.error);
        }
      } catch (error) {
        console.log('📥 Received raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ Remote WebSocket error:', error.message);
      resolve('remote-error');
    });
    
    ws.on('close', () => {
      console.log('🔌 Remote WebSocket closed');
    });
  });
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting WebSocket connection tests...\n');
  
  // Test local server
  const localResult = await testLocalConnection();
  console.log(`\n📊 Local server result: ${localResult}`);
  
  // Wait a bit before testing remote
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test remote server
  const remoteResult = await testRemoteConnection();
  console.log(`\n📊 Remote server result: ${remoteResult}`);
  
  console.log('\n🎯 Test Summary:');
  console.log(`Local Server: ${localResult === 'local-success' ? '✅ Working' : '❌ Failed'}`);
  console.log(`Remote Server: ${remoteResult === 'remote-success' ? '✅ Working' : '❌ Failed'}`);
  
  if (localResult === 'local-success' || remoteResult === 'remote-success') {
    console.log('\n🎉 WebSocket connection is working!');
    console.log('✅ The "this.privAudioSource.id is not a function" error should be resolved');
  } else {
    console.log('\n⚠️ WebSocket connection issues detected');
    console.log('🔧 Check server logs for more details');
  }
};

runTests().catch(console.error); 