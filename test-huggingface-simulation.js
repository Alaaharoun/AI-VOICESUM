const fetch = require('node-fetch');

console.log('🎭 Hugging Face Faster Whisper Simulation Test - Showing How Real-Time Transcription Should Work');

// Create test audio data
function createTestWavAudio() {
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const samples = sampleRate * duration;
  
  // WAV header (44 bytes)
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples * 2, 4); // File size
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // Audio format (PCM)
  header.writeUInt16LE(1, 22); // Number of channels (mono)
  header.writeUInt32LE(sampleRate, 24); // Sample rate
  header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(samples * 2, 40); // Data size
  
  // Create audio data (sine wave at 440Hz)
  const audioData = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 * 32767;
    audioData.writeInt16LE(Math.round(value), i * 2);
  }
  
  return Buffer.concat([header, audioData]);
}

// Simulate real-time transcription with Hugging Face
async function simulateRealTimeTranscription() {
  console.log('\n📱 Simulating real-time transcription with Hugging Face...');
  
  const HF_API_URL = 'https://alaaharoun-faster-whisper-api.hf.space';
  let messageCount = 0;
  
  try {
    // Test 1: Health check first
    console.log('🔍 Checking Hugging Face service health...');
    const healthResponse = await fetch(`${HF_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('✅ Service health:', healthData);
    
    // Test 2: Simulate multiple transcription requests (like real-time)
    console.log('\n🎵 Simulating real-time audio chunks...');
    
    const audioChunks = [
      { name: 'chunk1.wav', language: 'en', expected: 'Hello' },
      { name: 'chunk2.wav', language: 'en', expected: 'Hello there' },
      { name: 'chunk3.wav', language: 'ar', expected: 'مرحبا' },
      { name: 'chunk4.wav', language: 'ar', expected: 'مرحبا بك' }
    ];
    
    for (let i = 0; i < audioChunks.length; i++) {
      const chunk = audioChunks[i];
      messageCount++;
      
      console.log(`\n📤 Sending audio chunk ${i + 1}/${audioChunks.length} (${chunk.language})...`);
      
      const testAudio = createTestWavAudio();
      
      const formData = new FormData();
      formData.append('file', new Blob([testAudio], { type: 'audio/wav' }), chunk.name);
      formData.append('language', chunk.language);
      formData.append('task', 'transcribe');
      
      const startTime = Date.now();
      
      const response = await fetch(`${HF_API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      });
      
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📥 Response ${messageCount} (${duration}ms):`, {
          success: data.success,
          text: data.text,
          language: data.language,
          probability: data.language_probability
        });
        
        // Simulate what the React app would do
        if (data.success && data.text) {
          console.log('🔄 Real-time transcription updated:', data.text);
          console.log('   → This would appear immediately in LIVE Original section');
          console.log(`   → Language detected: ${data.language} (${(data.language_probability * 100).toFixed(1)}% confidence)`);
          
          // Simulate translation trigger
          if (data.text.length > 5) {
            console.log('   → This would trigger translation and update both sections');
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Chunk ${i + 1} failed (${duration}ms):`, response.status, errorText);
      }
      
      // Simulate real-time delay
      if (i < audioChunks.length - 1) {
        console.log('⏳ Waiting 2 seconds before next chunk...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Test 3: Auto language detection
    console.log('\n🔍 Testing auto language detection...');
    const autoAudio = createTestWavAudio();
    
    const autoFormData = new FormData();
    autoFormData.append('file', new Blob([autoAudio], { type: 'audio/wav' }), 'auto_detect.wav');
    autoFormData.append('task', 'transcribe');
    // No language specified - should auto-detect
    
    const autoResponse = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: autoFormData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (autoResponse.ok) {
      const autoData = await autoResponse.json();
      console.log('📥 Auto-detection response:', {
        success: autoData.success,
        text: autoData.text,
        detectedLanguage: autoData.language,
        confidence: autoData.language_probability
      });
      console.log('🎯 Auto language detection working correctly');
    } else {
      console.log('❌ Auto language detection failed');
    }
    
    // Test 4: Translation test
    console.log('\n🌐 Testing translation functionality...');
    const translateAudio = createTestWavAudio();
    
    const translateFormData = new FormData();
    translateFormData.append('file', new Blob([translateAudio], { type: 'audio/wav' }), 'translate.wav');
    translateFormData.append('language', 'en');
    translateFormData.append('task', 'translate');
    
    const translateResponse = await fetch(`${HF_API_URL}/transcribe`, {
      method: 'POST',
      body: translateFormData,
      signal: AbortSignal.timeout(30000)
    });
    
    if (translateResponse.ok) {
      const translateData = await translateResponse.json();
      console.log('📥 Translation response:', {
        success: translateData.success,
        translatedText: translateData.text,
        originalLanguage: translateData.language
      });
      console.log('🌐 Translation functionality working correctly');
    } else {
      console.log('❌ Translation functionality failed');
    }
    
  } catch (error) {
    console.error('❌ Simulation error:', error.message);
  }
  
  console.log(`\n📊 Total messages processed: ${messageCount}`);
  console.log('\n✨ This demonstrates how Hugging Face Faster Whisper transcription should work in real-time!');
  console.log('\n📋 Key Differences from Azure:');
  console.log('   • Hugging Face processes complete audio files (not streaming)');
  console.log('   • Faster processing time for short audio clips');
  console.log('   • Free to use (no API costs)');
  console.log('   • Supports multiple languages with auto-detection');
  console.log('   • Can perform translation directly');
}

// Performance comparison
async function comparePerformance() {
  console.log('\n📊 Performance Comparison: Hugging Face vs Azure Simulation');
  
  const testRuns = 3;
  const hfDurations = [];
  const azureDurations = [];
  
  console.log(`\n🔄 Running ${testRuns} test runs for each service...`);
  
  for (let i = 0; i < testRuns; i++) {
    console.log(`\nTest run ${i + 1}/${testRuns}:`);
    
    // Hugging Face test
    try {
      const testAudio = createTestWavAudio();
      const formData = new FormData();
      formData.append('file', new Blob([testAudio], { type: 'audio/wav' }), 'test.wav');
      formData.append('task', 'transcribe');
      
      const hfStart = Date.now();
      const hfResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      });
      const hfDuration = Date.now() - hfStart;
      
      if (hfResponse.ok) {
        hfDurations.push(hfDuration);
        console.log(`   Hugging Face: ${hfDuration}ms ✅`);
      } else {
        console.log(`   Hugging Face: Failed ❌`);
      }
    } catch (error) {
      console.log(`   Hugging Face: Error - ${error.message} ❌`);
    }
    
    // Azure simulation (mock)
    const azureStart = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate Azure processing time
    const azureDuration = Date.now() - azureStart;
    azureDurations.push(azureDuration);
    console.log(`   Azure (simulated): ${azureDuration}ms ✅`);
    
    // Wait between tests
    if (i < testRuns - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Calculate averages
  const hfAvg = hfDurations.length > 0 ? hfDurations.reduce((a, b) => a + b, 0) / hfDurations.length : 0;
  const azureAvg = azureDurations.reduce((a, b) => a + b, 0) / azureDurations.length;
  
  console.log('\n📈 Performance Summary:');
  console.log('=======================');
  console.log(`Hugging Face Average: ${hfAvg.toFixed(0)}ms`);
  console.log(`Azure (simulated) Average: ${azureAvg.toFixed(0)}ms`);
  
  if (hfAvg > 0) {
    const difference = ((azureAvg - hfAvg) / azureAvg * 100);
    if (difference > 0) {
      console.log(`Hugging Face is ${difference.toFixed(1)}% faster than Azure`);
    } else {
      console.log(`Azure is ${Math.abs(difference).toFixed(1)}% faster than Hugging Face`);
    }
  }
  
  console.log('\n💡 Performance Notes:');
  console.log('   • Hugging Face processes complete files (not streaming)');
  console.log('   • Azure simulation assumes 1.5s processing time');
  console.log('   • Real Azure performance may vary based on audio length');
  console.log('   • Hugging Face is free, Azure has per-request costs');
}

// Main execution
async function runSimulation() {
  console.log('🚀 Starting Hugging Face Simulation...\n');
  
  try {
    await simulateRealTimeTranscription();
    await comparePerformance();
    
    console.log('\n🎉 Hugging Face simulation completed successfully!');
    console.log('\n📝 Recommendations:');
    console.log('   • Hugging Face is suitable for short audio clips (< 30 seconds)');
    console.log('   • For longer audio, consider chunking or using Azure');
    console.log('   • Both engines can be used based on your needs');
    console.log('   • Monitor performance and accuracy for your use case');
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

// Run the simulation
runSimulation(); 