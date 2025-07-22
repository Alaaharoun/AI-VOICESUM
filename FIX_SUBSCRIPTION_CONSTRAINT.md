# إصلاح مشكلة Subscription Type Constraint

## المشكلة
كان هناك خطأ في قاعدة البيانات يمنع تفعيل التجربة المجانية بسبب constraint على `subscription_type` لا يسمح بقيمة `free_trial`.

## الخطأ الذي يظهر
```
error: {code: '23514', details: null, hint: null, message: 'new row for relation "user_subscriptions" violates check constraint "user_subscriptions_subscription_type_check"'}
```

## الحل
تم إنشاء migration جديد لإصلاح هذه المشكلة:

### 1. تطبيق Migration الجديد
اذهب إلى Supabase Dashboard > SQL Editor وقم بتشغيل الملف:
```
supabase/migrations/20250705200000_fix_subscription_type_constraint.sql
```

### 2. ما يفعله هذا الإصلاح
- يزيل أي constraints قديمة على `subscription_type`
- يضيف constraint جديد يسمح بجميع أنواع الاشتراكات المطلوبة:
  - `free_trial` - للتجربة المجانية
  - `basic`, `premium`, `pro`, `mini`, `unlimited` - للخطط المدفوعة
  - Google Play SKUs مثل `basic-monthly`, `basic-yearly`, إلخ

### 3. اختبار الإصلاح
بعد تطبيق Migration:
1. اذهب إلى صفحة الاشتراك
2. اضغط على "Start Free Trial"
3. يجب أن تعمل التجربة المجانية بدون أخطاء

## أنواع الاشتراكات المدعومة الآن

| نوع الاشتراك | الوصف |
|-------------|-------|
| `free_trial` | التجربة المجانية لمدة يومين |
| `basic` | الخطة الأساسية |
| `premium` | الخطة المميزة |
| `pro` | الخطة الاحترافية |
| `mini` | الخطة المصغرة |
| `unlimited` | الخطة غير المحدودة |
| `basic-monthly` | Google Play SKU للخطة الأساسية الشهرية |
| `basic-yearly` | Google Play SKU للخطة الأساسية السنوية |
| `pro-monthly` | Google Play SKU للخطة الاحترافية الشهرية |
| `pro-yearly` | Google Play SKU للخطة الاحترافية السنوية |
| `unlimited-monthly` | Google Play SKU للخطة غير المحدودة الشهرية |
| `unlimited-yearly` | Google Play SKU للخطة غير المحدودة السنوية |
| `mini-monthly` | Google Play SKU للخطة المصغرة الشهرية |

## ملاحظات مهمة
- هذا الإصلاح يحل مشكلة التجربة المجانية
- يدعم جميع أنواع الاشتراكات المطلوبة للتطبيق
- يحافظ على سلامة البيانات مع السماح بالمرونة المطلوبة 