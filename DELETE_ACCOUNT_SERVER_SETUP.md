# خطوات إنشاء صفحة حذف الحساب عبر السيرفر

## نظرة عامة
تم تحويل صفحة حذف الحساب من نظام بدون سيرفر إلى نظام يعمل عبر السيرفر لتحسين الأمان والتحكم.

## الملفات المطلوبة

### 1. ملف `server.js` الرئيسي
يحتوي على:
- **Endpoint لخدمة الصفحة**: `GET /simple-delete-account.html`
- **Endpoint لحذف الحساب**: `POST /api/delete-account`
- **صفحة HTML مدمجة** مع CSS و JavaScript

### 2. المتطلبات في `package.json`
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4",
    "express": "^5.1.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.0"
  }
}
```

## متغيرات البيئة المطلوبة

### في ملف `.env`:
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://ai-voicesum.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Azure Speech API (للترجمة)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
```

## خطوات التنفيذ

### 1. إعداد السيرفر
```javascript
// في server.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
```

### 2. إنشاء Endpoint لخدمة الصفحة
```javascript
app.get('/simple-delete-account.html', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <!-- صفحة HTML كاملة مع CSS و JavaScript -->
    </html>
  `);
});
```

### 3. إنشاء Endpoint لحذف الحساب
```javascript
app.post('/api/delete-account', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // التحقق من المدخلات
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // إنشاء Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // التحقق من صحة البيانات
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (signInError) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = signInData.user;

    // حذف بيانات المستخدم من جميع الجداول
    const tables = ['recordings', 'user_subscriptions', 'free_trials'];
    
    for (const table of tables) {
      await supabase
        .from(table)
        .delete()
        .eq('user_id', user.id);
    }

    // حذف حساب المستخدم
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      return res.status(500).json({ error: 'Failed to delete user account' });
    }

    res.json({ success: true, message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## ميزات الأمان

### 1. التحقق من صحة البيانات
- التحقق من وجود البريد الإلكتروني وكلمة المرور
- التحقق من صحة بيانات تسجيل الدخول قبل الحذف

### 2. حذف شامل للبيانات
- حذف جميع التسجيلات الصوتية
- حذف معلومات الاشتراك
- حذف تجارب الاستخدام المجانية
- حذف حساب المستخدم نهائياً

### 3. رسائل خطأ واضحة
- رسائل خطأ محددة لكل نوع من الأخطاء
- عدم كشف معلومات حساسة في رسائل الخطأ

## كيفية الاستخدام

### 1. الوصول للصفحة
```
https://your-domain.com/simple-delete-account.html
```

### 2. ملء النموذج
- إدخال البريد الإلكتروني
- إدخال كلمة المرور
- كتابة "DELETE" للتأكيد

### 3. معالجة الطلب
- يتم إرسال البيانات إلى `/api/delete-account`
- التحقق من صحة البيانات
- حذف جميع البيانات المرتبطة
- إرجاع رسالة نجاح أو فشل

## اختبار النظام

### 1. اختبار الوصول للصفحة
```bash
curl https://your-domain.com/simple-delete-account.html
```

### 2. اختبار API حذف الحساب
```bash
curl -X POST https://your-domain.com/api/delete-account \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## استكشاف الأخطاء

### 1. خطأ 404 للصفحة
- التأكد من أن السيرفر يعمل
- التأكد من صحة مسار الصفحة

### 2. خطأ في حذف الحساب
- التحقق من متغيرات البيئة
- التحقق من صحة مفتاح Supabase
- مراجعة سجلات السيرفر

### 3. خطأ في قاعدة البيانات
- التأكد من وجود الجداول المطلوبة
- التحقق من صلاحيات المستخدم

## ملاحظات مهمة

1. **مفتاح Service Role**: يجب استخدام مفتاح Service Role من Supabase وليس مفتاح anon
2. **الأمان**: جميع العمليات تتم على السيرفر وليس في المتصفح
3. **النسخ الاحتياطية**: يُنصح بعمل نسخة احتياطية قبل حذف البيانات
4. **التوافق**: النظام متوافق مع جميع المتصفحات الحديثة

## التحديثات المستقبلية

- إضافة تأكيد إضافي عبر البريد الإلكتروني
- إضافة خيار استرداد الحساب خلال فترة محددة
- تحسين واجهة المستخدم
- إضافة إحصائيات الحذف 