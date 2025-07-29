# 🔧 إصلاح مشكلة الصفحة البيضاء في الويب

## 🚨 المشكلة
التطبيق يعمل على الموبايل لكن في الويب تظهر صفحة بيضاء بعد شعار التحميل ولا تظهر صفحة التسجيل.

## 🔍 السبب
خطأ 406 (Not Acceptable) في طلبات Supabase إلى جدول `user_subscriptions` بسبب:
- مشاكل في هيكل قاعدة البيانات
- سياسات أمنية غير صحيحة
- إعدادات WebSocket مشكلة

## ✅ الحل السريع

### الخطوة 1: إصلاح قاعدة البيانات
1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. اذهب إلى **SQL Editor**
4. انسخ محتوى ملف `fix_web_white_screen.sql`
5. الصق الكود واضغط **Run**

### الخطوة 2: اختبار الإصلاح
```bash
# تشغيل اختبار الاتصال
node fix_web_connection.js
```

### الخطوة 3: إعادة تشغيل التطبيق
```bash
# إيقاف الخادم الحالي (Ctrl+C)
# إعادة تشغيل
npx expo start --web
```

## 📋 ما يفعله الإصلاح

### 1. إصلاح قاعدة البيانات:
- ✅ إعادة إنشاء جدول `user_subscriptions` بالهيكل الصحيح
- ✅ إزالة العلاقات المشكلة بين الجداول
- ✅ إعادة إنشاء السياسات الأمنية (RLS)
- ✅ إنشاء جدول `app_settings` إذا لم يكن موجوداً
- ✅ إضافة إعدادات افتراضية

### 2. إصلاح الاتصال:
- ✅ تحسين headers الطلبات
- ✅ إصلاح إعدادات WebSocket
- ✅ تحديث المحرك الافتراضي إلى Hugging Face

## 🧪 اختبار الإصلاح

### 1. فتح وحدة التحكم (Console):
- اضغط F12 في المتصفح
- اذهب إلى تبويب Console
- تأكد من عدم وجود أخطاء 406

### 2. الرسائل المتوقعة:
```
✅ [INFO] [EarlyConnection] Hugging Face connection established
✅ [INFO] [EarlyConnection] Early connections initialized successfully
✅ [Index] Hugging Face engine detected - WebSocket not needed
```

### 3. إذا استمرت المشكلة:
```bash
# تنظيف الكاش
npx expo start --clear --web

# أو إعادة تثبيت الحزم
npm install
npx expo start --web
```

## 🔧 إصلاحات إضافية

### إذا لم يعمل الإصلاح الأساسي:

#### 1. فحص متغيرات البيئة:
```bash
# تأكد من وجود ملف .env
cat .env

# يجب أن يحتوي على:
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

#### 2. إصلاح WebSocket:
```javascript
// في lib/supabase.ts
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
});
```

#### 3. إصلاح المحرك الافتراضي:
```javascript
// في services/transcriptionEngineService.ts
export async function getTranscriptionEngine(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'transcription_engine')
      .single();
    
    if (error || !data?.value) {
      return 'huggingface'; // Default to Hugging Face
    }
    
    return data.value;
  } catch (error) {
    console.warn('Error getting transcription engine, defaulting to Hugging Face:', error);
    return 'huggingface';
  }
}
```

## 📞 إذا استمرت المشكلة

### 1. فحص السجلات:
- اذهب إلى Supabase Dashboard > Logs
- ابحث عن أخطاء 406 أو 500

### 2. اختبار الاتصال:
```bash
# تشغيل اختبار شامل
node fix_web_connection.js
```

### 3. إعادة إنشاء الجداول:
```sql
-- في Supabase SQL Editor
DROP TABLE IF EXISTS user_subscriptions CASCADE;
-- ثم تشغيل fix_web_white_screen.sql مرة أخرى
```

## ✅ النتيجة المتوقعة

بعد تطبيق الإصلاح:
- ✅ صفحة التسجيل تظهر في الويب
- ✅ لا توجد أخطاء 406 في Console
- ✅ الاتصال بـ Supabase يعمل بشكل صحيح
- ✅ المحرك الافتراضي هو Hugging Face

## 🎯 ملاحظات مهمة

1. **التطبيق يعمل على الموبايل**: المشكلة فقط في الويب
2. **Hugging Face محرك افتراضي**: أكثر استقراراً من Azure
3. **WebSocket غير مطلوب**: للويب مع Hugging Face
4. **Headers محسنة**: لضمان توافق الطلبات

## 📱 للتحقق من الإصلاح

1. افتح المتصفح على `localhost:8081`
2. تأكد من ظهور صفحة التسجيل
3. تحقق من Console للتأكد من عدم وجود أخطاء
4. جرب تسجيل الدخول للتأكد من عمل المصادقة 