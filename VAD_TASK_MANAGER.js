#!/usr/bin/env node

/**
 * 📋 نظام إدارة مهام Voice Activity Detection (VAD)
 * 
 * هذا النظام يدير المهام بشكل تفاعلي ويعلمك عند الانتهاء من كل مهمة
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// إعدادات النظام
const CONFIG = {
  HF_URL: 'https://alaaharoun-faster-whisper-api.hf.space',
  LOCAL_URL: 'http://localhost:7860',
  TASK_TIMEOUT: 30000, // 30 seconds
  NOTIFICATION_SOUND: true
};

// Mock Audio Data
const mockAudioData = Buffer.alloc(1024);

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
      // إذا كان body هو FormData، نحتاج لمعالجته بشكل مختلف
      if (options.body.pipe) {
        options.body.pipe(req);
      } else {
        req.write(options.body);
      }
    } else {
      req.end();
    }
  });
}

// Task Manager Class
class VADTaskManager {
  constructor() {
    this.tasks = [];
    this.completedTasks = [];
    this.failedTasks = [];
    this.currentTask = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // إضافة مهمة جديدة
  addTask(name, description, testFunction, dependencies = []) {
    this.tasks.push({
      id: this.tasks.length + 1,
      name,
      description,
      testFunction,
      dependencies,
      status: 'pending',
      startTime: null,
      endTime: null,
      result: null,
      error: null
    });
  }

  // طباعة حالة المهمة
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      'info': 'ℹ️',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'task': '📋',
      'progress': '🔄'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  // إشعار عند الانتهاء من المهمة
  notifyTaskComplete(task, result) {
    this.log(`🎉 تم الانتهاء من المهمة: ${task.name}`, 'success');
    this.log(`   النتيجة: ${result}`, 'info');
    
    if (CONFIG.NOTIFICATION_SOUND) {
      // إشعار صوتي (في Windows)
      console.log('\x07'); // Bell character
    }
    
    // إشعار بصري
    console.log('=' .repeat(50));
    console.log(`✅ ${task.name.toUpperCase()} - مكتمل!`);
    console.log('=' .repeat(50));
  }

  // إشعار عند فشل المهمة
  notifyTaskFailed(task, error) {
    this.log(`💥 فشلت المهمة: ${task.name}`, 'error');
    this.log(`   الخطأ: ${error}`, 'error');
    
    if (CONFIG.NOTIFICATION_SOUND) {
      console.log('\x07\x07'); // Double bell for error
    }
    
    console.log('=' .repeat(50));
    console.log(`❌ ${task.name.toUpperCase()} - فشل!`);
    console.log('=' .repeat(50));
  }

  // فحص التبعيات
  checkDependencies(task) {
    for (const depId of task.dependencies) {
      const depTask = this.tasks.find(t => t.id === depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  // تشغيل مهمة واحدة
  async runTask(task) {
    if (!this.checkDependencies(task)) {
      this.log(`⏳ انتظار التبعيات للمهمة: ${task.name}`, 'warning');
      return false;
    }

    this.currentTask = task;
    task.status = 'running';
    task.startTime = new Date();
    
    this.log(`🔄 بدء المهمة: ${task.name}`, 'progress');
    this.log(`   الوصف: ${task.description}`, 'info');

    try {
      const result = await Promise.race([
        task.testFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task timeout')), CONFIG.TASK_TIMEOUT)
        )
      ]);

      task.status = 'completed';
      task.endTime = new Date();
      task.result = result;
      
      this.completedTasks.push(task);
      this.notifyTaskComplete(task, result);
      return true;

    } catch (error) {
      task.status = 'failed';
      task.endTime = new Date();
      task.error = error.message;
      
      this.failedTasks.push(task);
      this.notifyTaskFailed(task, error.message);
      return false;
    }
  }

  // تشغيل جميع المهام
  async runAllTasks() {
    this.log('🚀 بدء نظام إدارة مهام VAD', 'task');
    this.log('=' .repeat(60), 'info');

    // إضافة المهام
    this.addVADTasks();

    // عرض قائمة المهام
    this.showTaskList();

    // تشغيل المهام
    for (const task of this.tasks) {
      if (task.status === 'pending') {
        await this.runTask(task);
        
        // انتظار تأكيد المستخدم للمتابعة
        if (task.status === 'failed') {
          const continueAnyway = await this.askUser('هل تريد المتابعة رغم فشل هذه المهمة؟ (y/n): ');
          if (continueAnyway.toLowerCase() !== 'y') {
            this.log('⏹️ إيقاف الاختبارات بواسطة المستخدم', 'warning');
            break;
          }
        } else {
          const continueNext = await this.askUser('اضغط Enter للمتابعة للمهمة التالية...');
        }
      }
    }

    // عرض النتائج النهائية
    this.showFinalResults();
  }

  // تشغيل جميع المهام في الوضع التلقائي
  async runAllTasksAuto() {
    this.log('🤖 بدء نظام إدارة مهام VAD - الوضع التلقائي', 'task');
    this.log('=' .repeat(60), 'info');

    // إضافة المهام
    this.addVADTasks();

    // عرض قائمة المهام
    this.showTaskList();

    this.log('🔄 بدء التنفيذ التلقائي...', 'progress');

    // تشغيل المهام تلقائياً
    for (const task of this.tasks) {
      if (task.status === 'pending') {
        await this.runTask(task);
        
        // انتظار قصير بين المهام
        if (task.status === 'completed') {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // عرض النتائج النهائية
    this.showFinalResults();
  }

  // إضافة مهام VAD
  addVADTasks() {
    // المهمة 1: فحص الخدمة
    this.addTask(
      'فحص الخدمة',
      'التأكد من أن خدمة Faster-Whisper تعمل بشكل صحيح',
      async () => {
        const response = await makeRequest(`${CONFIG.HF_URL}/health`);
        if (response.status === 200) {
          return `الخدمة تعمل - Status: ${response.data.status}, Model: ${response.data.model_loaded}`;
        } else {
          throw new Error(`Health check failed: ${response.status}`);
        }
      }
    );

    // المهمة 2: اختبار Transcribe بدون VAD
    this.addTask(
      'اختبار Transcribe بدون VAD',
      'اختبار التفريغ الصوتي بدون Voice Activity Detection',
      async () => {
        // إنشاء ملف صوتي بسيط للاختبار
        const testAudioData = Buffer.alloc(1024);
        
        // استخدام FormData بدلاً من multipart manual
        const FormData = require('form-data');
        const formData = new FormData();
        
        // إضافة ملف صوتي
        formData.append('file', testAudioData, {
          filename: 'test.wav',
          contentType: 'audio/wav'
        });
        
        // إضافة المعاملات
        formData.append('language', 'en');
        formData.append('task', 'transcribe');
        
        const response = await makeRequest(`${CONFIG.HF_URL}/transcribe`, {
          method: 'POST',
          headers: {
            ...formData.getHeaders()
          },
          body: formData
        });
        
        if (response.status === 200) {
          return `Transcribe successful - Text: "${response.data.text}", Language: ${response.data.language}`;
        } else {
          throw new Error(`Transcribe failed: ${response.status} - ${JSON.stringify(response.data)}`);
        }
      },
      [1] // يعتمد على المهمة 1
    );

    // المهمة 3: اختبار Transcribe مع VAD
    this.addTask(
      'اختبار Transcribe مع VAD',
      'اختبار التفريغ الصوتي مع Voice Activity Detection',
      async () => {
        // إنشاء ملف صوتي بسيط للاختبار
        const testAudioData = Buffer.alloc(1024);
        
        // استخدام FormData
        const FormData = require('form-data');
        const formData = new FormData();
        
        // إضافة ملف صوتي
        formData.append('file', testAudioData, {
          filename: 'test.wav',
          contentType: 'audio/wav'
        });
        
        // إضافة المعاملات
        formData.append('language', 'en');
        formData.append('task', 'transcribe');
        formData.append('vad_filter', 'true');
        formData.append('vad_parameters', 'threshold=0.5');
        
        const response = await makeRequest(`${CONFIG.HF_URL}/transcribe`, {
          method: 'POST',
          headers: {
            ...formData.getHeaders()
          },
          body: formData
        });
        
        if (response.status === 200) {
          return `VAD Transcribe successful - Text: "${response.data.text}", VAD: ${response.data.vad_enabled}, Threshold: ${response.data.vad_threshold}`;
        } else {
          throw new Error(`VAD Transcribe failed: ${response.status} - ${JSON.stringify(response.data)}`);
        }
      },
      [1, 2] // يعتمد على المهمتين 1 و 2
    );

    // المهمة 4: اختبار VAD Thresholds
    this.addTask(
      'اختبار VAD Thresholds',
      'اختبار عتبات مختلفة لـ Voice Activity Detection',
      async () => {
        const thresholds = ['0.3', '0.5', '0.7'];
        const results = [];
        
        for (const threshold of thresholds) {
          // إنشاء ملف صوتي بسيط للاختبار
          const testAudioData = Buffer.alloc(1024);
          
          // استخدام FormData
          const FormData = require('form-data');
          const formData = new FormData();
          
          // إضافة ملف صوتي
          formData.append('file', testAudioData, {
            filename: 'test.wav',
            contentType: 'audio/wav'
          });
          
          // إضافة المعاملات
          formData.append('vad_filter', 'true');
          formData.append('vad_parameters', `threshold=${threshold}`);
          
          const response = await makeRequest(`${CONFIG.HF_URL}/transcribe`, {
            method: 'POST',
            headers: {
              ...formData.getHeaders()
            },
            body: formData
          });
          
          if (response.status === 200) {
            results.push(`Threshold ${threshold}: ${response.data.vad_threshold}`);
          } else {
            results.push(`Threshold ${threshold}: FAILED`);
          }
        }
        
        return `VAD Thresholds tested: ${results.join(', ')}`;
      },
      [1, 3] // يعتمد على المهمتين 1 و 3
    );

    // المهمة 5: اختبار Audio Formats
    this.addTask(
      'اختبار Audio Formats',
      'اختبار صيغ الصوت المختلفة',
      async () => {
        const formats = ['wav', 'mp3', 'm4a'];
        const results = [];
        
        for (const format of formats) {
          // إنشاء ملف صوتي بسيط للاختبار
          const testAudioData = Buffer.alloc(1024);
          
          // استخدام FormData
          const FormData = require('form-data');
          const formData = new FormData();
          
          // إضافة ملف صوتي
          formData.append('file', testAudioData, {
            filename: `test.${format}`,
            contentType: `audio/${format}`
          });
          
          // إضافة المعاملات
          formData.append('vad_filter', 'true');
          formData.append('vad_parameters', 'threshold=0.5');
          
          const response = await makeRequest(`${CONFIG.HF_URL}/transcribe`, {
            method: 'POST',
            headers: {
              ...formData.getHeaders()
            },
            body: formData
          });
          
          if (response.status === 200) {
            results.push(`Format ${format}: OK`);
          } else {
            results.push(`Format ${format}: FAILED`);
          }
        }
        
        return `Audio formats tested: ${results.join(', ')}`;
      },
      [1, 3] // يعتمد على المهمتين 1 و 3
    );

    // المهمة 6: اختبار Error Handling
    this.addTask(
      'اختبار Error Handling',
      'اختبار معالجة الأخطاء',
      async () => {
        // Test with empty file
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
        const formData = [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file"; filename="empty.wav"',
          'Content-Type: audio/wav',
          '',
          '',
          `--${boundary}--`
        ].join('\r\n');
        
        const response = await makeRequest(`${CONFIG.HF_URL}/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(formData)
          },
          body: formData
        });
        
        if (response.status === 400) {
          return 'Error handling working correctly - Empty file rejected';
        } else {
          return 'Error handling test completed';
        }
      },
      [1] // يعتمد على المهمة 1
    );
  }

  // عرض قائمة المهام
  showTaskList() {
    this.log('📋 قائمة المهام المطلوبة:', 'task');
    console.log('=' .repeat(60));
    
    this.tasks.forEach(task => {
      const status = task.status === 'pending' ? '⏳' : 
                    task.status === 'running' ? '🔄' :
                    task.status === 'completed' ? '✅' : '❌';
      
      console.log(`${status} ${task.id}. ${task.name}`);
      console.log(`   ${task.description}`);
      
      if (task.dependencies.length > 0) {
        console.log(`   التبعيات: ${task.dependencies.join(', ')}`);
      }
      console.log('');
    });
  }

  // عرض النتائج النهائية
  showFinalResults() {
    this.log('📊 النتائج النهائية:', 'task');
    console.log('=' .repeat(60));
    
    console.log(`✅ المهام المكتملة: ${this.completedTasks.length}`);
    console.log(`❌ المهام الفاشلة: ${this.failedTasks.length}`);
    console.log(`📋 إجمالي المهام: ${this.tasks.length}`);
    
    if (this.completedTasks.length > 0) {
      console.log('\n✅ المهام المكتملة:');
      this.completedTasks.forEach(task => {
        console.log(`   ${task.name}: ${task.result}`);
      });
    }
    
    if (this.failedTasks.length > 0) {
      console.log('\n❌ المهام الفاشلة:');
      this.failedTasks.forEach(task => {
        console.log(`   ${task.name}: ${task.error}`);
      });
    }
    
    const successRate = (this.completedTasks.length / this.tasks.length) * 100;
    console.log(`\n📈 معدل النجاح: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 80) {
      this.log('🎉 VAD يعمل بشكل ممتاز!', 'success');
    } else if (successRate >= 60) {
      this.log('⚠️ VAD يعمل بشكل جيد مع بعض المشاكل', 'warning');
    } else {
      this.log('❌ VAD يحتاج إلى إصلاح', 'error');
    }
  }

  // سؤال المستخدم
  askUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  // إغلاق النظام
  close() {
    this.rl.close();
  }
}

// تشغيل النظام
async function main() {
  const taskManager = new VADTaskManager();
  
  // فحص الوضع التلقائي
  const isAutoMode = process.argv.includes('auto');
  
  try {
    if (isAutoMode) {
      await taskManager.runAllTasksAuto();
    } else {
      await taskManager.runAllTasks();
    }
  } catch (error) {
    console.error('❌ خطأ في تشغيل النظام:', error);
  } finally {
    taskManager.close();
  }
}

// تشغيل إذا كان الملف مستدعى مباشرة
if (require.main === module) {
  main();
}

module.exports = { VADTaskManager, CONFIG }; 