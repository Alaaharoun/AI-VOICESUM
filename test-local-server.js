const WebSocket = require('ws');

console.log('🔍 Testing Local Server with Azure Speech Integration');

// Create realistic audio data for Azure Speech SDK (16kHz, 16-bit, mono PCM)
function createRealisticAudio(durationMs = 1000) {
  const sampleRate = 16000;
  const bitsPerSample = 16;
  const channels = 1;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = Buffer.alloc(totalSamples * bytesPerSample * channels);
  
  // Generate a sine wave at 440Hz (A note) - more realistic than silence
  for (let i = 0; i < totalSamples; i++) {
    const time = i / sampleRate;
    const frequency = 440; // A note
    const amplitude = 0.3; // Moderate volume
    const sample = Math.sin(2 * Math.PI * frequency * time) * amplitude * 32767;
    buffer.writeInt16LE(Math.round(sample), i * 2);
  }
  
  console.log(`🎵 Generated ${durationMs}ms audio: ${buffer.length} bytes, ${totalSamples} samples @ ${sampleRate}Hz`);
  return buffer;
}

function testLocalServer() {
  console.log('\n📋 Testing Local Server with Azure Speech SDK');
  
  const ws = new WebSocket('ws://localhost:10000/ws');
  let receivedMessages = [];
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected to local server');
    
    // Send init message with auto detection
    const initMessage = {
      type: 'init',
      language: 'en-US',
      targetLanguage: 'ar-SA',
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
    
    // Wait for initialization, then send audio
    setTimeout(() => {
      console.log('📤 Sending first audio chunk...');
      const audio1 = createRealisticAudio(1000); // 1 second
      ws.send(audio1);
    }, 2000);
    
    setTimeout(() => {
      console.log('📤 Sending second audio chunk...');
      const audio2 = createRealisticAudio(1000); // 1 second
      ws.send(audio2);
    }, 4000);
    
    setTimeout(() => {
      console.log('⏰ Test completed - analyzing local server results');
      console.log(`📊 Total messages received: ${receivedMessages.length}`);
      
      if (receivedMessages.length === 0) {
        console.log('❌ No messages received from local server');
        console.log('   This means Azure Speech SDK is not working locally');
      } else {
        console.log('✅ Messages received from local server:');
        receivedMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
        });
        
        const hasTranscription = receivedMessages.some(msg => 
          msg.type === 'transcription' || msg.type === 'final'
        );
        
        if (hasTranscription) {
          console.log('🎉 Azure Speech SDK is working locally!');
          console.log('💡 The issue must be with Render server configuration');
        } else {
          console.log('⚠️ Local server responds but no transcription yet');
        }
      }
      
      ws.close();
    }, 8000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
      console.log('📥 Local Server Response:', message.type, '-', message.text || message.message || message.error);
      
      if (message.type === 'error') {
        console.error('❌ Server Error Details:', message);
      } else if (message.type === 'status') {
        console.log('✅ Status update:', message.message);
      } else if (message.type === 'final' || message.type === 'transcription') {
        console.log('🎤 Speech recognition result:', message);
      }
    } catch (e) {
      console.log('📥 Local Server Raw Response:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Local server connection closed: ${code} - ${reason}`);
    console.log('\n✨ Local server test completed!');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Local Server Error:', err.message);
  });
}

// Start test
console.log('🚀 Starting local server test...\n');
testLocalServer(); 