#!/usr/bin/env node

/**
 * 📊 سكريبت مراقبة حالة الخادم
 * 
 * هذا السكريبت يراقب حالة خادم Hugging Face للتأكد من أن الإصلاحات تم تطبيقها
 */

class ServerMonitor {
  constructor() {
    this.baseUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
    this.maxRetries = 10;
    this.retryDelay = 30000; // 30 seconds
  }

  async monitor() {
    console.log('📊 بدء مراقبة حالة الخادم...');
    console.log('');

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`🔄 محاولة ${attempt}/${this.maxRetries}...`);
      
      try {
        const isHealthy = await this.checkServerHealth();
        
        if (isHealthy) {
          console.log('✅ الخادم يعمل بشكل صحيح!');
          console.log('');
          console.log('🎉 الإصلاحات تم تطبيقها بنجاح!');
          console.log('');
          console.log('📱 يمكنك الآن استخدام التطبيق:');
          console.log('   1. افتح التطبيق في المتصفح');
          console.log('   2. اختر اللغة المطلوبة');
          console.log('   3. اضغط على زر التسجيل وابدأ بالكلام');
          console.log('   4. التطبيق سيعمل بدون أخطاء traceback');
          return;
        } else {
          console.log('⚠️ الخادم لا يزال في حالة البناء...');
        }
        
      } catch (error) {
        console.log(`❌ خطأ في المحاولة ${attempt}: ${error.message}`);
      }
      
      if (attempt < this.maxRetries) {
        console.log(`⏳ انتظار ${this.retryDelay / 1000} ثانية قبل المحاولة التالية...`);
        await this.sleep(this.retryDelay);
      }
    }
    
    console.log('');
    console.log('⚠️ انتهت جميع المحاولات. الخادم قد يحتاج وقتاً أطول للبناء.');
    console.log('💡 تحقق من حالة البناء في Hugging Face Spaces يدوياً.');
  }

  async checkServerHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      if (response.ok && data.status === 'healthy' && data.model_loaded) {
        console.log('  ✅ Health Check نجح');
        console.log(`  📊 الحالة: ${data.status}`);
        console.log(`  🤖 النموذج: ${data.model_loaded ? 'محمل' : 'غير محمل'}`);
        console.log(`  🔧 الخدمة: ${data.service}`);
        return true;
      } else {
        console.log('  ❌ Health Check فشل');
        console.log(`  📊 البيانات:`, data);
        return false;
      }
    } catch (error) {
      console.log('  ❌ فشل في الاتصال بالخادم');
      return false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// تشغيل المراقبة
async function main() {
  const monitor = new ServerMonitor();
  await monitor.monitor();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ServerMonitor; 