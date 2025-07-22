# 🔧 دليل الإصلاح السريع - مشكلة Subscription Constraint

## المشكلة
```
ERROR: 23514: check constraint "user_subscriptions_subscription_type_check" of relation "user_subscriptions" is violated by some row
```

## الحل السريع (الأسهل)

### 1. استخدم الملف: `remove_subscription_constraint.sql`
- اذهب إلى **Supabase Dashboard > SQL Editor**
- انسخ محتوى ملف `remove_subscription_constraint.sql`
- الصق الكود واضغط **Run**

### 2. ما يفعله هذا الإصلاح:
- يزيل جميع constraints على `subscription_type` تماماً
- يسمح بإدخال أي قيمة لـ `subscription_type`
- يختبر الإصلاح تلقائياً

## الحل البديل (أكثر أماناً)

### 1. استخدم الملف: `fix_subscription_constraint_complete.sql`
- هذا الإصلاح يحافظ على constraint لكن يصلح البيانات الموجودة
- أكثر أماناً لكن قد يحتاج خطوات إضافية

## اختبار الإصلاح

بعد تطبيق أي من الإصلاحين:

1. **في التطبيق:**
   - اذهب إلى صفحة الاشتراك
   - اضغط **"Start Free Trial"**
   - يجب أن تعمل بدون أخطاء

2. **في Supabase:**
   - اذهب إلى **Table Editor > user_subscriptions**
   - تحقق من أن constraint تم إزالته

## إذا استمرت المشكلة

إذا لم يعمل الإصلاح، جرب:

```sql
-- إزالة constraint يدوياً
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_type_check;

-- التحقق من عدم وجود constraints أخرى
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'user_subscriptions' 
AND constraint_type = 'CHECK';
```

## النتيجة المتوقعة
✅ تفعيل التجربة المجانية يعمل  
✅ لا توجد أخطاء في قاعدة البيانات  
✅ جميع أنواع الاشتراكات تعمل  

---
**ملاحظة:** الإصلاح الأول (`remove_subscription_constraint.sql`) هو الأسرع والأسهل للتطبيق. 