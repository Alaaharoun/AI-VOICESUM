# صلاحيات الأدمن في صفحة Upload - التحديث الجديد

## 🎯 التحديث المطلوب

تم إضافة صلاحيات خاصة للأدمن والسوبر أدمن لاستخدام صفحة `upload.tsx` بدون قيود على عدد الساعات المحملة.

## ✅ التعديلات المطبقة

### 1. إضافة فحص الصلاحيات
```typescript
const { isSuperadmin, hasRole, loading: permissionsLoading } = useUserPermissions();
const isAdmin = isSuperadmin || hasRole('admin') || hasRole('superadmin');
```

### 2. إلغاء قيود الرصيد للأدمن
- **المستخدمين العاديين**: يخضعون لفحص الرصيد المتبقي
- **الأدمن والسوبر أدمن**: لا يخضعون لقيود الرصيد

### 3. إلغاء خصم الدقائق للأدمن
- **المستخدمين العاديين**: يتم خصم الدقائق بعد كل عملية تفريغ
- **الأدمن والسوبر أدمن**: لا يتم خصم أي دقائق

### 4. واجهة خاصة للأدمن
- **عرض حالة الأدمن**: "🔧 Admin Mode - Unlimited Access"
- **لون مختلف**: خلفية صفراء ونص برتقالي
- **تمييز بصري**: يظهر أن المستخدم في وضع الأدمن

## 🔧 التفاصيل التقنية

### فحص الصلاحيات
```typescript
// التحقق من صلاحيات الأدمن
const isAdmin = isSuperadmin || hasRole('admin') || hasRole('superadmin');
```

### منطق التحقق من الرصيد
```typescript
// التحقق من الرصيد فقط للمستخدمين العاديين (ليس الأدمن)
if (!isAdmin) {
  if (remainingMinutes === null) {
    Alert.alert('Error', 'Cannot fetch your credits.');
    return;
  }
  if (totalMinutes > remainingMinutes) {
    Alert.alert('Insufficient Credits', 'Total file duration exceeds your remaining credits. Please purchase additional minutes.');
    return;
  }
}
```

### منطق خصم الدقائق
```typescript
// خصم الدقائق فقط للمستخدمين العاديين (ليس الأدمن)
if (!isAdmin) {
  const fileMinutes = Math.ceil(file.duration / 60);
  await supabase.rpc('deduct_transcription_time', { uid: user.id, minutes_to_deduct: fileMinutes });
  // تحديث الرصيد بعد الخصم
  // ...
}
```

### واجهة الأدمن
```typescript
{/* عرض الرصيد المتبقي أو حالة الأدمن */}
{user && (
  <View style={[styles.creditsContainer, isAdmin && styles.adminCreditsContainer]}>
    <Text style={[styles.creditsText, isAdmin && styles.adminCreditsText]}>
      {isAdmin ? '🔧 Admin Mode - Unlimited Access' : `Remaining Credits: ${remainingMinutes !== null ? remainingMinutes + ' minutes' : '...'}`}
    </Text>
  </View>
)}
```

## 🎨 الأنماط الجديدة

### أنماط الأدمن
```typescript
adminCreditsContainer: {
  backgroundColor: '#FEF3C7',  // خلفية صفراء فاتحة
  borderColor: '#F59E0B',      // حدود برتقالية
},
adminCreditsText: {
  color: '#92400E',            // نص برتقالي غامق
},
```

## 📱 كيفية العمل

### للمستخدمين العاديين:
1. **فحص الرصيد**: يتم التحقق من كفاية الرصيد قبل التفريغ
2. **خصم الدقائق**: يتم خصم الدقائق بعد كل عملية
3. **عرض الرصيد**: يظهر الرصيد المتبقي

### للأدمن والسوبر أدمن:
1. **لا فحص رصيد**: يمكن رفع أي عدد من الملفات بأي مدة
2. **لا خصم دقائق**: لا يتم خصم أي دقائق من رصيدهم
3. **عرض حالة الأدمن**: يظهر "🔧 Admin Mode - Unlimited Access"

## 🔒 الأمان

- **فحص الصلاحيات**: يتم فحص الصلاحيات عند تحميل الصفحة
- **حماية من التلاعب**: لا يمكن للمستخدمين العاديين تجاوز القيود
- **تسجيل العمليات**: جميع العمليات مسجلة في قاعدة البيانات

## ✅ التحقق من التطبيق

### اختبار الأدمن:
1. تسجيل دخول بحساب أدمن أو سوبر أدمن
2. الذهاب إلى صفحة Upload
3. رفع ملفات بأي مدة
4. التأكد من عدم ظهور رسائل "Insufficient Credits"
5. التأكد من عدم خصم أي دقائق

### اختبار المستخدم العادي:
1. تسجيل دخول بحساب عادي
2. الذهاب إلى صفحة Upload
3. رفع ملفات تتجاوز الرصيد المتبقي
4. التأكد من ظهور رسالة "Insufficient Credits"
5. التأكد من خصم الدقائق بعد التفريغ

## 🎯 النتيجة النهائية

- **الأدمن والسوبر أدمن**: وصول غير محدود لصفحة Upload
- **المستخدمين العاديين**: يخضعون لنظام الدقائق العادي
- **واجهة واضحة**: تمييز بصري لحالة الأدمن
- **أمان كامل**: حماية من التلاعب بالصلاحيات

النظام الآن يدعم صلاحيات خاصة للأدمن! 🚀 