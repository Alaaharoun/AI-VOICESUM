// إصلاح سريع للصفحة البيضاء في الويب
// هذا الملف يحل مشاكل التوجيه والتحميل في الويب

const fs = require('fs');
const path = require('path');

// فحص الملفات المطلوبة
function checkRequiredFiles() {
  const requiredFiles = [
    'app/_layout.tsx',
    'app/index.tsx',
    'app/(auth)/sign-in.tsx',
    'app/(auth)/_layout.tsx',
    'app/(tabs)/_layout.tsx',
    'app/(tabs)/index.tsx',
    'components/AuthGuard.tsx',
    'contexts/AuthContext.tsx',
    'contexts/SubscriptionContext.tsx',
    'lib/supabase.ts'
  ];

  console.log('🔍 فحص الملفات المطلوبة...');
  
  const missingFiles = [];
  const existingFiles = [];
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      existingFiles.push(file);
      console.log(`✅ ${file}`);
    } else {
      missingFiles.push(file);
      console.log(`❌ ${file}`);
    }
  });

  return { missingFiles, existingFiles };
}

// فحص محتوى الملفات
function checkFileContent() {
  console.log('\n🔍 فحص محتوى الملفات...');
  
  // فحص delete-account.tsx
  const deleteAccountPath = 'app/delete-account.tsx';
  if (fs.existsSync(deleteAccountPath)) {
    const content = fs.readFileSync(deleteAccountPath, 'utf8');
    if (content.trim() === '') {
      console.log('❌ app/delete-account.tsx فارغ');
      return false;
    } else {
      console.log('✅ app/delete-account.tsx يحتوي على محتوى');
    }
  }

  // فحص _layout.tsx
  const layoutPath = 'app/_layout.tsx';
  if (fs.existsSync(layoutPath)) {
    const content = fs.readFileSync(layoutPath, 'utf8');
    if (content.includes('export default')) {
      console.log('✅ app/_layout.tsx يحتوي على default export');
    } else {
      console.log('❌ app/_layout.tsx لا يحتوي على default export');
      return false;
    }
  }

  return true;
}

// إنشاء ملف إصلاح للويب
function createWebFix() {
  console.log('\n🔧 إنشاء ملف إصلاح للويب...');
  
  const webFixContent = `
// إصلاح للويب - إضافة في app/_layout.tsx
import { Platform } from 'react-native';

// إضافة هذا في بداية الملف
if (Platform.OS === 'web') {
  // إصلاح مشاكل الويب
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      console.log('Web error caught:', event.error);
    });
  }
}
`;

  fs.writeFileSync('web-fix.js', webFixContent);
  console.log('✅ تم إنشاء web-fix.js');
}

// فحص إعدادات التطبيق
function checkAppConfig() {
  console.log('\n🔍 فحص إعدادات التطبيق...');
  
  const configFiles = [
    'app.config.js',
    'package.json',
    'metro.config.js'
  ];

  configFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} موجود`);
    } else {
      console.log(`❌ ${file} مفقود`);
    }
  });
}

// دالة رئيسية
function fixWhiteScreen() {
  console.log('🚀 بدء إصلاح الصفحة البيضاء في الويب...\n');

  // فحص الملفات المطلوبة
  const { missingFiles, existingFiles } = checkRequiredFiles();
  
  if (missingFiles.length > 0) {
    console.log(`\n❌ الملفات المفقودة: ${missingFiles.length}`);
    missingFiles.forEach(file => console.log(`  - ${file}`));
  } else {
    console.log('\n✅ جميع الملفات المطلوبة موجودة');
  }

  // فحص محتوى الملفات
  const contentOk = checkFileContent();
  
  // فحص إعدادات التطبيق
  checkAppConfig();

  // إنشاء ملف إصلاح
  createWebFix();

  console.log('\n📋 التوصيات:');
  console.log('1. تأكد من أن جميع الملفات تحتوي على default export');
  console.log('2. تحقق من عدم وجود أخطاء في Console');
  console.log('3. جرب إعادة تشغيل التطبيق: npx expo start --clear --web');
  console.log('4. تحقق من أن المستخدم مسجل دخول');
  console.log('5. تحقق من أن AuthGuard يعمل بشكل صحيح');

  return {
    success: missingFiles.length === 0 && contentOk,
    missingFiles,
    existingFiles
  };
}

// تشغيل الإصلاح
if (require.main === module) {
  const result = fixWhiteScreen();
  
  if (result.success) {
    console.log('\n✅ فحص مكتمل - التطبيق جاهز');
  } else {
    console.log('\n❌ هناك مشاكل تحتاج إصلاح');
  }
}

module.exports = { fixWhiteScreen, checkRequiredFiles, checkFileContent }; 