#!/usr/bin/env node

/**
 * 🎵 إنشاء ملف صوتي صالح للاختبار
 * 
 * هذا السكريبت ينشئ ملف WAV صالح للاختبار
 */

const fs = require('fs');

function createTestAudio() {
  try {
    console.log('🎵 Creating test audio file...');
    
    // Create a simple WAV file with a sine wave
    const sampleRate = 16000;
    const duration = 2; // 2 seconds
    const frequency = 440; // A4 note
    const amplitude = 8000; // High amplitude for clear speech detection
    
    const numSamples = sampleRate * duration;
    const audioData = new Int16Array(numSamples);
    
    // Generate sine wave
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude;
      audioData[i] = Math.round(sample);
    }
    
    // Create WAV header
    const headerSize = 44;
    const dataSize = audioData.length * 2; // 16-bit samples
    const fileSize = headerSize + dataSize - 8;
    
    const header = Buffer.alloc(headerSize);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // audio format (PCM)
    header.writeUInt16LE(1, 22); // channels
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
    header.writeUInt16LE(2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    // Combine header with audio data
    const audioBuffer = Buffer.from(audioData.buffer);
    const wavBuffer = Buffer.concat([header, audioBuffer]);
    
    // Save test file
    const testFilePath = './AILIVETRANSLATEWEB/audiotest/test-audio.wav';
    fs.writeFileSync(testFilePath, wavBuffer);
    
    console.log('✅ Test audio file created:', testFilePath);
    console.log('📊 File details:', {
      size: wavBuffer.length,
      sizeKB: (wavBuffer.length / 1024).toFixed(2) + ' KB',
      duration: duration + ' seconds',
      sampleRate: sampleRate + ' Hz',
      frequency: frequency + ' Hz',
      amplitude: amplitude
    });
    
    // Analyze the created file
    const samples = new Int16Array(audioBuffer);
    let sum = 0;
    let maxAmplitude = 0;
    let zeroCrossings = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      sum += sample * sample;
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
      
      if (i > 0 && ((samples[i] >= 0 && samples[i-1] < 0) || (samples[i] < 0 && samples[i-1] >= 0))) {
        zeroCrossings++;
      }
    }
    
    const rms = Math.sqrt(sum / samples.length);
    const averageAmplitude = rms;
    const dynamicRange = maxAmplitude;
    const zeroCrossingRate = zeroCrossings / samples.length;
    
    console.log('🔍 Audio Analysis:');
    console.log('  - Average Amplitude:', averageAmplitude.toFixed(2));
    console.log('  - Dynamic Range:', dynamicRange);
    console.log('  - Zero Crossing Rate:', (zeroCrossingRate * 100).toFixed(2) + '%');
    console.log('  - Has Speech (old criteria):', averageAmplitude > 1000 && dynamicRange > 5000 && zeroCrossingRate > 0.1);
    console.log('  - Has Speech (new criteria):', averageAmplitude > 50 && dynamicRange > 100 && zeroCrossingRate > 0.01);
    
  } catch (error) {
    console.error('❌ Error creating test audio:', error);
  }
}

// Run the function
createTestAudio(); 