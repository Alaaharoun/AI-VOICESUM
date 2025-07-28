#!/usr/bin/env node

/**
 * 🔍 محلل الأخطاء التلقائي لـ VAD
 * 
 * هذا النظام يحلل الأخطاء ويقدم توصيات تلقائية
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

// إعدادات الاختبار
const HF_URL = 'https://alaaharoun-faster-whisper-api.hf.space';

// HTTP Request Helper
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Error Analysis Functions
class VADLogAnalyzer {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.recommendations = [];
  }
  
  addError(error, context = '') {
    this.errors.push({ error, context, timestamp: new Date().toISOString() });
  }
  
  addWarning(warning, context = '') {
    this.warnings.push({ warning, context, timestamp: new Date().toISOString() });
  }
  
  addRecommendation(recommendation, priority = 'medium') {
    this.recommendations.push({ recommendation, priority, timestamp: new Date().toISOString() });
  }
  
  async analyzeHealthCheck() {
    console.log('🔍 تحليل فحص الصحة...');
    
    try {
      const response = await makeRequest(`${HF_URL}/health`);
      
      if (response.status === 200) {
        console.log('✅ فحص الصحة: ناجح');
        
        // تحليل البيانات
        const data = response.data;
        
        if (!data.model_loaded) {
          this.addError('Model not loaded', 'health_check');
          this.addRecommendation('إعادة تشغيل الخدمة لتحميل النموذج', 'high');
        }
        
        if (!data.vad_support) {
          this.addWarning('VAD support not detected', 'health_check');
          this.addRecommendation('تحديث الخدمة لدعم VAD', 'medium');
        }
        
        return true;
      } else {
        this.addError(`Health check failed with status ${response.status}`, 'health_check');
        this.addRecommendation('فحص حالة الخادم وإعادة تشغيله', 'high');
        return false;
      }
    } catch (error) {
      this.addError(`Health check error: ${error.message}`, 'health_check');
      this.addRecommendation('فحص الاتصال بالخادم', 'high');
      return false;
    }
  }
  
  async analyzeTranscription() {
    console.log('🔍 تحليل التفريغ الصوتي...');
    
    try {
      // قراءة الملف الصوتي
      const audioFile = fs.readFileSync('test-audio.wav');
      
      // اختبار بدون VAD
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
      const formData = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test-audio.wav"',
        'Content-Type: audio/wav',
        '',
        audioFile.toString('base64'),
        `--${boundary}`,
        'Content-Disposition: form-data; name="language"',
        '',
        'en',
        `--${boundary}`,
        'Content-Disposition: form-data; name="task"',
        '',
        'transcribe',
        `--${boundary}--`
      ].join('\r\n');
      
      const response = await makeRequest(`${HF_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(formData)
        },
        body: formData
      });
      
      if (response.status === 200) {
        console.log('✅ التفريغ الصوتي: ناجح');
        
        const data = response.data;
        if (!data.text || data.text.trim() === '') {
          this.addWarning('Transcription returned empty text', 'transcription');
          this.addRecommendation('استخدام ملف صوتي يحتوي على كلام واضح', 'medium');
        }
        
        return true;
      } else {
        this.addError(`Transcription failed with status ${response.status}`, 'transcription');
        this.addRecommendation('فحص صحة الملف الصوتي', 'medium');
        return false;
      }
    } catch (error) {
      this.addError(`Transcription error: ${error.message}`, 'transcription');
      this.addRecommendation('فحص صحة الملف الصوتي والاتصال', 'high');
      return false;
    }
  }
  
  async analyzeVAD() {
    console.log('🔍 تحليل VAD...');
    
    try {
      const audioFile = fs.readFileSync('test-audio.wav');
      
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
      const formData = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test-audio.wav"',
        'Content-Type: audio/wav',
        '',
        audioFile.toString('base64'),
        `--${boundary}`,
        'Content-Disposition: form-data; name="vad_filter"',
        '',
        'true',
        `--${boundary}`,
        'Content-Disposition: form-data; name="vad_parameters"',
        '',
        'threshold=0.5',
        `--${boundary}--`
      ].join('\r\n');
      
      const response = await makeRequest(`${HF_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(formData)
        },
        body: formData
      });
      
      if (response.status === 200) {
        console.log('✅ VAD: ناجح');
        
        const data = response.data;
        if (!data.vad_enabled) {
          this.addWarning('VAD not enabled in response', 'vad');
        }
        
        return true;
      } else {
        this.addError(`VAD failed with status ${response.status}`, 'vad');
        
        // تحليل نوع الخطأ
        if (response.data && response.data.error) {
          const error = response.data.error;
          
          if (error.includes('threshold')) {
            this.addError('VAD threshold parameter error', 'vad');
            this.addRecommendation('إصلاح معالجة VAD parameters في الخادم', 'high');
          } else if (error.includes('Invalid data')) {
            this.addError('Invalid audio data', 'vad');
            this.addRecommendation('فحص صحة الملف الصوتي', 'medium');
          } else {
            this.addError(`Unknown VAD error: ${error}`, 'vad');
            this.addRecommendation('فحص logs الخادم', 'high');
          }
        }
        
        return false;
      }
    } catch (error) {
      this.addError(`VAD error: ${error.message}`, 'vad');
      this.addRecommendation('فحص الاتصال والملف الصوتي', 'high');
      return false;
    }
  }
  
  async analyzeFileSystem() {
    console.log('🔍 تحليل نظام الملفات...');
    
    try {
      // فحص وجود الملف الصوتي
      if (!fs.existsSync('test-audio.wav')) {
        this.addError('Test audio file not found', 'filesystem');
        this.addRecommendation('إنشاء ملف صوتي للاختبار', 'high');
        return false;
      }
      
      const stats = fs.statSync('test-audio.wav');
      
      if (stats.size === 0) {
        this.addError('Test audio file is empty', 'filesystem');
        this.addRecommendation('إنشاء ملف صوتي صالح', 'high');
        return false;
      }
      
      if (stats.size > 25 * 1024 * 1024) { // 25MB
        this.addWarning('Test audio file is too large', 'filesystem');
        this.addRecommendation('تقليل حجم الملف الصوتي', 'medium');
      }
      
      console.log('✅ نظام الملفات: جيد');
      return true;
    } catch (error) {
      this.addError(`File system error: ${error.message}`, 'filesystem');
      return false;
    }
  }
  
  generateReport() {
    console.log('\n📊 تقرير تحليل الأخطاء:');
    console.log('=' .repeat(60));
    
    // الأخطاء
    if (this.errors.length > 0) {
      console.log('\n❌ الأخطاء المكتشفة:');
      this.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.error}`);
        console.log(`      السياق: ${err.context}`);
        console.log(`      الوقت: ${err.timestamp}`);
      });
    }
    
    // التحذيرات
    if (this.warnings.length > 0) {
      console.log('\n⚠️ التحذيرات:');
      this.warnings.forEach((warn, index) => {
        console.log(`   ${index + 1}. ${warn.warning}`);
        console.log(`      السياق: ${warn.context}`);
      });
    }
    
    // التوصيات
    if (this.recommendations.length > 0) {
      console.log('\n💡 التوصيات:');
      
      // ترتيب التوصيات حسب الأولوية
      const highPriority = this.recommendations.filter(r => r.priority === 'high');
      const mediumPriority = this.recommendations.filter(r => r.priority === 'medium');
      const lowPriority = this.recommendations.filter(r => r.priority === 'low');
      
      if (highPriority.length > 0) {
        console.log('\n   🔴 أولوية عالية:');
        highPriority.forEach((rec, index) => {
          console.log(`      ${index + 1}. ${rec.recommendation}`);
        });
      }
      
      if (mediumPriority.length > 0) {
        console.log('\n   🟡 أولوية متوسطة:');
        mediumPriority.forEach((rec, index) => {
          console.log(`      ${index + 1}. ${rec.recommendation}`);
        });
      }
      
      if (lowPriority.length > 0) {
        console.log('\n   🟢 أولوية منخفضة:');
        lowPriority.forEach((rec, index) => {
          console.log(`      ${index + 1}. ${rec.recommendation}`);
        });
      }
    }
    
    // ملخص
    console.log('\n📈 ملخص التحليل:');
    console.log(`   الأخطاء: ${this.errors.length}`);
    console.log(`   التحذيرات: ${this.warnings.length}`);
    console.log(`   التوصيات: ${this.recommendations.length}`);
    
    const highPriorityCount = this.recommendations.filter(r => r.priority === 'high').length;
    const criticalIssues = this.errors.length + highPriorityCount;
    if (criticalIssues === 0) {
      console.log('🎉 النظام يعمل بشكل جيد!');
    } else if (criticalIssues <= 2) {
      console.log('⚠️ النظام يحتاج إصلاحات بسيطة');
    } else {
      console.log('❌ النظام يحتاج إصلاحات عاجلة');
    }
  }
}

// Main analysis function
async function runLogAnalysis() {
  console.log('🚀 بدء تحليل الأخطاء التلقائي...');
  console.log('=' .repeat(60));
  
  const analyzer = new VADLogAnalyzer();
  
  // التحقق من وجود الملف الصوتي
  if (!fs.existsSync('test-audio.wav')) {
    console.log('📝 إنشاء ملف صوتي للاختبار...');
    const { createTestAudio } = require('./create-test-audio.js');
    createTestAudio();
  }
  
  // تحليل النظام
  await analyzer.analyzeFileSystem();
  await analyzer.analyzeHealthCheck();
  await analyzer.analyzeTranscription();
  await analyzer.analyzeVAD();
  
  // إنشاء التقرير
  analyzer.generateReport();
  
  console.log('\n🎯 تحليل الأخطاء مكتمل!');
  console.log('=' .repeat(60));
  
  return analyzer;
}

// Run the analysis
if (require.main === module) {
  runLogAnalysis().catch(console.error);
}

module.exports = { VADLogAnalyzer, runLogAnalysis }; 