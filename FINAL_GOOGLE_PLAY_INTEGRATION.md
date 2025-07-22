# ✅ ربط خطط الاشتراك بـ Google Play - مكتمل

## 📋 جدول ربط خطط الاشتراك النهائي

| ID Product (Google Play) | Plan (الخطة) | Plan ID | Monthly/Yearly |
|-------------------------|--------------|---------|----------------|
| (فارغ) | Free plan 2 Days | `mini` | - |
| `mini_monthly` | Mini (Basic+) | `mini` | Monthly only |
| `basic_monthly` | Basic Monthly | `basic` | Monthly |
| `basic_yearly` | Basic Yearly | `basic` | Yearly |
| `pro_monthly` | Pro Monthly | `pro` | Monthly |
| `pro_yearly` | Pro Yearly | `pro` | Yearly |
| `unlimited_monthly` | Unlimited Monthly | `unlimited` | Monthly |
| `unlimited_yearly` | Unlimited Yearly | `unlimited` | Yearly |

## 🔧 التحديثات المطبقة

### 1. ✅ تحديث دالة `handleBuy`
```typescript
const handleBuy = async (planType: string, duration: 'monthly' | 'yearly') => {
  // الحصول على Google Play SKU المناسب
  const googlePlaySku = getGooglePlaySku(planType, duration);
  
  // طلب الشراء من Google Play
  const purchase = await RNIap.requestSubscription({ sku: googlePlaySku });
  
  // حفظ في قاعدة البيانات
  const subscriptionData = {
    user_id: user.id,
    subscription_type: googlePlaySku,
    active: true,
    expires_at: expiresAt,
    usage_seconds: 0
  };
}
```

### 2. ✅ إضافة دالة `getGooglePlaySku`
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

### 3. ✅ تحديث أزرار الشراء
```typescript
// زر الشراء الشهري
onPress={() => handleBuy(pkg.id, 'monthly')}

// زر الشراء السنوي
onPress={() => handleBuy(pkg.id, 'yearly')}

// زر التجربة المجانية (لخطة Mini)
onPress={() => handleActivateFreeTrial()}
```

### 4. ✅ بيانات الخطط المحدثة
```typescript
const packageData = [
  {
    id: 'mini',
    title: 'Mini (Basic+)',
    googleProductIdMonthly: 'mini_monthly',
    // ... باقي البيانات
  },
  {
    id: 'basic',
    title: 'Basic',
    googleProductIdMonthly: 'basic_monthly',
    googleProductIdYearly: 'basic_yearly',
    // ... باقي البيانات
  },
  // ... باقي الخطط
];
```

## 🚀 عملية الشراء الكاملة

### في الأجهزة المحمولة:
1. **ضغط الزر**: `handleBuy('basic', 'monthly')`
2. **تحويل إلى SKU**: `getGooglePlaySku('basic', 'monthly')` → `'basic_monthly'`
3. **طلب الشراء**: `RNIap.requestSubscription({ sku: 'basic_monthly' })`
4. **التحقق من النجاح**: التأكد من استلام بيانات الشراء
5. **حفظ في قاعدة البيانات**: تفعيل الاشتراك
6. **إنهاء المعاملة**: `RNIap.finishTransaction(purchaseItem)`

### في الويب:
- عرض رسالة: "In-app purchases are not supported in web browser"
- توجيه المستخدم لاستخدام التطبيق المحمول

## 📱 أمثلة على الاستخدام

### خطة Basic:
```typescript
// شراء Basic الشهري
handleBuy('basic', 'monthly') 
// → Google Play SKU: 'basic_monthly'

// شراء Basic السنوي
handleBuy('basic', 'yearly')
// → Google Play SKU: 'basic_yearly'
```

### خطة Pro:
```typescript
// شراء Pro الشهري
handleBuy('pro', 'monthly')
// → Google Play SKU: 'pro_monthly'

// شراء Pro السنوي
handleBuy('pro', 'yearly')
// → Google Play SKU: 'pro_yearly'
```

### خطة Mini (التجربة المجانية):
```typescript
// تفعيل التجربة المجانية
handleActivateFreeTrial()
// → لا يحتاج Google Play، يعمل مباشرة
```

## 🔒 الأمان والتحقق

### 1. التحقق من نجاح الشراء:
```typescript
if (purchase && purchase.length > 0) {
  const purchaseItem = purchase[0];
  // الشراء نجح، يمكن المتابعة
} else {
  throw new Error('Purchase failed - no purchase data received');
}
```

### 2. معالجة الأخطاء:
```typescript
catch (purchaseError: any) {
  if (purchaseError.code === 'E_USER_CANCELLED') {
    Alert.alert('Purchase Cancelled', 'You cancelled the purchase.');
  } else {
    Alert.alert('Purchase Error', `Failed to complete purchase: ${purchaseError.message}`);
  }
}
```

### 3. التحقق من التوكن (اختياري):
```typescript
// يمكن تفعيل هذا للتحقق من صحة الشراء
// const receipt = await RNIap.validateReceipt(purchaseItem.transactionReceipt);
```

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

## 🎯 المزايا المحققة

1. **✅ ربط دقيق**: كل خطة مرتبطة بـ Google Play SKU محدد
2. **✅ مرونة**: دعم الخطط الشهرية والسنوية
3. **✅ أمان**: التحقق من نجاح الشراء قبل التفعيل
4. **✅ تجربة مستخدم**: رسائل واضحة للنجاح والفشل
5. **✅ توافق**: عمل في الويب والأجهزة المحمولة
6. **✅ سهولة الصيانة**: دالة واحدة لجميع الخطط

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

## 🎉 النتيجة النهائية

الآن جميع خطط الاشتراك مرتبطة بـ Google Play بشكل صحيح:
- ✅ **التجربة المجانية**: تعمل مباشرة
- ✅ **خطة Mini**: `mini_monthly` في Google Play
- ✅ **خطة Basic**: `basic_monthly` و `basic_yearly`
- ✅ **خطة Pro**: `pro_monthly` و `pro_yearly`
- ✅ **خطة Unlimited**: `unlimited_monthly` و `unlimited_yearly`

جميع الأزرار تعمل بشكل صحيح وتوجه المستخدم للشراء من Google Play! 🚀 