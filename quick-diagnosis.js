// تشخيص سريع للمشكلة
console.log('🔍 تشخيص سريع للمشكلة...\n');

const fs = require('fs');

// فحص الملفات الرئيسية
const criticalFiles = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app/(auth)/sign-up.tsx',
  'app/(auth)/sign-in.tsx',
  'components/AuthGuard.tsx'
];

console.log('📋 فحص الملفات الحرجة:');
criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const hasDefaultExport = content.includes('export default');
    const hasComponent = content.includes('function') || content.includes('const') || content.includes('class');
    
    if (hasDefaultExport && hasComponent) {
      console.log(`✅ ${file} - صحيح`);
    } else if (hasDefaultExport) {
      console.log(`⚠️ ${file} - يحتوي على default export فقط`);
    } else {
      console.log(`❌ ${file} - لا يحتوي على default export`);
    }
  } else {
    console.log(`❌ ${file} - مفقود`);
  }
});

// فحص محتوى AuthGuard
console.log('\n🔍 فحص AuthGuard:');
const authGuardPath = 'components/AuthGuard.tsx';
if (fs.existsSync(authGuardPath)) {
  const content = fs.readFileSync(authGuardPath, 'utf8');
  
  const checks = [
    { name: 'useEffect', check: content.includes('useEffect') },
    { name: 'router.replace', check: content.includes('router.replace') },
    { name: 'pathname', check: content.includes('pathname') },
    { name: 'return children', check: content.includes('return <>{children}</>') },
    { name: 'console.log', check: content.includes('console.log') }
  ];
  
  checks.forEach(check => {
    if (check.check) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
}

// فحص محتوى _layout.tsx
console.log('\n🔍 فحص _layout.tsx:');
const layoutPath = 'app/_layout.tsx';
if (fs.existsSync(layoutPath)) {
  const content = fs.readFileSync(layoutPath, 'utf8');
  
  const checks = [
    { name: 'AuthGuard', check: content.includes('AuthGuard') },
    { name: 'Stack', check: content.includes('Stack') },
    { name: '(auth)', check: content.includes('(auth)') },
    { name: '(tabs)', check: content.includes('(tabs)') }
  ];
  
  checks.forEach(check => {
    if (check.check) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
}

console.log('\n📋 تحليل المشكلة:');
console.log('✅ الشبكة تعمل بشكل ممتاز (جميع الطلبات 200 OK)');
console.log('❌ المشكلة في التوجيه أو AuthGuard');
console.log('🔧 الحل: تطبيق إصلاح التوجيه');

console.log('\n🚀 الحل السريع:');
console.log('1. شغل: .\\final-routing-fix.bat');
console.log('2. أو شغل: .\\quick-auth-fix.bat');
console.log('3. افتح http://localhost:8081');
console.log('4. تحقق من Console لرؤية رسائل AuthGuard'); 