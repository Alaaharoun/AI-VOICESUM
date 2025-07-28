# 🔧 إصلاح مشكلة RLS في App Settings

## 🚨 المشكلة
عند الضغط على "Save Engine Setting" في صفحة الإدارة، يظهر خطأ:
```
new row violates row-level security policy for table "app_settings"
```

## 🛠️ الحل السريع

### الخطوة 1: تنفيذ SQL الإصلاح

1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. اذهب إلى **SQL Editor**
4. انسخ محتوى ملف `fix_app_settings_rls.sql`
5. اضغط **Run**

### الخطوة 2: التحقق من الإصلاح

بعد تنفيذ SQL، يجب أن ترى:
- ✅ رسالة "Success"
- ✅ جدول يحتوي على إعداد `transcription_engine`
- ✅ سياسات RLS جديدة

### الخطوة 3: اختبار الإصلاح

```bash
# تشغيل اختبار الإصلاح
node test_app_settings_fix.js
```

## 📋 ما يفعله الإصلاح

### 1. حذف السياسات القديمة
- يحذف جميع سياسات RLS القديمة على `app_settings`
- يبدأ من جديد لتجنب التعارضات

### 2. إنشاء سياسات جديدة
- **سياسة القراءة**: جميع المستخدمين المصادق عليهم يمكنهم القراءة
- **سياسة الكتابة**: فقط superadmins يمكنهم الكتابة

### 3. إضافة الإعداد المفقود
- يضيف `transcription_engine` إذا لم يكن موجوداً
- القيمة الافتراضية: `azure`

## 🔍 التحقق من الإصلاح

### في التطبيق:
1. اذهب إلى صفحة الإدارة
2. اختر تبويب "Settings"
3. جرب التبديل بين Azure و Faster Whisper
4. اضغط "Save Engine Setting"
5. يجب أن يعمل بدون أخطاء

### في قاعدة البيانات:
```sql
-- التحقق من وجود الإعداد
SELECT * FROM app_settings WHERE key = 'transcription_engine';

-- التحقق من السياسات
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'app_settings';
```

## 🚨 إذا استمرت المشكلة

### الخيار 1: تعطيل RLS مؤقتاً
```sql
-- في Supabase SQL Editor
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
```

### الخيار 2: إضافة سياسة عامة
```sql
-- في Supabase SQL Editor
CREATE POLICY "Allow all access to app_settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

## 📊 النتيجة المتوقعة

بعد تطبيق الإصلاح:
- ✅ زر "Save Engine Setting" يعمل بدون أخطاء
- ✅ يمكن التبديل بين Azure و Faster Whisper
- ✅ الإعدادات تُحفظ في قاعدة البيانات
- ✅ مؤشر الحالة يعمل بشكل صحيح

## 🔒 الأمان

الإصلاح يحافظ على الأمان:
- **القراءة**: متاحة لجميع المستخدمين المصادق عليهم
- **الكتابة**: متاحة فقط لـ superadmins
- **التحقق**: يتم التحقق من دور المستخدم قبل السماح بالكتابة 