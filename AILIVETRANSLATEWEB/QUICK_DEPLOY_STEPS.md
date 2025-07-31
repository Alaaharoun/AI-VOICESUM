# 🚀 خطوات النشر السريعة على Netlify

## ✅ الملفات الجاهزة
- `netlify.toml` ✅
- `public/_redirects` ✅
- `package.json` ✅

## 🔧 الخطوات السريعة

### 1. فحص الإعداد
```bash
node check-netlify-setup.cjs
```

### 2. بناء المشروع
```bash
# الطريقة 1: سكريبت PowerShell
.\deploy-to-netlify.ps1

# الطريقة 2: ملف BAT
build-for-netlify.bat

# الطريقة 3: يدوياً
npm run build
```

### 3. رفع إلى Git
```bash
git init
git add .
git commit -m "Deploy to Netlify"
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

### 4. النشر على Netlify

#### الطريقة A: رفع مجلد dist مباشرة
1. اذهب إلى https://app.netlify.com/
2. اسحب مجلد `dist` إلى منطقة النشر
3. انسخ الرابط الناتج

#### الطريقة B: ربط بـ Git Repository
1. اذهب إلى https://app.netlify.com/
2. اختر "New site from Git"
3. اختر GitHub/GitLab
4. اختر repository
5. اضبط:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. اضغط "Deploy site"

## ⚙️ متغيرات البيئة المطلوبة

في Netlify Dashboard > Site settings > Environment variables:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AZURE_SPEECH_KEY=your_azure_speech_key
VITE_AZURE_SPEECH_REGION=your_azure_region
```

## 🎯 النتيجة
- رابط مباشر لموقعك
- SSL مجاني
- CDN عالمي
- تحديث تلقائي

## 📞 المساعدة
- فحص الإعداد: `node check-netlify-setup.cjs`
- دليل مفصل: `NETLIFY_DEPLOYMENT_GUIDE.md` 