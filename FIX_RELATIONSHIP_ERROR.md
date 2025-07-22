# 🔧 إصلاح خطأ العلاقات في قاعدة البيانات

## المشكلة
```
ERROR: PGRST200: Could not find a relationship between 'user_subscriptions' and 'subscriptions' in the schema cache.
```

## السبب
هناك مشكلة في العلاقات بين الجداول في قاعدة البيانات، حيث يحاول النظام البحث عن علاقة غير موجودة.

## الحل السريع

### 1. استخدم الملف: `fix_relationships_quick.sql`
- اذهب إلى **Supabase Dashboard > SQL Editor**
- انسخ محتوى ملف `fix_relationships_quick.sql`
- الصق الكود واضغط **Run**

### 2. ما يفعله هذا الإصلاح:
- يزيل العلاقات المشكلة بين الجداول
- يزيل الأعمدة غير المطلوبة
- يصلح هيكل الجدول
- يختبر الإصلاح تلقائياً

## الحل البديل (أكثر تفصيلاً)

### 1. استخدم الملف: `supabase/migrations/20250705210000_fix_user_subscriptions_relationships.sql`
- هذا الإصلاح أكثر شمولية ويصلح جميع المشاكل المحتملة

## اختبار الإصلاح

بعد تطبيق الإصلاح:

1. **في التطبيق:**
   - اذهب إلى صفحة الاشتراك
   - اضغط **"Start Free Trial"**
   - يجب أن تعمل بدون أخطاء

2. **في الكونسول:**
   - لا يجب أن تظهر أخطاء PGRST200
   - يجب أن تعمل جميع عمليات قاعدة البيانات

## إذا استمرت المشكلة

إذا لم يعمل الإصلاح، جرب هذا الكود البسيط:

```sql
-- إزالة جميع العلاقات المشكلة
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_id_fkey;

-- إزالة الأعمدة غير المطلوبة
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_id;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_end_date;

-- التأكد من وجود الأعمدة المطلوبة
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 month');
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS usage_seconds integer DEFAULT 0;
```

## النتيجة المتوقعة
✅ لا توجد أخطاء PGRST200  
✅ تفعيل التجربة المجانية يعمل  
✅ جميع عمليات قاعدة البيانات تعمل  
✅ لا توجد مشاكل في العلاقات  

---
**ملاحظة:** الإصلاح الأول (`fix_relationships_quick.sql`) هو الأسرع والأسهل للتطبيق. 