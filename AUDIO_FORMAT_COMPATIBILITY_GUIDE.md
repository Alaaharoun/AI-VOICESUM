# دليل توافق تنسيقات الصوت مع Azure Speech Service

## 🎯 التنسيقات المدعومة رسمياً

### ✅ التنسيقات الموصى بها
1. **PCM 16kHz 16-bit mono** - الأفضل للتعرف الصوتي
2. **OGG (Opus codec)** - جودة عالية مع ضغط جيد
3. **WebM (Opus codec)** - متوافق مع المتصفحات الحديثة

### ⚠️ التنسيقات المدعومة جزئياً
1. **MP4 (AAC codec)** - قد يعمل ولكن ليس مثالي
2. **WAV** - غير مضغوط، حجم كبير

### ❌ التنسيقات غير المدعومة
1. **FLAC** - غير مدعوم في Azure Speech Service
2. **MP3** - قد يسبب مشاكل في التعرف
3. **تنسيقات مضغوطة أخرى** - غير موصى بها

## 🔧 الإعدادات المثلى

### إعدادات التسجيل
```javascript
const optimalSettings = {
  sampleRate: 16000,        // 16kHz - المدعوم رسمياً
  channelCount: 1,          // Mono - أفضل للتعرف
  echoCancellation: true,   // إزالة الصدى
  noiseSuppression: true,   // قمع الضوضاء
  autoGainControl: true,    // التحكم التلقائي في الصوت
  latency: 0.01,           // تأخير منخفض
  volume: 1.0              // مستوى صوت مثالي
};
```

### تنسيقات MediaRecorder الموصى بها
```javascript
const supportedFormats = [
  'audio/webm;codecs=opus',    // الأفضل
  'audio/webm',                // WebM بدون تحديد codec
  'audio/ogg;codecs=opus',     // OGG مع Opus
  'audio/mp4',                 // MP4 كبديل
  'audio/wav'                  // WAV كملاذ أخير
];
```

## 🚀 التحويل التلقائي

### تحويل إلى PCM
```javascript
// تحويل أي تنسيق إلى PCM 16kHz 16-bit mono
const pcmData = await audioConverter.convertToPCM(audioBlob);
```

### خطوات التحويل
1. **فك الضغط** - تحويل البيانات المضغوطة إلى raw audio
2. **تحويل إلى Mono** - دمج القنوات المتعددة
3. **إعادة العينات** - تحويل إلى 16kHz
4. **تحويل إلى 16-bit** - تحويل إلى PCM

## 📊 مقارنة التنسيقات

| التنسيق | الضغط | الجودة | التوافق | الحجم |
|---------|--------|--------|----------|--------|
| PCM 16kHz | لا | ممتازة | 100% | كبير |
| OGG Opus | متوسط | عالية | 95% | متوسط |
| WebM Opus | متوسط | عالية | 90% | متوسط |
| MP4 AAC | عالي | جيدة | 80% | صغير |
| WAV | لا | ممتازة | 100% | كبير جداً |

## 🔍 استكشاف الأخطاء

### مشاكل شائعة
1. **خطأ 1007** - تنسيق صوت غير مدعوم
2. **لا يوجد تعرف** - جودة صوت منخفضة
3. **تأخير عالي** - إعدادات latency غير مناسبة

### حلول
1. **استخدام PCM** - أفضل توافق
2. **تحسين الإعدادات** - استخدام الإعدادات المثلى
3. **التحويل التلقائي** - استخدام AudioConverter

## 🛠️ التنفيذ

### في العميل
```typescript
import { AudioConverter } from './audioConverter';

// استخدام الإعدادات المثلى
const optimalSettings = AudioConverter.getOptimalRecordingSettings();
const optimalFormat = AudioConverter.getOptimalAudioFormat();

// تحويل البيانات
const pcmData = await audioConverter.convertToPCM(audioBlob);
```

### في الخادم
```javascript
// Azure Speech Service يتوقع PCM 16kHz 16-bit mono
let pushStream = speechsdk.AudioInputStream.createPushStream(
  speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
);
```

## ✅ أفضل الممارسات

1. **استخدم PCM** عندما تكون الجودة مهمة
2. **استخدم OGG Opus** للتوازن بين الجودة والحجم
3. **تجنب MP3** - قد يسبب مشاكل
4. **تحقق من التوافق** قبل الاستخدام
5. **اختبر التنسيقات** في بيئة التطوير

## 🎯 النتائج المتوقعة

مع التنسيقات الصحيحة:
- ✅ تعرف صوتي دقيق
- ✅ استجابة سريعة
- ✅ جودة عالية
- ✅ توافق ممتاز مع Azure

## 📝 ملاحظات مهمة

1. **Azure Speech Service** يتطلب تنسيقات محددة
2. **التحويل التلقائي** يحل معظم المشاكل
3. **الإعدادات المثلى** تضمن أفضل النتائج
4. **الاختبار المستمر** مهم للجودة 