const fetch = require('node-fetch');

// اختبار السيرفر على Render
async function testRenderServer() {
  const baseUrl = 'https://ai-voicesum.onrender.com';
  
  console.log('🚀 اختبار السيرفر على Render...\n');
  
  // اختبار 1: Health Check
  try {
    console.log('🏥 اختبار Health Check...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    
    console.log('📊 حالة الاستجابة:', healthResponse.status);
    console.log('📝 النتيجة:', healthData);
    
    if (healthResponse.ok) {
      console.log('✅ Health Check يعمل!\n');
    } else {
      console.log('❌ مشكلة في Health Check\n');
    }
  } catch (error) {
    console.error('💥 خطأ في Health Check:', error.message, '\n');
  }
  
  // اختبار 2: صفحة حذف الحساب
  try {
    console.log('🌐 اختبار صفحة حذف الحساب...');
    const pageResponse = await fetch(`${baseUrl}/simple-delete-account.html`);
    
    console.log('📊 حالة الاستجابة:', pageResponse.status);
    
    if (pageResponse.ok) {
      const html = await pageResponse.text();
      console.log('✅ الصفحة متاحة!');
      console.log('📄 حجم الصفحة:', html.length, 'حرف');
      console.log('🔍 يحتوي على "Delete Account":', html.includes('Delete Account'));
      console.log('🔍 يحتوي على "AI LIVE TRANSLATE":', html.includes('AI LIVE TRANSLATE'));
    } else {
      console.log('❌ الصفحة غير متاحة');
      console.log('📝 رسالة الخطأ:', pageResponse.statusText);
    }
    console.log('');
  } catch (error) {
    console.error('💥 خطأ في الوصول للصفحة:', error.message, '\n');
  }
  
  // اختبار 3: API حذف الحساب (اختبار بدون بيانات صحيحة)
  try {
    console.log('🔍 اختبار API حذف الحساب...');
    const apiResponse = await fetch(`${baseUrl}/api/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrongpassword'
      })
    });
    
    const apiData = await apiResponse.json();
    
    console.log('📊 حالة الاستجابة:', apiResponse.status);
    console.log('📝 النتيجة:', apiData);
    
    if (apiResponse.status === 401) {
      console.log('✅ API يعمل (خطأ 401 متوقع للبيانات الخاطئة)');
    } else if (apiResponse.ok) {
      console.log('✅ API يعمل');
    } else {
      console.log('❌ مشكلة في API');
    }
    console.log('');
  } catch (error) {
    console.error('💥 خطأ في API:', error.message, '\n');
  }
  
  // اختبار 4: صفحة غير موجودة
  try {
    console.log('🔍 اختبار صفحة غير موجودة...');
    const notFoundResponse = await fetch(`${baseUrl}/not-found-page`);
    
    console.log('📊 حالة الاستجابة:', notFoundResponse.status);
    
    if (notFoundResponse.status === 404) {
      console.log('✅ السيرفر يعيد 404 للصفحات غير الموجودة (متوقع)');
    } else {
      console.log('❌ السيرفر لا يعيد 404 للصفحات غير الموجودة');
    }
    console.log('');
  } catch (error) {
    console.error('💥 خطأ في اختبار الصفحة غير الموجودة:', error.message, '\n');
  }
}

// اختبار محلي
async function testLocalServer() {
  const baseUrl = 'http://localhost:10000';
  
  console.log('🚀 اختبار السيرفر المحلي...\n');
  
  try {
    console.log('🏥 اختبار Health Check المحلي...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    
    console.log('📊 حالة الاستجابة:', healthResponse.status);
    console.log('📝 النتيجة:', healthData);
    
    if (healthResponse.ok) {
      console.log('✅ Health Check المحلي يعمل!\n');
    } else {
      console.log('❌ مشكلة في Health Check المحلي\n');
    }
  } catch (error) {
    console.error('💥 خطأ في Health Check المحلي:', error.message, '\n');
  }
}

// تشغيل الاختبارات
async function runTests() {
  console.log('🧪 بدء اختبارات السيرفر...\n');
  
  // اختبار السيرفر المحلي أولاً
  await testLocalServer();
  
  console.log('='.repeat(50));
  console.log('');
  
  // اختبار السيرفر على Render
  await testRenderServer();
  
  console.log('✨ انتهت الاختبارات!');
}

// تشغيل الاختبارات إذا تم تشغيل الملف مباشرة
if (require.main === module) {
  runTests();
}

module.exports = {
  testRenderServer,
  testLocalServer,
  runTests
}; 