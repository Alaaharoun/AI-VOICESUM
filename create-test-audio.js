#!/usr/bin/env node

/**
 * 🎵 إنشاء ملف صوتي صالح للاختبار
 * 
 * هذا السكريبت ينشئ ملف WAV صالح للاختبار
 */

const fs = require('fs');

// إنشاء ملف WAV بسيط (1 ثانية من الصمت)
function createWavFile(filename, durationSeconds = 1) {
  const sampleRate = 16000; // 16kHz
  const channels = 1; // Mono
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * channels * bytesPerSample;
  const fileSize = 44 + dataSize; // 44 bytes header + data
  
  // WAV Header
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // byte rate
  header.writeUInt16LE(channels * bytesPerSample, 32); // block align
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  // إنشاء بيانات الصوت (صمت)
  const audioData = Buffer.alloc(dataSize);
  for (let i = 0; i < dataSize; i += 2) {
    audioData.writeInt16LE(0, i); // صفر = صمت
  }
  
  // دمج Header مع البيانات
  const wavFile = Buffer.concat([header, audioData]);
  
  // حفظ الملف
  fs.writeFileSync(filename, wavFile);
  
  console.log(`✅ تم إنشاء ملف صوتي: ${filename}`);
  console.log(`   المدة: ${durationSeconds} ثانية`);
  console.log(`   Sample Rate: ${sampleRate} Hz`);
  console.log(`   Channels: ${channels}`);
  console.log(`   Bits per Sample: ${bitsPerSample}`);
  console.log(`   حجم الملف: ${wavFile.length} bytes`);
  
  return wavFile;
}

// إنشاء ملف صوتي للاختبار
function createTestAudio() {
  const testFile = 'test-audio.wav';
  
  try {
    createWavFile(testFile, 2); // 2 ثانية من الصمت
    
    // قراءة الملف للتأكد
    const stats = fs.statSync(testFile);
    console.log(`\n📁 معلومات الملف:`);
    console.log(`   الاسم: ${testFile}`);
    console.log(`   الحجم: ${stats.size} bytes`);
    console.log(`   تاريخ الإنشاء: ${stats.birthtime}`);
    
    return testFile;
  } catch (error) {
    console.error(`❌ خطأ في إنشاء الملف الصوتي: ${error.message}`);
    return null;
  }
}

// تشغيل إذا كان الملف مستدعى مباشرة
if (require.main === module) {
  createTestAudio();
}

module.exports = { createWavFile, createTestAudio }; 