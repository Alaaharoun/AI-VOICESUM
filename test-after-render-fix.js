const WebSocket = require('ws');

console.log('🔧 Test After Render Fix - Verify Azure Speech Integration');

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

function testRenderAfterFix() {
  console.log('\n📋 Testing Render Server After Azure Credentials Fix');
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  let receivedMessages = [];
  let hasCredentials = false;
  let hasTranscription = false;
  
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
    
    console.log('📤 Sending init message (same as live-translation.tsx):', JSON.stringify(initMessage, null, 2));
    ws.send(JSON.stringify(initMessage));
    
    // Wait for initialization, then send audio
    setTimeout(() => {
      if (hasCredentials) {
        console.log('📤 Sending first audio chunk...');
        const audio1 = createRealisticAudio(1000); // 1 second
        ws.send(audio1);
      }
    }, 3000);
    
    setTimeout(() => {
      if (hasCredentials) {
        console.log('📤 Sending second audio chunk...');
        const audio2 = createRealisticAudio(1500); // 1.5 seconds
        ws.send(audio2);
      }
    }, 5000);
    
    setTimeout(() => {
      console.log('⏰ Test completed - analyzing Render server results');
      console.log(`📊 Total messages received: ${receivedMessages.length}`);
      
      if (receivedMessages.length === 0) {
        console.log('❌ STILL NO MESSAGES - Azure credentials still missing on Render');
        console.log('   📋 Action needed: Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to Render');
      } else {
        console.log('✅ Messages received from Render server:');
        receivedMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
        });
        
        if (hasCredentials && hasTranscription) {
          console.log('🎉 SUCCESS! Azure Speech is working on Render!');
          console.log('   🔄 Real-time transcription will now work in the app');
          console.log('   📱 Live translation feature is fully operational');
        } else if (hasCredentials && !hasTranscription) {
          console.log('⚠️ Credentials fixed but no transcription yet');
          console.log('   💡 This is normal with generated audio - try with real voice');
        } else {
          console.log('❌ Credentials still missing - check Render environment variables');
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
        if (message.error.includes('credentials')) {
          console.error('❌ Credentials Error - still not fixed on Render:', message.error);
        } else {
          console.error('❌ Other Error:', message.error);
        }
      } else if (message.type === 'status') {
        if (message.message.includes('Ready for audio') || message.message.includes('session started')) {
          hasCredentials = true;
          console.log('✅ Azure credentials working - server is ready!');
        }
        console.log('ℹ️ Status update:', message.message);
      } else if (message.type === 'final' || message.type === 'transcription') {
        hasTranscription = true;
        console.log('🎤 Speech recognition result:', message);
        console.log('   🔄 This would appear immediately in live-translation.tsx');
      }
    } catch (e) {
      console.log('📥 Render Server Raw Response:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Render server connection closed: ${code} - ${reason}`);
    
    console.log('\n📋 Summary:');
    if (hasCredentials) {
      console.log('✅ Azure credentials are working on Render');
      if (hasTranscription) {
        console.log('✅ Speech recognition is working');
        console.log('🎉 Live translation feature is ready!');
      } else {
        console.log('⚠️ No transcription (normal with generated audio)');
        console.log('💡 Test with real voice recording for best results');
      }
    } else {
      console.log('❌ Azure credentials still missing on Render');
      console.log('📋 Next steps:');
      console.log('   1. Go to Render Dashboard');
      console.log('   2. Navigate to Environment Variables');
      console.log('   3. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION');
      console.log('   4. Redeploy the service');
    }
    
    console.log('\n✨ Test completed!');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Render Server Error:', err.message);
  });
}

// Instructions
console.log('🚀 This test verifies if Azure Speech credentials have been added to Render\n');
console.log('📋 Expected flow after credentials are fixed:');
console.log('   1. WebSocket connects successfully');
console.log('   2. Init message is sent');
console.log('   3. Server responds with "Recognition session started"');
console.log('   4. Server responds with "Ready for audio input"');
console.log('   5. Audio chunks are sent');
console.log('   6. Server may respond with transcription results\n');

// Start test
testRenderAfterFix(); 