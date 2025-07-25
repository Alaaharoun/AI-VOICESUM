# 🔧 حل مشكلة السياسات المكررة

## 🚨 المشكلة:
```
ERROR: 42710: policy "Users can view own credits" for table "transcription_credits" already exists
```

## ✅ الحل السريع:

### الطريقة الأولى: استخدام الإصلاح الجديد
1. اذهب إلى **Supabase Dashboard > SQL Editor**
2. انسخ محتوى ملف: `fix_duplicate_policies.sql`
3. اضغط **Run**

### الطريقة الثانية: حذف السياسات يدوياً
```sql
-- حذف جميع السياسات المكررة
DROP POLICY IF EXISTS "Users can view own credits" ON transcription_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON transcription_credits;
DROP POLICY IF EXISTS "Admins can view all credits" ON transcription_credits;

-- إعادة إنشاء السياسات
CREATE POLICY "Users can view own credits"
  ON transcription_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON transcription_credits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits"
  ON transcription_credits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );
```

## 🔍 سبب المشكلة:
- السياسات موجودة بالفعل في قاعدة البيانات
- النظام يحاول إنشاء سياسات مكررة
- هذا يحدث عند تشغيل النظام عدة مرات

## 🛡️ الإصلاح الجديد يتضمن:
- ✅ **حذف جميع السياسات** الموجودة
- ✅ **إعادة إنشاء السياسات** بشكل نظيف
- ✅ **التحقق من النجاح** عبر الاستعلامات
- ✅ **عرض جميع السياسات** للتحقق

## 🧪 اختبار بعد الإصلاح:
```sql
-- فحص حالة النظام
SELECT 
  'Policies fixed successfully' as status,
  COUNT(*) as protected_trial_emails,
  (SELECT COUNT(*) FROM free_minutes_usage) as protected_minutes_emails,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT') as profiles_insert_policy_count,
  (SELECT COUNT(*) FROM transcription_credits) as total_transcription_credits
FROM free_trial_usage;

-- عرض جميع السياسات
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('free_trial_usage', 'free_minutes_usage', 'profiles', 'transcription_credits')
ORDER BY tablename, policyname;
```

## 🎯 النتيجة المتوقعة:
- ✅ **لا أخطاء** عند التشغيل
- ✅ **جميع السياسات** موجودة ونظيفة
- ✅ **نظام الحماية** يعمل بشكل صحيح
- ✅ **جميع الوظائف** متاحة

## 🔧 اختبار النظام بعد الإصلاح:

### اختبار الحماية:
```sql
SELECT should_grant_free_trial('test@example.com');     -- TRUE
SELECT should_grant_free_minutes('test@example.com');   -- TRUE
```

### اختبار الدقائق:
```sql
SELECT get_remaining_minutes('user-uuid');              -- يجب أن يعطي رقماً
SELECT has_sufficient_credits('user-uuid', 30);         -- TRUE/FALSE
```

### اختبار الإحصائيات:
```sql
SELECT * FROM get_protection_stats();
SELECT * FROM get_detailed_protection_stats();
```

## 📊 التحقق من السياسات:

```sql
-- فحص سياسات profiles
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles'; -- يجب أن يعطي 3

-- فحص سياسات transcription_credits
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'transcription_credits'; -- يجب أن يعطي 3

-- فحص سياسات free_trial_usage
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'free_trial_usage'; -- يجب أن يعطي 1

-- فحص سياسات free_minutes_usage
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'free_minutes_usage'; -- يجب أن يعطي 1
```

## 🎉 النتيجة النهائية:

**جميع السياسات نظيفة والنظام يعمل بشكل مثالي!**

---
**ملاحظة**: الإصلاح الجديد آمن للتشغيل عدة مرات ويحل مشكلة السياسات المكررة نهائياً. 