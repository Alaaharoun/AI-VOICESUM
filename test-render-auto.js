const WebSocket = require('ws');

console.log('🔍 Testing Render Server with Auto Detection (After Credentials Fix)');

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

function testRenderServerWithAuto() {
  console.log('\n📋 Testing Render Server with Auto Detection');
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  let receivedMessages = [];
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected to Render server');
    
    // Simplified init message with auto detection
    const initMessage = {
      type: 'init',
      language: 'en-US', // Default language for Azure
      targetLanguage: 'ar-SA',
      clientSideTranslation: true,
      realTimeMode: false,
      autoDetection: true, // Enable auto detection
      audioConfig: {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        encoding: 'pcm_s16le'
      }
    };
    
    console.log('📤 Sending simplified init with auto detection:', JSON.stringify(initMessage, null, 2));
    ws.send(JSON.stringify(initMessage));
    
    // Wait for initialization, then send audio
    setTimeout(() => {
      console.log('📤 Sending test audio chunk...');
      const audio1 = createRealisticAudio(2000); // 2 seconds
      ws.send(audio1);
    }, 3000);
    
    setTimeout(() => {
      console.log('⏰ Test timeout - analyzing Render server results');
      console.log(`📊 Total messages received: ${receivedMessages.length}`);
      
      if (receivedMessages.length === 0) {
        console.log('❌ No messages received from Render server');
        console.log('   Azure credentials might still be missing or incorrect');
      } else {
        console.log('✅ Messages received from Render server:');
        receivedMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
        });
        
        const hasTranscription = receivedMessages.some(msg => msg.type === 'transcription' || msg.type === 'final');
        if (hasTranscription) {
          console.log('🎉 Azure Speech SDK is working on Render!');
        } else {
          console.log('⚠️ Render responds but no transcription yet (may need real voice)');
        }
      }
      
      ws.close();
    }, 10000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
      console.log('📥 Render Server Response:', message.type, '-', message.text || message.message || message.error);
      
      if (message.type === 'error') {
        console.error('❌ Server Error Details:', message);
      } else if (message.type === 'status') {
        console.log('✅ Status update:', message.message);
      } else if (message.type === 'final' || message.type === 'transcription') {
        console.log('🎤 Speech recognition result:', message);
      }
    } catch (e) {
      console.log('📥 Render Server Raw Response:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Render server connection closed: ${code} - ${reason}`);
    console.log('\n✨ Render auto detection test completed!');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Render Server Error:', err.message);
  });
}

// Start test
console.log('🚀 Starting Render server auto detection test...\n');
testRenderServerWithAuto(); 