# 🔧 حل مشكلة الجداول المفقودة

## 🚨 المشكلة:
```
ERROR: 42P01: relation "free_minutes_usage" does not exist
```

## ✅ الحل السريع:

### الطريقة الأولى: استخدام الإصلاح الجديد
1. اذهب إلى **Supabase Dashboard > SQL Editor**
2. انسخ محتوى ملف: `create_missing_tables.sql`
3. اضغط **Run**

### الطريقة الثانية: إنشاء الجداول يدوياً
```sql
-- إنشاء جدول free_trial_usage
CREATE TABLE IF NOT EXISTS free_trial_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_used_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إنشاء جدول free_minutes_usage
CREATE TABLE IF NOT EXISTS free_minutes_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_granted_at timestamptz DEFAULT now(),
  last_granted_at timestamptz DEFAULT now(),
  grant_count integer DEFAULT 1,
  total_minutes_granted integer DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE free_trial_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_minutes_usage ENABLE ROW LEVEL SECURITY;
```

## 🔍 سبب المشكلة:
- الجداول `free_trial_usage` و `free_minutes_usage` غير موجودة
- النظام لم يتم تطبيقه بالكامل
- الاستعلام يحاول الوصول لجداول غير موجودة

## 🛡️ الإصلاح الجديد يتضمن:
- ✅ **إنشاء جميع الجداول** المفقودة
- ✅ **تفعيل RLS** على الجداول
- ✅ **إنشاء السياسات** المطلوبة
- ✅ **إنشاء جميع الدوال** والمشغلات
- ✅ **منح الصلاحيات** المطلوبة
- ✅ **إنشاء الفهارس** للأداء

## 🧪 اختبار بعد الإصلاح:
```sql
-- اختبار وجود الجداول
SELECT COUNT(*) FROM free_trial_usage;      -- يجب أن يعطي 0
SELECT COUNT(*) FROM free_minutes_usage;    -- يجب أن يعطي 0

-- اختبار النظام
SELECT should_grant_free_trial('test@example.com');     -- TRUE
SELECT should_grant_free_minutes('test@example.com');   -- TRUE

-- تسجيل الاستخدام
SELECT record_free_trial_usage('test@example.com');
SELECT record_free_minutes_usage('test@example.com', 15);

-- اختبار مرة أخرى
SELECT should_grant_free_trial('test@example.com');     -- FALSE
SELECT should_grant_free_minutes('test@example.com');   -- FALSE
```

## 📊 التحقق من النجاح:
```sql
-- فحص حالة النظام
SELECT 
  'Complete protection system activated successfully' as status,
  COUNT(*) as protected_trial_emails,
  (SELECT COUNT(*) FROM free_minutes_usage) as protected_minutes_emails,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT') as profiles_insert_policy_count
FROM free_trial_usage;
```

## 🎯 النتيجة المتوقعة:
- ✅ **لا أخطاء** عند التشغيل
- ✅ **جميع الجداول** موجودة
- ✅ **جميع السياسات** تعمل بشكل صحيح
- ✅ **نظام الحماية** مفعل بالكامل
- ✅ **صلاحيات الأدمن** متاحة

## 🔧 صلاحيات الأدمن بعد الإصلاح:
```sql
-- منح دقائق إضافية لأي مستخدم
SELECT admin_grant_free_minutes('user-uuid', 30);

-- إعادة تعيين الحماية
SELECT admin_reset_free_minutes_protection('user@example.com');
SELECT admin_reset_free_trial_protection('user@example.com');

-- إحصائيات شاملة
SELECT * FROM get_protection_stats();
```

---
**ملاحظة**: الإصلاح الجديد آمن للتشغيل عدة مرات ولا يؤثر على البيانات الموجودة. 