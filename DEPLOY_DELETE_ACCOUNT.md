# 🚀 رفع صفحة حذف الحساب إلى السيرفر

## ✅ ما تم إنجازه:

1. **إضافة خدمة الملفات الثابتة** في `server/server.js`
2. **إنشاء صفحة حذف الحساب** في `public/simple-delete-account.html`
3. **إضافة API لحذف الحساب** في السيرفر
4. **تحديث package.json** مع مكتبة Supabase

## 🔧 خطوات الرفع:

### 1. إعداد متغيرات البيئة
```bash
# في مجلد server/
# أنشئ ملف .env مع:
EXPO_PUBLIC_SUPABASE_URL=https://ai-voicesum.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
```

### 2. الحصول على Service Role Key
1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. اذهب إلى Settings > API
4. انسخ "service_role" key (ليس anon key)

### 3. رفع التحديثات
```bash
# رفع جميع الملفات المحدثة
git add .
git commit -m "Add account deletion functionality"
git push
```

### 4. إعادة تشغيل السيرفر
```bash
# على السيرفر
cd server
npm install
npm start
```

## 🌐 اختبار الصفحة:

بعد الرفع، ستكون الصفحة متاحة على:
- `https://ai-voicesum.onrender.com/simple-delete-account.html`

## 🔒 الأمان:

- ✅ التحقق من البريد الإلكتروني وكلمة المرور
- ✅ حذف جميع بيانات المستخدم
- ✅ حذف الحساب نهائياً
- ✅ استخدام Service Role Key آمن

## 📱 رابط في التطبيق:

في `app/(tabs)/profile.tsx`، الرابط سيكون:
```typescript
const deleteAccountUrl = 'https://ai-voicesum.onrender.com/simple-delete-account.html';
```

## ⚠️ ملاحظات مهمة:

1. **Service Role Key** مطلوب لحذف الحسابات
2. لا تشارك هذا المفتاح مع أي شخص
3. الصفحة تعمل فقط للمستخدمين المسجلين
4. عملية الحذف نهائية ولا يمكن التراجع عنها 