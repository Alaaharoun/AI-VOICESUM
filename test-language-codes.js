const WebSocket = require('ws');

console.log('🔍 Test Language Codes - Verify Azure Language Code Handling');

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

function testLanguageCode(languageCode, languageName) {
  return new Promise((resolve) => {
    console.log(`\n📋 Testing Language: ${languageName} (${languageCode})`);
    
    const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
    let receivedMessages = [];
    let hasError = false;
    let errorDetails = null;
    
    ws.on('open', () => {
      console.log(`✅ WebSocket connected for ${languageName}`);
      
      // Send init message with specific language
      const initMessage = {
        type: 'init',
        language: languageCode, // Specific language code
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
      
      console.log(`📤 Sending init message for ${languageName}:`, JSON.stringify(initMessage, null, 2));
      ws.send(JSON.stringify(initMessage));
      
      // Wait for initialization, then send audio
      setTimeout(() => {
        console.log(`📤 Sending audio for ${languageName}...`);
        const audio = createRealisticAudio(2000); // 2 seconds
        ws.send(audio);
      }, 3000);
      
      setTimeout(() => {
        console.log(`⏰ Test completed for ${languageName}`);
        console.log(`📊 Total messages received: ${receivedMessages.length}`);
        
        if (receivedMessages.length === 0) {
          console.log(`❌ No messages received for ${languageName}`);
        } else {
          console.log(`✅ Messages received for ${languageName}:`);
          receivedMessages.forEach((msg, i) => {
            console.log(`   ${i + 1}. ${msg.type}: "${msg.text || msg.message || msg.error}"`);
            if (msg.errorType) {
              console.log(`       Error Type: ${msg.errorType}, Code: ${msg.errorCode}, Reason: ${msg.reason}`);
            }
          });
        }
        
        if (hasError) {
          console.log(`⚠️ Error detected for ${languageName}:`, errorDetails);
        } else {
          console.log(`✅ No errors for ${languageName}`);
        }
        
        ws.close();
        resolve({ language: languageName, code: languageCode, hasError, errorDetails, messageCount: receivedMessages.length });
      }, 8000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        receivedMessages.push(message);
        console.log(`📥 ${languageName} Response:`, message.type, '-', message.text || message.message || message.error);
        
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
        console.log(`📥 ${languageName} Raw Response:`, data.toString());
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔒 ${languageName} connection closed: ${code} - ${reason}`);
    });
    
    ws.on('error', (err) => {
      console.log(`❌ ${languageName} WebSocket Error:`, err.message);
    });
  });
}

async function runLanguageTests() {
  console.log('🚀 Starting Language Code Tests...\n');
  
  // Test different language codes
  const languages = [
    { code: 'ar-SA', name: 'Arabic (Saudi Arabia)' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'fr-FR', name: 'French (France)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'de-DE', name: 'German (Germany)' },
    { code: 'it-IT', name: 'Italian (Italy)' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'ru-RU', name: 'Russian (Russia)' },
    { code: 'ja-JP', name: 'Japanese (Japan)' },
    { code: 'ko-KR', name: 'Korean (Korea)' },
    { code: 'zh-CN', name: 'Chinese (China)' },
    { code: 'tr-TR', name: 'Turkish (Turkey)' },
    { code: 'nl-NL', name: 'Dutch (Netherlands)' },
    { code: 'pl-PL', name: 'Polish (Poland)' },
    { code: 'sv-SE', name: 'Swedish (Sweden)' }
  ];
  
  const results = [];
  
  // Test each language with a delay to avoid overwhelming the server
  for (const lang of languages) {
    const result = await testLanguageCode(lang.code, lang.name);
    results.push(result);
    
    // Wait between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Analyze results
  console.log('\n📊 Language Test Results Summary:');
  console.log('=====================================');
  
  const successful = results.filter(r => !r.hasError);
  const failed = results.filter(r => r.hasError);
  
  console.log(`✅ Successful languages: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`   ✅ ${r.language} (${r.code}) - ${r.messageCount} messages`);
  });
  
  console.log(`❌ Failed languages: ${failed.length}/${results.length}`);
  failed.forEach(r => {
    console.log(`   ❌ ${r.language} (${r.code}) - ${r.errorDetails?.errorType || 'unknown error'}`);
    if (r.errorDetails?.errorCode === 2) {
      console.log(`       ⚠️ This might be a quota exceeded error`);
    }
  });
  
  // Check for patterns
  const quotaErrors = failed.filter(r => r.errorDetails?.errorCode === 2);
  const formatErrors = failed.filter(r => r.errorDetails?.errorCode === 1007);
  
  console.log('\n🔍 Error Analysis:');
  console.log(`   Quota exceeded errors: ${quotaErrors.length}`);
  console.log(`   Format errors: ${formatErrors.length}`);
  console.log(`   Other errors: ${failed.length - quotaErrors.length - formatErrors.length}`);
  
  if (quotaErrors.length > 0) {
    console.log('\n⚠️ Quota exceeded errors detected in languages:');
    quotaErrors.forEach(r => {
      console.log(`   - ${r.language} (${r.code})`);
    });
  }
  
  console.log('\n✨ Language code testing completed!');
}

// Start the tests
runLanguageTests().catch(console.error); 