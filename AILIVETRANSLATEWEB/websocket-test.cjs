const WebSocket = require('ws');

console.log('🔧 WebSocket Connection Test');
console.log('=====================================');

// Test WebSocket connection
const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully');
  
  // Send init message
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
  
  console.log('📤 Sending init message:', JSON.stringify(initMessage, null, 2));
  ws.send(JSON.stringify(initMessage));
  
  // Send test audio after 2 seconds
  setTimeout(() => {
    console.log('🎵 Sending test audio data...');
    
    // Create a simple test audio buffer (1 second of sine wave)
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(samples * 2); // 16-bit samples
    const view = new Int16Array(buffer);
    
    // Fill with sine wave
    for (let i = 0; i < samples; i++) {
      view[i] = Math.sin(i * 0.01) * 1000;
    }
    
    // Convert to base64
    const base64Audio = Buffer.from(buffer).toString('base64');
    
    const audioMessage = {
      type: 'audio',
      data: base64Audio,
      format: 'audio/pcm'
    };
    
    console.log('📤 Sending audio message:', {
      type: audioMessage.type,
      format: audioMessage.format,
      dataLength: audioMessage.data.length
    });
    
    ws.send(JSON.stringify(audioMessage));
    
    // Send another audio chunk after 3 seconds
    setTimeout(() => {
      console.log('🎵 Sending second audio chunk...');
      ws.send(JSON.stringify(audioMessage));
      
      // Close connection after 5 seconds
      setTimeout(() => {
        console.log('🔌 Closing connection...');
        ws.close();
      }, 2000);
    }, 3000);
    
  }, 2000);
});

ws.on('message', function message(data) {
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

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log('🔌 WebSocket closed:', code, reason.toString());
  console.log('✅ Test completed');
});

console.log('⏳ Waiting for responses...');
console.log('Press Ctrl+C to exit'); 