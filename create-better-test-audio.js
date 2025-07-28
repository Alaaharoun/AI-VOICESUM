const fs = require('fs');

function createBetterWavFile(filename, durationSeconds = 3) {
  const sampleRate = 16000; // 16kHz
  const channels = 1; // Mono
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * channels * bytesPerSample;
  const fileSize = 44 + dataSize; // 44 bytes header + data
  
  const header = Buffer.alloc(44);
  
  // WAV header
  header.write('RIFF', 0); // Chunk ID
  header.writeUInt32LE(fileSize - 8, 4); // Chunk Size
  header.write('WAVE', 8); // Format
  header.write('fmt ', 12); // Subchunk1 ID
  header.writeUInt32LE(16, 16); // Subchunk1 Size
  header.writeUInt16LE(1, 20); // Audio Format (PCM)
  header.writeUInt16LE(channels, 22); // Num Channels
  header.writeUInt32LE(sampleRate, 24); // Sample Rate
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // Byte Rate
  header.writeUInt16LE(channels * bytesPerSample, 32); // Block Align
  header.writeUInt16LE(bitsPerSample, 34); // Bits Per Sample
  header.write('data', 36); // Subchunk2 ID
  header.writeUInt32LE(dataSize, 40); // Subchunk2 Size
  
  // Create audio data with a simple tone (440Hz sine wave)
  const audioData = Buffer.alloc(dataSize);
  const frequency = 440; // A4 note
  const amplitude = 0.3;
  
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
    const sampleValue = Math.round(sample * 32767); // Convert to 16-bit
    audioData.writeInt16LE(sampleValue, i * 2);
  }
  
  const wavFile = Buffer.concat([header, audioData]);
  fs.writeFileSync(filename, wavFile);
  console.log(`✅ تم إنشاء ملف صوتي محسن: ${filename}`);
  console.log(`📊 التفاصيل:`);
  console.log(`   - المدة: ${durationSeconds} ثانية`);
  console.log(`   - التردد: ${sampleRate} Hz`);
  console.log(`   - القنوات: ${channels}`);
  console.log(`   - البتات: ${bitsPerSample}`);
  console.log(`   - الحجم: ${wavFile.length} bytes`);
  console.log(`   - النغمة: ${frequency} Hz (A4)`);
  
  return wavFile;
}

// Create test audio file
const testFile = 'better-test-audio.wav';
createBetterWavFile(testFile, 3);

console.log('\n🎵 الملف جاهز للاختبار!');
console.log('💡 هذا الملف يحتوي على نغمة A4 (440Hz) لمدة 3 ثوان');
console.log('🔧 مناسب لاختبار VAD لأنه يحتوي على نشاط صوتي واضح'); 