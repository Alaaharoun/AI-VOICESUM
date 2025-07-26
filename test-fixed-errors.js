const WebSocket = require('ws');

console.log('🔧 Test Fixed Errors - Verify Improved Error Handling');

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

function testFixedErrorHandling() {
  console.log('\n📋 Testing Fixed Error Handling After Updates');
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  let receivedMessages = [];
  let hasError = false;
  let errorType = '';
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected to Render server');
    
    // Real-time mode init message (same as live-translation.tsx)
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
    
    console.log('📤 Sending init message with 16kHz audio config:', JSON.stringify(initMessage, null, 2));
    ws.send(JSON.stringify(initMessage));
    
    // Wait for initialization, then send audio
    setTimeout(() => {
      console.log('📤 Sending first audio chunk (16kHz format)...');
      const audio1 = createRealisticAudio(1000); // 1 second
      ws.send(audio1);
    }, 3000);
    
    setTimeout(() => {
      console.log('📤 Sending second audio chunk...');
      const audio2 = createRealisticAudio(1500); // 1.5 seconds
      ws.send(audio2);
    }, 5000);
    
    setTimeout(() => {
      console.log('⏰ Test completed - analyzing error handling results');
      console.log(`📊 Total messages received: ${receivedMessages.length}`);
      
      if (receivedMessages.length === 0) {
        console.log('❌ No messages received - server may be down');
      } else {
        console.log('✅ Messages received from Render server:');
        receivedMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
          if (msg.errorType) {
            console.log(`       Error Type: ${msg.errorType}, Code: ${msg.errorCode}, Reason: ${msg.reason}`);
          }
        });
        
        if (hasError) {
          console.log(`⚠️ Error detected: ${errorType}`);
          if (errorType === 'quota_exceeded') {
            console.log('❌ Still getting quota exceeded error - needs investigation');
          } else if (errorType === 'format_error') {
            console.log('⚠️ Audio format error - this is expected with generated audio');
          } else if (errorType === 'no_match') {
            console.log('ℹ️ No speech detected - normal with generated audio');
          } else {
            console.log('ℹ️ Other error type - check server logs');
          }
        } else {
          console.log('✅ No errors detected - improved error handling working');
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
        hasError = true;
        errorType = message.errorType || 'unknown';
        
        if (message.errorType === 'quota_exceeded') {
          console.error('❌ Quota exceeded error detected:', message.error);
        } else if (message.errorType === 'format_error') {
          console.warn('⚠️ Audio format error detected:', message.error);
        } else if (message.errorType === 'no_match') {
          console.info('ℹ️ No speech detected:', message.error);
        } else {
          console.error('❌ Other error detected:', message);
        }
      } else if (message.type === 'status') {
        if (message.message.includes('Ready for audio') || message.message.includes('session started')) {
          console.log('✅ Azure credentials working - server is ready!');
        }
        console.log('ℹ️ Status update:', message.message);
      } else if (message.type === 'final' || message.type === 'transcription') {
        console.log('🎤 Speech recognition result:', message);
      }
    } catch (e) {
      console.log('📥 Render Server Raw Response:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Render server connection closed: ${code} - ${reason}`);
    
    console.log('\n📋 Summary:');
    if (hasError) {
      console.log(`⚠️ Error occurred: ${errorType}`);
      if (errorType === 'quota_exceeded') {
        console.log('❌ Quota exceeded error still exists');
        console.log('📋 Next steps:');
        console.log('   1. Check Azure Speech Service quota');
        console.log('   2. Verify subscription limits');
        console.log('   3. Consider upgrading Azure plan');
      } else {
        console.log('ℹ️ Other error type - this may be normal');
      }
    } else {
      console.log('✅ No errors detected - improved error handling working');
    }
    
    console.log('\n✨ Test completed!');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Render Server Error:', err.message);
  });
}

// Instructions
console.log('🚀 This test verifies the improved error handling after fixes\n');
console.log('📋 Expected improvements:');
console.log('   1. More accurate error type detection');
console.log('   2. Better distinction between quota and format errors');
console.log('   3. Clearer error messages for users');
console.log('   4. Fixed audio format (16kHz instead of 48kHz)\n');

// Start test
testFixedErrorHandling(); 