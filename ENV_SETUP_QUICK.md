# إعداد سريع لمتغيرات البيئة

## الوضع الحالي:
- ملف `.env` موجود ولكن متغيرات البيئة فارغة
- التطبيق سيعمل ولكن بدون وظائف المصادقة والترجمة

## لإضافة متغيرات البيئة:

### 1. افتح ملف `.env` في المجلد الرئيسي
### 2. أضف القيم الصحيحة:

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

### 3. أعد تشغيل التطبيق:
```bash
npx expo start --clear
```

## ملاحظات:
- بدون Supabase URL و Key: لن تعمل المصادقة
- بدون AssemblyAI API Key: لن تعمل ترجمة الصوت
- بدون Qwen API Key: لن تعمل التلخيص
- التطبيق سيعمل بشكل أساسي بدون هذه المفاتيح

## للتشغيل الآن:
```bash
npx expo start
```
ثم مسح QR code باستخدام Expo Go 