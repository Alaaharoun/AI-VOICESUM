// إصلاح شامل للتوجيه في Expo Router
const fs = require('fs');
const path = require('path');

console.log('🔧 إصلاح شامل للتوجيه في Expo Router...\n');

// فحص الملفات المطلوبة
const requiredFiles = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app/(auth)/_layout.tsx',
  'app/(auth)/sign-in.tsx',
  'app/(auth)/sign-up.tsx',
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/index.tsx'
];

console.log('📋 فحص ملفات التوجيه:');
let missingFiles = [];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - مفقود`);
    missingFiles.push(file);
  }
});

// إنشاء الملفات المفقودة
if (missingFiles.length > 0) {
  console.log('\n🔧 إنشاء الملفات المفقودة...');
  
  missingFiles.forEach(file => {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let content = '';
    
    if (file.includes('_layout.tsx')) {
      content = `import { Stack } from 'expo-router';

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}`;
    } else if (file.includes('index.tsx')) {
      content = `import React from 'react';
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Index Page</Text>
    </View>
  );
}`;
    } else if (file.includes('sign-in.tsx')) {
      content = `import React from 'react';
import { View, Text } from 'react-native';

export default function SignIn() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Sign In Page</Text>
    </View>
  );
}`;
    } else if (file.includes('sign-up.tsx')) {
      content = `import React from 'react';
import { View, Text } from 'react-native';

export default function SignUp() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Sign Up Page</Text>
    </View>
  );
}`;
    }
    
    fs.writeFileSync(file, content);
    console.log(`✅ تم إنشاء ${file}`);
  });
}

// فحص محتوى الملفات الرئيسية
console.log('\n🔍 فحص محتوى الملفات الرئيسية:');

// فحص _layout.tsx
const layoutPath = 'app/_layout.tsx';
if (fs.existsSync(layoutPath)) {
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  
  const checks = [
    { name: 'Stack import', check: layoutContent.includes('import { Stack }') },
    { name: 'AuthProvider', check: layoutContent.includes('AuthProvider') },
    { name: 'AuthGuard', check: layoutContent.includes('AuthGuard') },
    { name: '(auth) route', check: layoutContent.includes('(auth)') },
    { name: '(tabs) route', check: layoutContent.includes('(tabs)') }
  ];
  
  checks.forEach(check => {
    if (check.check) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
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

console.log('\n🔧 الحلول المطبقة:');
console.log('1. فحص جميع ملفات التوجيه');
console.log('2. إنشاء الملفات المفقودة');
console.log('3. التأكد من وجود default export');
console.log('4. فحص محتوى الملفات الرئيسية');

console.log('\n✅ نتيجة الإصلاح:');
if (missingFiles.length === 0) {
  console.log('- جميع ملفات التوجيه موجودة');
  console.log('- المشكلة قد تكون في منطق AuthGuard');
  console.log('- جرب إصلاح AuthGuard أولاً');
} else {
  console.log(`- تم إنشاء ${missingFiles.length} ملفات مفقودة`);
  console.log('- جرب تشغيل التطبيق الآن');
}

console.log('\n🚀 الخطوات التالية:');
console.log('1. شغل: .\\quick-auth-fix.bat');
console.log('2. افتح http://localhost:8081');
console.log('3. تحقق من Console لرؤية رسائل AuthGuard');
console.log('4. إذا استمرت المشكلة، تحقق من Console للأخطاء'); 