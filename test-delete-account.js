const fetch = require('node-fetch');

// اختبار endpoint حذف الحساب
async function testDeleteAccount() {
  const testData = {
    email: 'test@example.com',
    password: 'testpassword123'
  };

  try {
    console.log('🔍 اختبار endpoint حذف الحساب...');
    
    const response = await fetch('http://localhost:10000/api/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('📊 حالة الاستجابة:', response.status);
    console.log('📝 النتيجة:', result);
    
    if (response.ok) {
      console.log('✅ الاختبار نجح!');
    } else {
      console.log('❌ الاختبار فشل:', result.error);
    }
    
  } catch (error) {
    console.error('💥 خطأ في الاختبار:', error.message);
  }
}

// اختبار الوصول للصفحة
async function testPageAccess() {
  try {
    console.log('\n🌐 اختبار الوصول لصفحة حذف الحساب...');
    
    const response = await fetch('http://localhost:10000/simple-delete-account.html');
    
    console.log('📊 حالة الاستجابة:', response.status);
    
    if (response.ok) {
      console.log('✅ الصفحة متاحة!');
      const html = await response.text();
      console.log('📄 حجم الصفحة:', html.length, 'حرف');
    } else {
      console.log('❌ الصفحة غير متاحة');
    }
    
  } catch (error) {
    console.error('💥 خطأ في الوصول للصفحة:', error.message);
  }
}

// اختبار health check
async function testHealthCheck() {
  try {
    console.log('\n🏥 اختبار health check...');
    
    const response = await fetch('http://localhost:10000/health');
    const result = await response.json();
    
    console.log('📊 حالة الاستجابة:', response.status);
    console.log('📝 النتيجة:', result);
    
    if (response.ok) {
      console.log('✅ السيرفر يعمل بشكل صحيح!');
    } else {
      console.log('❌ مشكلة في السيرفر');
    }
    
  } catch (error) {
    console.error('💥 خطأ في health check:', error.message);
  }
}

// تشغيل جميع الاختبارات
async function runAllTests() {
  console.log('🚀 بدء اختبارات نظام حذف الحساب...\n');
  
  await testHealthCheck();
  await testPageAccess();
  await testDeleteAccount();
  
  console.log('\n✨ انتهت الاختبارات!');
}

// تشغيل الاختبارات إذا تم تشغيل الملف مباشرة
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testDeleteAccount,
  testPageAccess,
  testHealthCheck,
  runAllTests
}; 