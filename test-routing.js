// اختبار التوجيه في Expo Router
console.log('🔧 اختبار التوجيه في Expo Router...');

// فحص الملفات المطلوبة للتوجيه
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app/(auth)/_layout.tsx',
  'app/(auth)/sign-in.tsx',
  'app/(auth)/sign-up.tsx',
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/index.tsx'
];

console.log('\n📋 فحص ملفات التوجيه:');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}`);
    allFilesExist = false;
  }
});

// فحص محتوى الملفات الرئيسية
console.log('\n🔍 فحص محتوى الملفات الرئيسية:');

// فحص _layout.tsx
const layoutPath = 'app/_layout.tsx';
if (fs.existsSync(layoutPath)) {
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  if (layoutContent.includes('Stack')) {
    console.log('✅ app/_layout.tsx يحتوي على Stack');
  } else {
    console.log('❌ app/_layout.tsx لا يحتوي على Stack');
  }
  
  if (layoutContent.includes('(auth)')) {
    console.log('✅ app/_layout.tsx يحتوي على (auth) route');
  } else {
    console.log('❌ app/_layout.tsx لا يحتوي على (auth) route');
  }
  
  if (layoutContent.includes('(tabs)')) {
    console.log('✅ app/_layout.tsx يحتوي على (tabs) route');
  } else {
    console.log('❌ app/_layout.tsx لا يحتوي على (tabs) route');
  }
}

// فحص index.tsx
const indexPath = 'app/index.tsx';
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  if (indexContent.includes('export default')) {
    console.log('✅ app/index.tsx يحتوي على default export');
  } else {
    console.log('❌ app/index.tsx لا يحتوي على default export');
  }
}

// فحص sign-in.tsx
const signInPath = 'app/(auth)/sign-in.tsx';
if (fs.existsSync(signInPath)) {
  const signInContent = fs.readFileSync(signInPath, 'utf8');
  if (signInContent.includes('export default')) {
    console.log('✅ app/(auth)/sign-in.tsx يحتوي على default export');
  } else {
    console.log('❌ app/(auth)/sign-in.tsx لا يحتوي على default export');
  }
}

// فحص sign-up.tsx
const signUpPath = 'app/(auth)/sign-up.tsx';
if (fs.existsSync(signUpPath)) {
  const signUpContent = fs.readFileSync(signUpPath, 'utf8');
  if (signUpContent.includes('export default')) {
    console.log('✅ app/(auth)/sign-up.tsx يحتوي على default export');
  } else {
    console.log('❌ app/(auth)/sign-up.tsx لا يحتوي على default export');
  }
}

console.log('\n📋 تحليل المشكلة:');
console.log('1. التطبيق يستخدم Expo Router وليس React Router');
console.log('2. Expo Router لا يحتاج إلى BrowserRouter');
console.log('3. المشكلة قد تكون في AuthGuard أو في منطق التوجيه');

console.log('\n🔧 الحلول المقترحة:');
console.log('1. تأكد من أن جميع الملفات تحتوي على default export');
console.log('2. تحقق من أن AuthGuard لا يمنع التوجيه');
console.log('3. تأكد من أن Stack routes معرفة بشكل صحيح');
console.log('4. تحقق من Console للأخطاء');

console.log('\n✅ نتيجة الفحص:');
if (allFilesExist) {
  console.log('- جميع ملفات التوجيه موجودة');
  console.log('- المشكلة قد تكون في منطق AuthGuard');
  console.log('- جرب إصلاح AuthGuard أولاً');
} else {
  console.log('- بعض ملفات التوجيه مفقودة');
  console.log('- يجب إنشاء الملفات المفقودة');
}

console.log('\n🚀 الخطوات التالية:');
console.log('1. شغل: .\\quick-auth-fix.bat');
console.log('2. افتح http://localhost:8081');
console.log('3. تحقق من Console لرؤية رسائل AuthGuard'); 