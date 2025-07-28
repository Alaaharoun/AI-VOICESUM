# 🚀 دليل سريع لاختبار Voice Activity Detection (VAD)

## 📋 قائمة تحقق سريعة

### 1. 🔌 تحقق من تشغيل الخدمة

```bash
# تحقق من Health Check
curl http://localhost:7860/health

# أو للخدمة على Hugging Face
curl https://alaaharoun-faster-whisper-api.hf.space/health
```

**الرد المتوقع:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "service": "faster-whisper",
  "auth_required": false,
  "auth_configured": false
}
```

### 2. 🧪 اختبار سريع

```bash
# تشغيل الاختبار السريع
node quick-vad-test.js
```

### 3. 🔍 اختبار شامل

```bash
# تشغيل الاختبار الشامل
node test-vad-comprehensive.js
```

## 🛠️ أوامر curl للاختبار اليدوي

### اختبار Health Check
```bash
curl https://alaaharoun-faster-whisper-api.hf.space/health
```

### اختبار Transcribe بدون VAD
```bash
curl -X POST \
  -F "file=@test.wav" \
  -F "language=en" \
  -F "task=transcribe" \
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

### اختبار Transcribe مع VAD
```bash
curl -X POST \
  -F "file=@test.wav" \
  -F "language=en" \
  -F "task=transcribe" \
  -F "vad_filter=true" \
  -F "vad_parameters=threshold=0.5" \
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

## 🔧 إعدادات VAD الموصى بها

### عتبة متوازنة (الافتراضية)
```typescript
formData.append('vad_parameters', 'threshold=0.5');
```

### عتبة حساسة للبيئات الهادئة
```typescript
formData.append('vad_parameters', 'threshold=0.3');
```

### عتبة أقل حساسية للبيئات الصاخبة
```typescript
formData.append('vad_parameters', 'threshold=0.7');
```

## 🚨 استكشاف الأخطاء الشائعة

### 1. الخدمة لا ترد
```bash
# تحقق من Docker logs
docker logs faster-whisper-service

# تحقق من المنافذ
netstat -tulpn | grep 7860
```

### 2. VAD لا يعمل
```typescript
// تأكد من إرسال المعاملات
formData.append('vad_filter', 'true');
formData.append('vad_parameters', 'threshold=0.5');
```

### 3. صوت قصير جداً
```typescript
// تأكد من مدة التسجيل
if (audioBlob.size < 1000) {
  console.warn('Audio too short for VAD');
}
```

## 📊 النتائج المتوقعة

### مع VAD مفعل:
- 🎤 **بداية ذكية**: يبدأ التفريغ عند بدء الكلام
- 🛑 **نهاية تلقائية**: يتوقف عند توقف الكلام
- 📝 **نص نظيف**: بدون ضوضاء أو صمت
- ⚡ **أداء أفضل**: معالجة أسرع للصوت

### مثال على النتيجة:
```
بدون VAD: "... [صمت] ... مرحباً كيف حالك ... [صمت] ... شكراً لك ... [صمت] ..."

مع VAD: "مرحباً كيف حالك شكراً لك"
```

## 🎯 الخلاصة

**VAD يجعل التفريغ الصوتي:**
1. ✅ **أكثر ذكاءً**: يكتشف الكلام فقط
2. ✅ **أسرع**: معالجة أقل للبيانات
3. ✅ **أكثر دقة**: نص نظيف بدون ضوضاء
4. ✅ **تجربة طبيعية**: مثل التطبيقات الحديثة 