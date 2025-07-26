const WebSocket = require('ws');

console.log('🔍 Test Arabic Language Code - Verify ar-SA Handling');

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

function testArabicLanguage() {
  console.log('\n📋 Testing Arabic Language (ar-SA)');
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  let receivedMessages = [];
  let hasError = false;
  let errorDetails = null;
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected for Arabic test');
    
    // Send init message with Arabic language
    const initMessage = {
      type: 'init',
      language: 'ar-SA', // Specific Arabic language code
      targetLanguage: 'en-US',
      clientSideTranslation: true,
      realTimeMode: true,
      autoDetection: false, // Disable auto detection to test specific language
      audioConfig: {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        encoding: 'pcm_s16le'
      }
    };
    
    console.log('📤 Sending init message for Arabic:', JSON.stringify(initMessage, null, 2));
    ws.send(JSON.stringify(initMessage));
    
    // Wait for initialization, then send audio
    setTimeout(() => {
      console.log('📤 Sending audio for Arabic...');
      const audio = createRealisticAudio(2000); // 2 seconds
      ws.send(audio);
    }, 3000);
    
    setTimeout(() => {
      console.log('⏰ Test completed for Arabic');
      console.log(`📊 Total messages received: ${receivedMessages.length}`);
      
      if (receivedMessages.length === 0) {
        console.log('❌ No messages received for Arabic');
      } else {
        console.log('✅ Messages received for Arabic:');
        receivedMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
          if (msg.errorType) {
            console.log(`       Error Type: ${msg.errorType}, Code: ${msg.errorCode}, Reason: ${msg.reason}`);
          }
        });
      }
      
      if (hasError) {
        console.log('⚠️ Error detected for Arabic:', errorDetails);
        if (errorDetails?.errorCode === 2) {
          console.log('❌ This is a quota exceeded error (errorCode: 2)');
        } else if (errorDetails?.errorCode === 1007) {
          console.log('⚠️ This is a format error (errorCode: 1007)');
        }
      } else {
        console.log('✅ No errors for Arabic');
      }
      
      ws.close();
    }, 8000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
      console.log('📥 Arabic Response:', message.type, '-', message.text || message.message || message.error);
      
      if (message.type === 'error') {
        hasError = true;
        errorDetails = {
          error: message.error,
          errorType: message.errorType,
          errorCode: message.errorCode,
          reason: message.reason
        };
      }
    } catch (e) {
      console.log('📥 Arabic Raw Response:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Arabic connection closed: ${code} - ${reason}`);
    
    console.log('\n📋 Arabic Test Summary:');
    if (hasError) {
      console.log(`⚠️ Error occurred: ${errorDetails?.errorType || 'unknown'}`);
      if (errorDetails?.errorCode === 2) {
        console.log('❌ Quota exceeded error confirmed');
        console.log('📋 This suggests the issue is with Azure Speech Service quota');
      } else {
        console.log('ℹ️ Other error type - check server logs');
      }
    } else {
      console.log('✅ Arabic language code working correctly');
    }
    
    console.log('\n✨ Arabic language test completed!');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Arabic WebSocket Error:', err.message);
  });
}

// Start the test
console.log('🚀 Starting Arabic Language Code Test...\n');
testArabicLanguage(); 