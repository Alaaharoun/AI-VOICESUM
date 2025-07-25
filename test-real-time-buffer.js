const WebSocket = require('ws');

console.log('🔍 Testing Real-Time Buffer Management (Fixed)');

// Create realistic audio data for Azure Speech SDK (16kHz, 16-bit, mono PCM)
function createRealisticAudio(durationMs = 500) {
  const sampleRate = 16000;
  const bitsPerSample = 16;
  const channels = 1;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = Buffer.alloc(totalSamples * bytesPerSample * channels);
  
  // Generate a sine wave at 440Hz (A note)
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

function testRealTimeBufferBehavior() {
  console.log('\n📋 Testing Real-Time Buffer Behavior (Should NOT clear every 3 seconds)');
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  let receivedMessages = [];
  let audioChunksSent = 0;
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected to Render server');
    
    // Real-time mode init message
    const initMessage = {
      type: 'init',
      language: 'en-US',
      targetLanguage: 'ar-SA',
      clientSideTranslation: true,
      realTimeMode: true, // Real-time mode enabled
      autoDetection: true,
      audioConfig: {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        encoding: 'pcm_s16le'
      }
    };
    
    console.log('📤 Sending real-time init message:', JSON.stringify(initMessage, null, 2));
    ws.send(JSON.stringify(initMessage));
    
    // Send audio chunks continuously for 8 seconds (should NOT trigger buffer clear timeouts)
    let chunkCount = 0;
    const audioInterval = setInterval(() => {
      chunkCount++;
      audioChunksSent++;
      
      const audio = createRealisticAudio(500); // 500ms chunks
      console.log(`📤 Sending audio chunk ${chunkCount} (${audio.length} bytes)...`);
      ws.send(audio);
      
      if (chunkCount >= 16) { // 16 chunks = 8 seconds
        clearInterval(audioInterval);
        console.log('🛑 Finished sending 16 audio chunks (8 seconds total)');
        
        // Wait a bit more to see final results, then close
        setTimeout(() => {
          console.log('⏰ Test completed - analyzing buffer behavior');
          console.log(`📊 Total audio chunks sent: ${audioChunksSent}`);
          console.log(`📊 Total messages received: ${receivedMessages.length}`);
          
          const bufferClearMessages = receivedMessages.filter(msg => 
            msg.message && msg.message.includes('buffer cleared')
          );
          
          console.log(`📊 Buffer clear events: ${bufferClearMessages.length}`);
          
          if (bufferClearMessages.length === 0) {
            console.log('✅ SUCCESS: No automatic buffer clearing detected during recording!');
          } else {
            console.log('⚠️ Buffer clearing still happening during recording:');
            bufferClearMessages.forEach((msg, i) => {
              console.log(`   ${i + 1}. ${msg.message}`);
            });
          }
          
          ws.close();
        }, 3000);
      }
    }, 500); // Send chunk every 500ms
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
      
      console.log('📥 Server Response:', message.type, '-', message.text || message.message || message.error);
      
      if (message.type === 'status') {
        console.log('✅ Status:', message.message);
      } else if (message.type === 'transcription' || message.type === 'final') {
        console.log('🎤 Transcription result:', message.text || 'empty');
      }
    } catch (e) {
      console.log('📥 Raw Response:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Connection closed: ${code} - ${reason}`);
    console.log('\n✨ Real-time buffer test completed!');
    console.log('\n📋 Expected behavior:');
    console.log('  ✅ Buffer should accumulate chunks during recording');
    console.log('  ✅ Buffer should be sent when target size is reached');
    console.log('  ✅ Buffer should be cleared ONLY when recording stops');
    console.log('  ❌ Buffer should NOT be cleared every 3 seconds');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Connection Error:', err.message);
  });
}

// Start test
console.log('🚀 Starting real-time buffer behavior test...\n');
testRealTimeBufferBehavior(); 