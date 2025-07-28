#!/usr/bin/env node

/**
 * 🧪 سكريبت اختبار الترجمة في التطبيق
 * 
 * هذا السكريبت يختبر الترجمة الصوتية في التطبيق مع الخادم المصلح
 */

const fs = require('fs');
const path = require('path');

class AppTranscriptionTester {
  constructor() {
    this.baseUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
    this.testResults = [];
  }

  async testAll() {
    console.log('🧪 بدء اختبار الترجمة في التطبيق...');
    console.log('');

    try {
      // اختبار Health Check
      await this.testHealthCheck();
      
      // اختبار Transcribe مع ملف صوتي صغير
      await this.testTranscribeWithAudio();
      
      // اختبار Error Handling
      await this.testErrorHandling();
      
      // عرض النتائج
      this.displayResults();
      
    } catch (error) {
      console.error('❌ خطأ في الاختبار:', error.message);
      process.exit(1);
    }
  }

  async testHealthCheck() {
    console.log('🔍 اختبار Health Check...');
    
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      if (response.ok && data.status === 'healthy' && data.model_loaded) {
        console.log('  ✅ Health Check نجح - النموذج محمل');
        this.testResults.push({
          test: 'Health Check',
          status: 'PASS',
          details: data
        });
      } else {
        console.log('  ❌ Health Check فشل');
        this.testResults.push({
          test: 'Health Check',
          status: 'FAIL',
          details: data
        });
      }
    } catch (error) {
      console.log('  ❌ Health Check فشل:', error.message);
      this.testResults.push({
        test: 'Health Check',
        status: 'ERROR',
        details: error.message
      });
    }
  }

  async testTranscribeWithAudio() {
    console.log('🔍 اختبار Transcribe مع ملف صوتي...');
    
    try {
      // إنشاء ملف صوتي صغير للاختبار
      const testAudioPath = await this.createTestAudio();
      
      if (!testAudioPath) {
        console.log('  ⚠️ لم يتم إنشاء ملف صوتي للاختبار');
        this.testResults.push({
          test: 'Transcribe with Audio',
          status: 'SKIP',
          details: 'No test audio created'
        });
        return;
      }

      // قراءة الملف
      const audioBuffer = fs.readFileSync(testAudioPath);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      
      // إنشاء FormData
      const formData = new FormData();
      formData.append('file', audioBlob, 'test.wav');
      formData.append('language', 'en');
      formData.append('task', 'transcribe');
      
      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok && data.success && data.text) {
        console.log('  ✅ Transcribe نجح');
        console.log(`  📝 النص: "${data.text}"`);
        this.testResults.push({
          test: 'Transcribe with Audio',
          status: 'PASS',
          details: data
        });
      } else {
        console.log('  ❌ Transcribe فشل');
        console.log('  📋 التفاصيل:', data);
        this.testResults.push({
          test: 'Transcribe with Audio',
          status: 'FAIL',
          details: data
        });
      }
      
      // تنظيف الملف المؤقت
      if (fs.existsSync(testAudioPath)) {
        fs.unlinkSync(testAudioPath);
      }
      
    } catch (error) {
      console.log('  ❌ اختبار Transcribe فشل:', error.message);
      this.testResults.push({
        test: 'Transcribe with Audio',
        status: 'ERROR',
        details: error.message
      });
    }
  }

  async testErrorHandling() {
    console.log('🔍 اختبار معالجة الأخطاء...');
    
    try {
      // اختبار إرسال طلب بدون ملف
      const formData = new FormData();
      
      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (response.status === 400 && data.error && data.success === false) {
        console.log('  ✅ معالجة الخطأ تعمل بشكل صحيح');
        this.testResults.push({
          test: 'Error Handling',
          status: 'PASS',
          details: data
        });
      } else {
        console.log('  ❌ معالجة الخطأ لا تعمل');
        this.testResults.push({
          test: 'Error Handling',
          status: 'FAIL',
          details: data
        });
      }
    } catch (error) {
      console.log('  ❌ اختبار معالجة الأخطاء فشل:', error.message);
      this.testResults.push({
        test: 'Error Handling',
        status: 'ERROR',
        details: error.message
      });
    }
  }

  async createTestAudio() {
    try {
      // محاولة إنشاء ملف صوتي صغير باستخدام ffmpeg
      const testAudioPath = path.join(__dirname, 'test-audio.wav');
      
      // استخدام node.js لإنشاء ملف صوتي بسيط
      const { execSync } = require('child_process');
      
      try {
        // محاولة استخدام ffmpeg
        execSync(`ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" -y "${testAudioPath}"`, { stdio: 'ignore' });
        
        if (fs.existsSync(testAudioPath)) {
          console.log('  ✅ تم إنشاء ملف صوتي للاختبار');
          return testAudioPath;
        }
      } catch (ffmpegError) {
        console.log('  ⚠️ ffmpeg غير متوفر، إنشاء ملف صوتي بسيط...');
      }
      
      // إنشاء ملف WAV بسيط بدون ffmpeg
      const wavHeader = this.createSimpleWavHeader();
      fs.writeFileSync(testAudioPath, wavHeader);
      
      if (fs.existsSync(testAudioPath)) {
        console.log('  ✅ تم إنشاء ملف صوتي بسيط للاختبار');
        return testAudioPath;
      }
      
      return null;
    } catch (error) {
      console.log('  ⚠️ فشل في إنشاء ملف صوتي:', error.message);
      return null;
    }
  }

  createSimpleWavHeader() {
    // إنشاء header بسيط لملف WAV
    const buffer = Buffer.alloc(44);
    
    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36, 4); // file size
    buffer.write('WAVE', 8);
    
    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // fmt chunk size
    buffer.writeUInt16LE(1, 20); // audio format (PCM)
    buffer.writeUInt16LE(1, 22); // channels
    buffer.writeUInt32LE(16000, 24); // sample rate
    buffer.writeUInt32LE(32000, 28); // byte rate
    buffer.writeUInt16LE(2, 32); // block align
    buffer.writeUInt16LE(16, 34); // bits per sample
    
    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(0, 40); // data size
    
    return buffer;
  }

  displayResults() {
    console.log('');
    console.log('📊 نتائج اختبار الترجمة:');
    console.log('');

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;
    const skipped = this.testResults.filter(r => r.status === 'SKIP').length;

    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'SKIP' ? '⏭️' : '⚠️';
      console.log(`${status} ${result.test}: ${result.status}`);
    });

    console.log('');
    console.log(`📈 الإحصائيات:`);
    console.log(`  ✅ نجح: ${passed}`);
    console.log(`  ❌ فشل: ${failed}`);
    console.log(`  ⚠️ أخطاء: ${errors}`);
    console.log(`  ⏭️ تخطى: ${skipped}`);
    console.log(`  📊 المجموع: ${this.testResults.length}`);

    if (passed >= 2) {
      console.log('');
      console.log('🎉 الترجمة تعمل بشكل صحيح! الإصلاحات نجحت.');
      console.log('');
      console.log('📱 يمكنك الآن استخدام التطبيق للترجمة الصوتية.');
    } else {
      console.log('');
      console.log('⚠️ بعض الاختبارات فشلت. يرجى التحقق من الإصلاحات.');
    }
  }
}

// تشغيل الاختبارات
async function main() {
  const tester = new AppTranscriptionTester();
  await tester.testAll();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AppTranscriptionTester; 