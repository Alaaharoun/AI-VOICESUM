# إصلاح مشكلة صفحة الاشتراكات - الإصدار 2

## المشاكل الجديدة التي ظهرت:

### 1. خطأ SQL: عمود `description` غير موجود
**الخطأ:** `ERROR: 42703: column "description" of relation "app_settings" does not exist`

### 2. خطأ "Unexpected text node"
**الخطأ:** `Unexpected text node: . A text node cannot be a child of a <View>`

### 3. خطأ 406 مستمر
**الخطأ:** `Failed to load resource: the server responded with a status of 406`

## الحلول:

### 1. إصلاح جدول app_settings:

**استخدم الملف الجديد:** `create_app_settings_table_fixed.sql`

هذا الملف:
- يحذف الجدول القديم إذا كان موجوداً
- ينشئ الجدول بدون عمود `description`
- يضيف البيانات الافتراضية

**خطوات التنفيذ:**
1. اذهب إلى Supabase Dashboard
2. افتح SQL Editor
3. انسخ محتوى `create_app_settings_table_fixed.sql`
4. اضغط Run

### 2. إصلاح "Unexpected text node":

**المشكلة:** استخدام `{'\n'}` داخل مكون `Text`

**الحل:** تقسيم النص إلى عدة مكونات `Text` منفصلة

**التغيير:**
```tsx
// قبل (يسبب خطأ)
<Text>
  النص الأول{'\n'}
  النص الثاني{'\n'}
  النص الثالث
</Text>

// بعد (مصحح)
<Text>النص الأول</Text>
<Text>النص الثاني</Text>
<Text>النص الثالث</Text>
```

### 3. التحقق من الإصلاح:

1. **تنفيذ SQL الجديد** في Supabase Dashboard
2. **إعادة تشغيل التطبيق:**
   ```bash
   npx expo start --web
   ```
3. **فتح Developer Console** والتحقق من:
   - عدم وجود أخطاء 406
   - عدم وجود أخطاء "Unexpected text node"
   - تحميل صفحة الاشتراكات بشكل صحيح

### 4. الملفات المحدثة:

- `create_app_settings_table_fixed.sql` - SQL مصحح بدون عمود description
- `app/subscription.tsx` - إصلاح مشكلة النص العادي
- `SUBSCRIPTION_PAGE_FIX_V2.md` - هذا الملف

### 5. النتيجة المتوقعة:

بعد تطبيق هذه الإصلاحات:
- ✅ صفحة الاشتراكات تفتح بدون أخطاء
- ✅ لا توجد أخطاء 406 في Console
- ✅ لا توجد أخطاء "Unexpected text node"
- ✅ جميع خطط الاشتراك تظهر بشكل صحيح
- ✅ وظائف التجربة المجانية والشراء تعمل

### 6. إذا استمرت المشاكل:

1. تحقق من إعدادات RLS في Supabase
2. تأكد من أن المستخدم لديه صلاحيات مناسبة
3. تحقق من متغيرات البيئة (Environment Variables)
4. أعد تشغيل التطبيق بالكامل 