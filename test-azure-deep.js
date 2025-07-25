const WebSocket = require('ws');

console.log('🔍 Comprehensive Azure Speech Service Debug Test');

let testNumber = 1;

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

// Test 1: Basic connection and init with English
function test1_EnglishInit() {
  console.log(`\n📋 Test ${testNumber++}: English Init + Audio Test`);
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  let receivedMessages = [];
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    const initMessage = {
      type: 'init',
      language: 'en-US',
      targetLanguage: 'ar-SA',
      clientSideTranslation: true,
      realTimeMode: true,
      audioConfig: {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        encoding: 'pcm_s16le'
      }
    };
    
    console.log('📤 Sending init message:', JSON.stringify(initMessage, null, 2));
    ws.send(JSON.stringify(initMessage));
    
    // Wait for initialization, then send multiple audio chunks
    setTimeout(() => {
      console.log('📤 Sending first audio chunk...');
      const audio1 = createRealisticAudio(500); // 500ms
      ws.send(audio1);
    }, 2000);
    
    setTimeout(() => {
      console.log('📤 Sending second audio chunk...');
      const audio2 = createRealisticAudio(500); // 500ms
      ws.send(audio2);
    }, 3000);
    
    setTimeout(() => {
      console.log('📤 Sending third audio chunk...');
      const audio3 = createRealisticAudio(1000); // 1000ms
      ws.send(audio3);
    }, 4000);
    
    setTimeout(() => {
      console.log('⏰ Test 1 timeout - analyzing results');
      console.log(`📊 Total messages received: ${receivedMessages.length}`);
      receivedMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
      });
      
      if (receivedMessages.length === 0) {
        console.log('❌ No messages received - possible server issue');
      } else if (receivedMessages.every(msg => !msg.text || msg.text.trim() === '')) {
        console.log('❌ All transcriptions empty - audio format or language issue');
      } else {
        console.log('✅ Received non-empty transcriptions');
      }
      
      ws.close();
    }, 8000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
      console.log('📥 Test 1 Response:', message.type, '-', message.text || message.message || message.error);
      
      if (message.type === 'error') {
        console.error('❌ Server Error Details:', message);
      }
    } catch (e) {
      console.log('📥 Test 1 Raw Response:', data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log('🔒 Test 1 completed\n');
    setTimeout(test2_ArabicInit, 1000);
  });
  
  ws.on('error', (err) => {
    console.log('❌ Test 1 Error:', err.message);
  });
}

// Test 2: Arabic language test
function test2_ArabicInit() {
  console.log(`📋 Test ${testNumber++}: Arabic Init + Audio Test`);
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  let receivedMessages = [];
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    const initMessage = {
      type: 'init',
      language: 'ar-SA',
      targetLanguage: 'en-US',
      clientSideTranslation: true,
      realTimeMode: false,
      audioConfig: {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        encoding: 'pcm_s16le'
      }
    };
    
    console.log('📤 Sending Arabic init message:', JSON.stringify(initMessage, null, 2));
    ws.send(JSON.stringify(initMessage));
    
    setTimeout(() => {
      console.log('📤 Sending audio for Arabic recognition...');
      const audio = createRealisticAudio(2000); // 2 seconds
      ws.send(audio);
    }, 2000);
    
    setTimeout(() => {
      console.log('⏰ Test 2 timeout - analyzing Arabic results');
      console.log(`📊 Total messages received: ${receivedMessages.length}`);
      receivedMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
      });
      ws.close();
    }, 6000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
      console.log('📥 Test 2 Response:', message.type, '-', message.text || message.message || message.error);
    } catch (e) {
      console.log('📥 Test 2 Raw Response:', data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log('🔒 Test 2 completed\n');
    setTimeout(test3_SilenceVsSound, 1000);
  });
  
  ws.on('error', (err) => {
    console.log('❌ Test 2 Error:', err.message);
  });
}

// Test 3: Silence vs Sound comparison
function test3_SilenceVsSound() {
  console.log(`📋 Test ${testNumber++}: Silence vs Sound Comparison`);
  
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    ws.send(JSON.stringify({
      type: 'init',
      language: 'en-US',
      audioConfig: { sampleRate: 16000, channels: 1, bitsPerSample: 16 }
    }));
    
    // Test 1: Send silence (zeros)
    setTimeout(() => {
      const silence = Buffer.alloc(32000, 0); // 1 second of silence
      console.log('📤 Sending silence (zeros)...');
      ws.send(silence);
    }, 2000);
    
    // Test 2: Send tone
    setTimeout(() => {
      const tone = createRealisticAudio(1000);
      console.log('📤 Sending tone audio...');
      ws.send(tone);
    }, 4000);
    
    setTimeout(() => {
      console.log('⏰ Test 3 completed');
      ws.close();
    }, 7000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 Test 3 Response:', message.type, '-', message.text || message.message || message.error);
    } catch (e) {
      console.log('📥 Test 3 Raw Response:', data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log('🔒 Test 3 completed');
    console.log('\n🏁 All debugging tests completed!');
    console.log('\n💡 Analysis Tips:');
    console.log('   - If all tests show empty transcriptions: Audio format issue');
    console.log('   - If only Arabic fails: Language support issue');
    console.log('   - If silence and sound behave the same: Audio processing issue');
    console.log('   - Check server logs for Azure Speech SDK errors');
  });
  
  ws.on('error', (err) => {
    console.log('❌ Test 3 Error:', err.message);
  });
}

// Start comprehensive tests
console.log('🚀 Starting comprehensive Azure Speech Service debugging...\n');
test1_EnglishInit(); 