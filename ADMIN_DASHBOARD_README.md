# 🔧 Admin Dashboard - Complete Guide

## ✅ تم التثبيت والربط بنجاح!

تم إنشاء لوحة تحكم أدمن شاملة وحديثة مع ربط مباشر بالملفات الحقيقية وقاعدة البيانات.

## 🎯 الميزات المُكتملة

### 1. **📊 Dashboard Overview**
- **إحصائيات حقيقية** من Supabase:
  - عدد المستخدمين من `auth.users` أو `profiles`
  - الاشتراكات الفعالة من `user_subscriptions`
  - التفريغات الصوتية من `recordings` و `transcription_credits`
  - دقائق الاستخدام المجمعة
- **مقاييس الأداء**: معدل النجاح والطلبات الفاشلة
- **النشاط الأخير**: يمكن توسيعه لعرض logs حقيقية

### 2. **🧪 Testing Tools (مربوط بالملفات الحقيقية)**
- **Azure Speech Test**: يستخدم `test-azure-speech.js` عبر WebSocket
- **Azure Deep Test**: يستخدم `test-azure-deep.js` للاختبار الشامل
- **Real-time Buffer Test**: يستخدم `test-real-time-buffer.js`
- **Qwen API Test**: يستخدم `test-qwen-api.js` مع مفتاح API حقيقي

### 3. **👥 User Management (مربوط بـ Supabase)**
- **بيانات حقيقية** من `auth.users` و `profiles`
- **إدارة الأدوار** مع `user_roles` و `roles`
- **إدارة الاشتراكات** مع `user_subscriptions`
- **منح التجارب المجانية** مع `transcription_credits`

### 4. **💳 Subscription Management**
- **إحصائيات شاملة** من قاعدة البيانات
- **إنشاء اشتراكات جديدة** مع إضافة دقائق
- **منح تجارب مجانية** (3 أو 7 أيام)
- **إدارة متقدمة** للاشتراكات النشطة

### 5. **🗄️ Database Management**
- **عرض الجداول المسموحة**: 9 جداول آمنة
- **استعلامات SQL آمنة**: SELECT فقط
- **تصدير البيانات**: CSV format
- **عرض المخطط**: تفاصيل الأعمدة والأنواع

### 6. **⚙️ Settings Panel**
- **إدارة مفاتيح API**: Azure, AssemblyAI, Qwen
- **إعدادات التطبيق**: اللغة، مدة التسجيل، فترة التجربة
- **التحكم في المراقبة**: Analytics وError Logging

## 📂 الملفات المُنشأة/المُحدّثة

### ملفات جديدة:
- `services/testRunner.ts` - خدمة تشغيل الاختبارات الحقيقية
- `constants/database.ts` - ثوابت قاعدة البيانات والإعدادات
- `components/UserManagement.tsx` - إدارة المستخدمين الشاملة
- `components/SubscriptionManagement.tsx` - إدارة الاشتراكات المتقدمة
- `components/DatabaseManagement.tsx` - إدارة قاعدة البيانات الآمنة

### ملفات محدّثة:
- `app/admin.tsx` - لوحة التحكم الرئيسية (تم إعادة كتابتها بالكامل)

## 🔐 الأمان

### مصادقة PIN:
- **الرقم السري**: `1414` (يمكن تغييره في `constants/database.ts`)
- **فحص الصلاحيات**: التأكد من أدوار `admin` أو `super_admin`

### حماية قاعدة البيانات:
- **جداول آمنة فقط**: 9 جداول مسموحة مُحددة مسبقاً
- **استعلامات SELECT فقط**: منع العمليات الضارة
- **فلترة المدخلات**: حماية من SQL injection

## 🚀 الاستخدام

### 1. الوصول للوحة التحكم:
```bash
# افتح التطبيق واذهب إلى
/admin
```

### 2. إدخال الرقم السري:
```
PIN: 1414
```

### 3. التنقل:
- استخدم القائمة الجانبية للتنقل بين الأقسام
- كل قسم مستقل ومتصل بقاعدة البيانات

## 🔧 التكوين

### متغيرات البيئة المطلوبة:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_QWEN_API_KEY=your_qwen_key
EXPO_PUBLIC_ASSEMBLYAI_API_KEY=your_assembly_key
```

### إعدادات الاختبار:
```typescript
// في constants/database.ts
export const TEST_CONFIG = {
  WEBSOCKET_URL: 'wss://ai-voicesum.onrender.com/ws',
  QWEN_API_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
  DEFAULT_TIMEOUT: 15000,
  // ...
}
```

## 🛠️ التخصيص

### إضافة جدول جديد:
1. أضف اسم الجدول في `ADMIN_TABLES` في `constants/database.ts`
2. أضف schema الجدول في `TABLE_SCHEMAS`
3. تأكد من وجود RLS policies مناسبة

### إضافة اختبار جديد:
1. أنشئ دالة جديدة في `services/testRunner.ts`
2. أضف الاختبار في `testResults` في `admin.tsx`
3. أضف case جديد في `runTest` function

### تخصيص الإحصائيات:
1. عدّل `fetchDashboardStats` في `admin.tsx`
2. أضف queries جديدة للجداول المطلوبة
3. حدّث واجهة `DashboardStats`

## 🎨 التصميم

### الألوان الرئيسية:
- **أزرق**: `#3B82F6` (Primary)
- **أخضر**: `#10B981` (Success)
- **أحمر**: `#EF4444` (Error)
- **أصفر**: `#F59E0B` (Warning)

### المكونات:
- **Material Design 3** inspired
- **Responsive layout** للجوال والتابلت
- **Dark/Light theme** ready (يمكن تفعيله لاحقاً)

## 📊 الجداول المدعومة

| الجدول | الوصف | الأعمدة الرئيسية |
|--------|--------|-------------------|
| `profiles` | ملفات المستخدمين | id, user_id, email, full_name |
| `user_subscriptions` | اشتراكات المستخدمين | user_id, subscription_type, active, expires_at |
| `transcription_credits` | رصيد التفريغ | user_id, total_minutes, used_minutes |
| `user_roles` | أدوار المستخدمين | user_id, role_id |
| `roles` | الأدوار المتاحة | name, description |
| `recordings` | التسجيلات الصوتية | user_id, transcription, summary, duration |
| `app_settings` | إعدادات التطبيق | key, value |

## 🔄 التحديثات المستقبلية

### المميزات القادمة:
- [ ] **Real-time notifications** للنشاطات الجديدة
- [ ] **Advanced analytics** مع رسوم بيانية تفاعلية
- [ ] **Backup & Restore** للبيانات
- [ ] **API rate limiting** مراقبة وإدارة
- [ ] **User activity logs** تفصيلية
- [ ] **Email notifications** للأدمن

### التحسينات المطلوبة:
- [ ] **Caching** للاستعلامات المتكررة
- [ ] **Error boundaries** شاملة
- [ ] **Loading states** محسنة
- [ ] **Pagination** لجميع القوائم
- [ ] **Search filters** متقدمة

## 🐛 استكشاف الأخطاء

### مشاكل شائعة:

#### 1. فشل الاتصال بـ Supabase:
```bash
# تحقق من متغيرات البيئة
echo $EXPO_PUBLIC_SUPABASE_URL
echo $EXPO_PUBLIC_SUPABASE_ANON_KEY
```

#### 2. فشل الاختبارات:
```bash
# تحقق من اتصال الشبكة
curl -I https://ai-voicesum.onrender.com/ws
```

#### 3. مشاكل الصلاحيات:
```sql
-- تحقق من أدوار المستخدم
SELECT u.email, r.name 
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'your_email@example.com';
```

## 📞 الدعم

للدعم التقني أو الاستفسارات:
- فحص الـ console للـ errors
- تأكد من تحديث المتغيرات البيئية
- تحقق من اتصال الشبكة
- راجع Supabase dashboard للـ policies

---

## 🎉 تهانينا!

لوحة التحكم جاهزة للاستخدام الإنتاجي مع جميع الميزات المطلوبة وربط مباشر بقاعدة البيانات والملفات الحقيقية! 🚀 