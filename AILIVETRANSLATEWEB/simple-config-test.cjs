console.log('🔧 Simple Server Configuration Test');
console.log('====================================');

// Test server configuration
console.log('\n📋 Server Configuration:');
console.log('========================');

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

// Test audio format
console.log('\n🎵 Audio Format Requirements:');
console.log('=============================');

const audioConfig = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  encoding: 'pcm_s16le'
};

console.log('✅ Sample Rate:', audioConfig.sampleRate, 'Hz');
console.log('✅ Channels:', audioConfig.channels);
console.log('✅ Bits Per Sample:', audioConfig.bitsPerSample);
console.log('✅ Encoding:', audioConfig.encoding);

// Test message format
console.log('\n📤 Message Format:');
console.log('==================');

const initMessage = {
  type: 'init',
  language: 'auto',
  targetLanguage: 'en',
  clientSideTranslation: true,
  realTimeMode: true,
  autoDetection: true,
  audioConfig: audioConfig
};

console.log('✅ Init Message:');
console.log(JSON.stringify(initMessage, null, 2));

// Test WebSocket connection
console.log('\n🔌 Testing WebSocket Connection...');
console.log('==================================');

const WebSocket = require('ws');

const ws = new WebSocket(serverConfig.wsUrl);

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully');
  
  // Send init message
  console.log('📤 Sending init message...');
  ws.send(JSON.stringify(initMessage));
  
  // Send test audio after 2 seconds
  setTimeout(() => {
    console.log('🎵 Sending test audio...');
    
    // Create test audio buffer
    const sampleRate = 16000;
    const duration = 1;
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(samples * 2);
    const view = new Int16Array(buffer);
    
    // Fill with sine wave
    for (let i = 0; i < samples; i++) {
      view[i] = Math.sin(i * 0.01) * 1000;
    }
    
    const base64Audio = Buffer.from(buffer).toString('base64');
    
    const audioMessage = {
      type: 'audio',
      data: base64Audio,
      format: 'audio/pcm'
    };
    
    ws.send(JSON.stringify(audioMessage));
    console.log('📤 Audio sent:', buffer.byteLength, 'bytes');
    
    // Close after 3 seconds
    setTimeout(() => {
      console.log('🔌 Closing connection...');
      ws.close();
    }, 3000);
  }, 2000);
});

ws.on('message', function message(data) {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', message);
  } catch (error) {
    console.log('📥 Raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log('🔌 WebSocket closed:', code, reason.toString());
  console.log('\n✅ Test completed');
});

console.log('⏳ Waiting for connection...'); 