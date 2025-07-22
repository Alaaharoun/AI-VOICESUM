# ربط خطط الاشتراك بـ Google Play

## 📋 جدول ربط خطط الاشتراك

| ID Product (Google Play) | Plan (الخطة) |
|-------------------------|--------------|
| (فارغ) | Free plan 2 Days |
| `mini_monthly` | Mini (Basic+) |
| `basic_monthly` | Basic Monthly |
| `basic_yearly` | Basic Yearly |
| `pro_monthly` | Pro Monthly |
| `pro_yearly` | Pro Yearly |
| `unlimited_monthly` | Unlimited Monthly |
| `unlimited_yearly` | Unlimited Yearly |

## 🔧 التحديثات المطبقة

### 1. تحديث دالة `handleBuy`
- ربط كل خطة بـ Google Play SKU المناسب
- إضافة معالجة للشراء من Google Play
- التحقق من نجاح الشراء قبل تفعيل الاشتراك

### 2. إضافة دالة `getGooglePlaySku`
```typescript
const getGooglePlaySku = (planType: string, duration: 'monthly' | 'yearly'): string => {
  const skuMap: { [key: string]: { [key: string]: string } } = {
    'mini': {
      'monthly': 'mini_monthly',
      'yearly': 'mini_monthly' // Mini لا يوجد له خطة سنوية
    },
    'basic': {
      'monthly': 'basic_monthly',
      'yearly': 'basic_yearly'
    },
    'pro': {
      'monthly': 'pro_monthly',
      'yearly': 'pro_yearly'
    },
    'unlimited': {
      'monthly': 'unlimited_monthly',
      'yearly': 'unlimited_yearly'
    }
  };
  
  return skuMap[planType]?.[duration] || `${planType}_${duration}`;
};
```

### 3. قائمة Google Play Product IDs
```typescript
const itemSkus = [
  'mini_monthly',      // Mini (Basic+)
  'basic_monthly',     // Basic Monthly
  'basic_yearly',      // Basic Yearly
  'pro_monthly',       // Pro Monthly
  'pro_yearly',        // Pro Yearly
  'unlimited_monthly', // Unlimited Monthly
  'unlimited_yearly',  // Unlimited Yearly
];
```

## 🚀 عملية الشراء

### في الأجهزة المحمولة:
1. **طلب الشراء**: `RNIap.requestSubscription({ sku: googlePlaySku })`
2. **التحقق من النجاح**: التأكد من استلام بيانات الشراء
3. **حفظ في قاعدة البيانات**: تفعيل الاشتراك في `user_subscriptions`
4. **إنهاء المعاملة**: `RNIap.finishTransaction(purchaseItem)`

### في الويب:
- عرض رسالة توضيحية: "In-app purchases are not supported in web browser"
- توجيه المستخدم لاستخدام التطبيق المحمول

## 📱 كيفية استخدام الأزرار

### مثال على استدعاء دالة الشراء:
```typescript
// شراء خطة Basic الشهرية
onPress={() => handleBuy('basic', 'monthly')}

// شراء خطة Pro السنوية
onPress={() => handleBuy('pro', 'yearly')}

// شراء خطة Unlimited الشهرية
onPress={() => handleBuy('unlimited', 'monthly')}
```

## 🔒 الأمان والتحقق

### 1. التحقق من التوكن (اختياري)
```typescript
// يمكن تفعيل هذا للتحقق من صحة الشراء
// const receipt = await RNIap.validateReceipt(purchaseItem.transactionReceipt);
```

### 2. معالجة الأخطاء
- **إلغاء المستخدم**: `E_USER_CANCELLED`
- **فشل الشراء**: رسالة خطأ واضحة
- **خطأ في قاعدة البيانات**: إعادة المحاولة

## 📊 بيانات الاشتراك المحفوظة

```typescript
const subscriptionData = {
  user_id: user.id,
  subscription_type: googlePlaySku, // مثل 'basic_monthly'
  active: true,
  expires_at: expiresAt, // تاريخ انتهاء الصلاحية
  usage_seconds: 0
};
```

## 🎯 المزايا

1. **ربط دقيق**: كل خطة مرتبطة بـ Google Play SKU محدد
2. **مرونة**: دعم الخطط الشهرية والسنوية
3. **أمان**: التحقق من نجاح الشراء قبل التفعيل
4. **تجربة مستخدم**: رسائل واضحة للنجاح والفشل
5. **توافق**: عمل في الويب والأجهزة المحمولة

## 📝 ملاحظات مهمة

- **التجربة المجانية**: لا تحتاج لـ Google Play، تعمل مباشرة
- **الخطط المدفوعة**: تتطلب Google Play في الأجهزة المحمولة
- **الويب**: لا يدعم الشراء داخل التطبيق
- **التحديثات**: يمكن إضافة خطط جديدة بسهولة عبر تحديث `skuMap`

## 🔄 التطوير المستقبلي

1. **إضافة التحقق من التوكن**: للتحقق من صحة الشراء
2. **دعم Apple App Store**: إضافة دعم iOS
3. **إدارة الاشتراكات**: إلغاء وتجديد الاشتراكات
4. **التقارير**: تقارير المبيعات والإيرادات 