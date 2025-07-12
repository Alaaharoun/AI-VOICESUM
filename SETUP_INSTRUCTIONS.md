# تعليمات إعداد مشروع Live Translate

## المشكلة التي تم حلها:
كان التطبيق لا يعمل بسبب عدم وجود متغيرات البيئة (Environment Variables). تم إصلاح هذه المشكلة بإضافة قيم افتراضية.

## كيفية تشغيل التطبيق:

### 1. تشغيل على Expo Go:
```bash
npx expo start
```
ثم مسح QR code باستخدام تطبيق Expo Go على هاتفك.

### 2. بناء APK:
```bash
cd android && ./gradlew assembleRelease
```

## إعداد متغيرات البيئة (مطلوب للوظائف الكاملة):

ملف `.env` موجود بالفعل ولكن يحتاج إلى قيم صحيحة. أضف القيم الصحيحة في ملف `.env`:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# AI Summarization - Qwen-Turbo API (Alibaba Cloud DashScope)
EXPO_PUBLIC_QWEN_API_KEY=your_qwen_api_key_here

# Audio Transcription - AssemblyAI
EXPO_PUBLIC_ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Azure Speech Services (اختياري)
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here
```

## التغييرات التي تمت:

1. **app.config.js**: إضافة قيم افتراضية لمتغيرات البيئة
2. **lib/supabase.ts**: تحسين التعامل مع متغيرات البيئة
3. **contexts/AuthContext.tsx**: إضافة فحص لتكوين Supabase
4. **app/_layout.tsx**: تحسين التعامل مع أخطاء البيئة
5. **app/index.tsx**: إضافة ملف توجيه رئيسي

## ملاحظات:
- التطبيق سيعمل الآن حتى بدون متغيرات البيئة
- ستظهر رسائل تحذير في console حول عدم تكوين API keys
- لتفعيل جميع الميزات، أضف متغيرات البيئة الصحيحة

## استكشاف الأخطاء:
إذا واجهت مشاكل:
1. تأكد من تثبيت جميع الحزم: `npm install`
2. امسح cache: `npx expo start --clear`
3. أعد تشغيل الخادم: `npx expo start` 