# إرشادات الإصلاح الطارئ

## المشاكل الحالية:
1. **خطأ 500** في `rate_us_url` و `share_app_url`
2. **خطأ "Unexpected text node"** لا يزال موجوداً

## الحل الطارئ:

### 1. تنفيذ SQL الطارئ:

1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. اذهب إلى **SQL Editor**
4. انسخ محتوى `emergency_app_settings_fix.sql`
5. اضغط **Run**

### 2. التحقق من النتائج:

بعد تنفيذ SQL، يجب أن ترى:
- رسالة "Success" 
- جدول يحتوي على 8 صفوف من البيانات

### 3. إعادة تشغيل التطبيق:

```bash
# أوقف التطبيق الحالي (Ctrl+C)
# ثم أعد تشغيله
npx expo start --web
```

### 4. اختبار التطبيق:

1. افتح التطبيق في المتصفح
2. اذهب إلى صفحة الاشتراكات
3. افتح Developer Console
4. تحقق من عدم وجود أخطاء 500 أو 406

## إذا استمرت المشاكل:

### خيار 1: تعطيل RLS مؤقتاً
```sql
-- في Supabase SQL Editor
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
```

### خيار 2: إضافة سياسة عامة
```sql
-- في Supabase SQL Editor
CREATE POLICY "Allow all access to app_settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### خيار 3: التحقق من الجدول
```sql
-- في Supabase SQL Editor
SELECT * FROM app_settings;
```

## الملفات المحدثة:

1. **`emergency_app_settings_fix.sql`** - SQL طارئ
2. **`app/subscription.tsx`** - إصلاح \n في النص
3. **`EMERGENCY_FIX_INSTRUCTIONS.md`** - هذا الملف

## النتيجة المتوقعة:

بعد تطبيق هذا الإصلاح:
- ✅ عدم وجود أخطاء 500
- ✅ عدم وجود أخطاء "Unexpected text node"
- ✅ صفحة الاشتراكات تفتح بشكل صحيح
- ✅ جميع الوظائف تعمل

## إذا لم يعمل الإصلاح:

1. تحقق من أن SQL تم تنفيذه بنجاح
2. تأكد من وجود البيانات في الجدول
3. أعد تشغيل التطبيق بالكامل
4. امسح cache المتصفح 