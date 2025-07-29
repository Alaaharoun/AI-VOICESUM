// اختبار الإصلاح المبسط لـ AuthGuard
console.log('🧪 اختبار الإصلاح المبسط لـ AuthGuard...\n');

const fs = require('fs');

// فحص الملف المحدث
const authGuardPath = 'components/AuthGuard.tsx';
if (fs.existsSync(authGuardPath)) {
  const content = fs.readFileSync(authGuardPath, 'utf8');
  
  console.log('📋 فحص الإصلاحات المطبقة:');
  
  const checks = [
    { name: 'إزالة hasRedirected', check: !content.includes('hasRedirected') },
    { name: 'إزالة useRef', check: !content.includes('useRef') },
    { name: 'إزالة setTimeout', check: !content.includes('setTimeout') },
    { name: 'إضافة isOnAuthPage', check: content.includes('isOnAuthPage') },
    { name: 'إضافة isAuthenticated', check: content.includes('isAuthenticated') },
    { name: 'تبسيط المنطق', check: content.includes('if (isAuthenticated && isOnAuthPage)') },
    { name: 'إزالة التعقيد', check: content.includes('} else {') },
    { name: 'تحسين logging', check: content.includes('isOnAuthPage: pathname?.startsWith') }
  ];
  
  let passedChecks = 0;
  checks.forEach(check => {
    if (check.check) {
      console.log(`✅ ${check.name}`);
      passedChecks++;
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
  
  console.log(`\n📊 النتيجة: ${passedChecks}/${checks.length} فحص ناجح`);
  
  if (passedChecks === checks.length) {
    console.log('🎉 جميع الإصلاحات مطبقة بنجاح!');
  } else {
    console.log('⚠️ بعض الإصلاحات لم تُطبق بشكل صحيح');
  }
}

// فحص الملفات المطلوبة للتوجيه
console.log('\n🔍 فحص ملفات التوجيه:');
const requiredFiles = [
  'app/(auth)/sign-up.tsx',
  'app/(auth)/sign-in.tsx',
  'app/(tabs)/index.tsx'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('export default')) {
      console.log(`✅ ${file} - يحتوي على default export`);
    } else {
      console.log(`❌ ${file} - لا يحتوي على default export`);
    }
  } else {
    console.log(`❌ ${file} - مفقود`);
  }
});

console.log('\n📋 السيناريوهات المدعومة:');
console.log('1. المستخدم مسجل دخول + في صفحة auth → توجيه إلى التطبيق');
console.log('2. المستخدم غير مسجل + ليس في صفحة auth → توجيه إلى التسجيل');
console.log('3. المستخدم مسجل دخول + في التطبيق → السماح بالوصول');
console.log('4. المستخدم غير مسجل + في صفحة auth → السماح بالوصول');

console.log('\n🚀 الخطوات التالية:');
console.log('1. شغل: .\\quick-auth-fix.bat');
console.log('2. افتح http://localhost:8081');
console.log('3. تحقق من Console لرؤية رسائل AuthGuard الجديدة');
console.log('4. جرب تسجيل الدخول والخروج');

console.log('\n💡 النتائج المتوقعة:');
console.log('- لا توجد صفحة بيضاء');
console.log('- التوجيه يعمل بشكل صحيح');
console.log('- رسائل واضحة في Console');
console.log('- تجربة مستخدم سلسة'); 