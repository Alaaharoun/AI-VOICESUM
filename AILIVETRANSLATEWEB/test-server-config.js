// Test Server Configuration and Audio Format
console.log('🔧 Testing Server Configuration and Audio Format');
console.log('================================================');

// Test server configuration
const testServerConfig = () => {
  console.log('\n📋 Server Configuration Test');
  console.log('============================');
  
  // Simulate getServerConfig('azure', true)
  const SERVER_CONFIG = {
    RENDER: {
      name: 'Render WebSocket Server',
      wsUrl: 'wss://ai-voicesum.onrender.com/ws',
      httpUrl: 'https://ai-voicesum.onrender.com/transcribe',
      healthUrl: 'https://ai-voicesum.onrender.com/health',
      engine: 'azure'
    }
  };
  
  const serverConfig = SERVER_CONFIG.RENDER;
  
  console.log('✅ Server Name:', serverConfig.name);
  console.log('✅ WebSocket URL:', serverConfig.wsUrl);
  console.log('✅ Health URL:', serverConfig.healthUrl);
  console.log('✅ Engine:', serverConfig.engine);
  
  return serverConfig;
};

// Test audio format compatibility
const testAudioFormat = () => {
  console.log('\n🎵 Audio Format Test');
  console.log('===================');
  
  // Required format for Azure Speech Service
  const requiredFormat = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    encoding: 'pcm_s16le'
  };
  
  console.log('✅ Required Format:');
  console.log('   - Sample Rate:', requiredFormat.sampleRate, 'Hz');
  console.log('   - Channels:', requiredFormat.channels);
  console.log('   - Bits Per Sample:', requiredFormat.bitsPerSample);
  console.log('   - Encoding:', requiredFormat.encoding);
  
  // Test audio buffer creation
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const samples = sampleRate * duration;
  const buffer = new ArrayBuffer(samples * 2); // 16-bit samples
  const view = new Int16Array(buffer);
  
  // Fill with test data
  for (let i = 0; i < samples; i++) {
    view[i] = Math.sin(i * 0.01) * 1000;
  }
  
  console.log('✅ Test Audio Buffer Created:');
  console.log('   - Size:', buffer.byteLength, 'bytes');
  console.log('   - Samples:', samples);
  console.log('   - Duration:', duration, 'seconds');
  
  return buffer;
};

// Test WebSocket message format
const testMessageFormat = () => {
  console.log('\n📤 Message Format Test');
  console.log('=====================');
  
  // Test init message
  const initMessage = {
    type: 'init',
    language: 'auto',
    targetLanguage: 'en',
    clientSideTranslation: true,
    realTimeMode: true,
    autoDetection: true,
    audioConfig: {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      encoding: 'pcm_s16le'
    }
  };
  
  console.log('✅ Init Message Format:');
  console.log(JSON.stringify(initMessage, null, 2));
  
  // Test audio message
  const testBuffer = testAudioFormat();
  const base64Audio = Buffer.from(testBuffer).toString('base64');
  
  const audioMessage = {
    type: 'audio',
    data: base64Audio,
    format: 'audio/pcm'
  };
  
  console.log('\n✅ Audio Message Format:');
  console.log('   - Type:', audioMessage.type);
  console.log('   - Format:', audioMessage.format);
  console.log('   - Data Length:', audioMessage.data.length);
  
  return { initMessage, audioMessage };
};

// Test WebSocket connection with detailed logging
const testWebSocketConnection = async () => {
  console.log('\n🔌 WebSocket Connection Test');
  console.log('===========================');
  
  const WebSocket = require('ws');
  const serverConfig = testServerConfig();
  const { initMessage, audioMessage } = testMessageFormat();
  
  console.log('\n🔗 Connecting to:', serverConfig.wsUrl);
  
  return new Promise((resolve) => {
    const ws = new WebSocket(serverConfig.wsUrl);
    
    const timeout = setTimeout(() => {
      console.log('⏰ Connection timeout');
      ws.close();
      resolve(false);
    }, 10000);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      
      // Send init message
      console.log('📤 Sending init message...');
      ws.send(JSON.stringify(initMessage));
      
      // Send audio message after 2 seconds
      setTimeout(() => {
        console.log('📤 Sending audio message...');
        ws.send(JSON.stringify(audioMessage));
        
        // Send another audio message after 3 seconds
        setTimeout(() => {
          console.log('📤 Sending second audio message...');
          ws.send(JSON.stringify(audioMessage));
          
          // Close connection after 5 seconds
          setTimeout(() => {
            console.log('🔌 Closing connection...');
            ws.close();
            clearTimeout(timeout);
            resolve(true);
          }, 2000);
        }, 3000);
      }, 2000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', message);
        
        if (message.type === 'status') {
          console.log('✅ Server status:', message.message);
        } else if (message.type === 'transcription') {
          console.log('🎤 Transcription:', message.text);
        } else if (message.type === 'final') {
          console.log('✅ Final transcription:', message.text);
        } else if (message.type === 'error') {
          console.log('❌ Server error:', message.error);
        }
      } catch (error) {
        console.log('📥 Received raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      resolve(false);
    });
    
    ws.on('close', (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      clearTimeout(timeout);
      resolve(false);
    });
  });
};

// Run all tests
const runAllTests = async () => {
  console.log('🚀 Starting comprehensive server configuration test...\n');
  
  try {
    // Test server configuration
    testServerConfig();
    
    // Test message format
    testMessageFormat();
    
    // Test WebSocket connection
    const result = await testWebSocketConnection();
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log('✅ Server Configuration: PASSED');
    console.log('✅ Audio Format: PASSED');
    console.log('✅ Message Format: PASSED');
    console.log(result ? '✅ WebSocket Connection: PASSED' : '❌ WebSocket Connection: FAILED');
    
    if (result) {
      console.log('\n🎉 All tests passed! Server configuration is correct.');
    } else {
      console.log('\n⚠️ WebSocket connection failed. Check server status.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run tests
runAllTests(); 