# 🚀 دليل النشر على Netlify

## 📋 الملفات المطلوبة (تم إنشاؤها)

### ✅ netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

### ✅ public/_redirects
```
/*    /index.html   200
```

## 🔧 الخطوات السريعة

### 1. تشغيل سكريبت النشر التلقائي
```powershell
# في مجلد AILIVETRANSLATEWEB
.\deploy-to-netlify.ps1
```

### 2. أو تنفيذ الخطوات يدوياً

#### الخطوة 1: بناء المشروع
```bash
npm run build
```

#### الخطوة 2: إعداد Git
```bash
git init
git add .
git commit -m "Initial commit for Netlify deployment"
```

#### الخطوة 3: رفع إلى GitHub/GitLab
```bash
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

## 🌐 النشر على Netlify

### الطريقة 1: رفع مجلد dist مباشرة
1. اذهب إلى [Netlify](https://app.netlify.com/)
2. اسحب مجلد `dist` إلى منطقة النشر
3. سيتم نشر موقعك فوراً

### الطريقة 2: ربط بـ Git Repository
1. اذهب إلى [Netlify](https://app.netlify.com/)
2. اختر "New site from Git"
3. اختر GitHub/GitLab
4. اختر repository الخاص بك
5. اضبط إعدادات البناء:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. اضغط "Deploy site"

## ⚙️ إعداد متغيرات البيئة (Environment Variables)

في Netlify Dashboard > Site settings > Environment variables:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AZURE_SPEECH_KEY=your_azure_speech_key
VITE_AZURE_SPEECH_REGION=your_azure_region
```

## 🔍 التحقق من النشر

### فحص الملفات المحلية
```powershell
# التحقق من وجود الملفات المطلوبة
Test-Path "netlify.toml"
Test-Path "public/_redirects"
Test-Path "dist"
```

### فحص البناء
```bash
npm run build
# يجب أن ينتج مجلد dist مع الملفات
```

## 🛠️ استكشاف الأخطاء

### مشكلة: فشل في البناء
```bash
# تنظيف وإعادة تثبيت
rm -rf node_modules package-lock.json
npm install
npm run build
```

### مشكلة: خطأ في التوجيه (Routing)
- تأكد من وجود ملف `public/_redirects`
- تأكد من صحة محتوى `netlify.toml`

### مشكلة: متغيرات البيئة
- تأكد من إضافة جميع متغيرات البيئة في Netlify
- تأكد من أن أسماء المتغيرات تبدأ بـ `VITE_`

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من console في المتصفح
2. تحقق من build logs في Netlify
3. تأكد من صحة جميع متغيرات البيئة

## 🎯 النتيجة النهائية

بعد النجاح، ستحصل على:
- رابط مباشر لموقعك (مثل: `https://your-site.netlify.app`)
- تحديث تلقائي عند كل push إلى repository
- SSL مجاني
- CDN عالمي 