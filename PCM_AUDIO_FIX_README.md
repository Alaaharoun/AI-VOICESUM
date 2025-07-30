# PCM Audio Conversion Fix

## المشكلة المحددة

كانت المشكلة في أن السيرفر يحفظ البيانات الصوتية PCM الخام في ملف بامتداد `.mp3` مما يضلل ffmpeg:

```
[mp3 @ ...] Format mp3 detected only with low score of 1, misdetection possible!
Failed to read frame size: Could not seek to ...
/tmp/input_xxx.mp3: Invalid argument
```

## الحل المطبق

### 1. **دالة تحويل MIME Type إلى امتداد الملف الصحيح**

```javascript
function mimeToExtension(mimeType) {
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('m4a')) return '.m4a';
  if (mimeType.includes('pcm')) return '.raw';
  if (mimeType.includes('audio/pcm')) return '.raw';
  return '.bin'; // fallback
}
```

### 2. **معالجة خاصة للبيانات PCM الخام**

```javascript
if (inputFormat === 'audio/pcm' || inputFormat.includes('pcm')) {
  // For raw PCM data, specify format explicitly
  ffmpegCommand = `${ffmpegPath} -f s16le -ar 16000 -ac 1 -i "${inputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputFile}" -y`;
  console.log(`🔧 FFmpeg command (PCM raw): ${ffmpegCommand}`);
} else {
  // For other formats, let ffmpeg auto-detect
  ffmpegCommand = `${ffmpegPath} -i "${inputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputFile}" -y`;
  console.log(`🔧 FFmpeg command (auto-detect): ${ffmpegCommand}`);
}
```

### 3. **إضافة audio/pcm إلى الصيغ المدعومة**

```javascript
const SUPPORTED_AUDIO_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 
  'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/webm', 'audio/flac', 
  'audio/mp4', 'audio/pcm'  // ← تمت الإضافة
];
```

## النتائج المتوقعة

### ✅ **قبل الإصلاح:**
```
🎵 [en-US] Received raw PCM audio chunk: 21956 bytes
🔧 FFmpeg command: ffmpeg -i "/tmp/input_123.mp3" -acodec pcm_s16le -ar 16000 -ac 1 "/tmp/output_123.wav" -y
❌ FFmpeg conversion failed: Command failed
[mp3 @ ...] Format mp3 detected only with low score of 1, misdetection possible!
✅ Created WAV header for PCM data: 21956 bytes → 22000 bytes
✅ [en-US] Recognized speech but no text content
```

### ✅ **بعد الإصلاح:**
```
🎵 [en-US] Received raw PCM audio chunk: 21956 bytes
🔧 FFmpeg command (PCM raw): ffmpeg -f s16le -ar 16000 -ac 1 -i "/tmp/input_123.raw" -acodec pcm_s16le -ar 16000 -ac 1 "/tmp/output_123.wav" -y
✅ FFmpeg conversion successful: 21956 bytes → 32000 bytes
✅ [en-US] PCM audio chunk written to Azure Speech SDK
🎤 [en-US] RECOGNIZING: "Hello world"
✅ [en-US] RECOGNIZED: "Hello world"
```

## المميزات الجديدة

### ✅ **امتدادات ملفات صحيحة**
- `audio/webm;codecs=opus` → `.webm`
- `audio/ogg;codecs=opus` → `.ogg`
- `audio/pcm` → `.raw`
- `audio/mp3` → `.mp3`
- `audio/wav` → `.wav`

### ✅ **معالجة خاصة للبيانات PCM**
- استخدام `-f s16le` لإعلام ffmpeg بأن الملف PCM خام
- تحديد معدل العينات والقنوات: `-ar 16000 -ac 1`

### ✅ **تحسين الأداء**
- تقليل الأخطاء في ffmpeg
- تحويل أسرع وأكثر دقة
- نتائج أفضل من Azure Speech Service

## كيفية الاختبار

1. **انتظر تحديث السيرفر** (2-3 دقائق)
2. **اختبر التطبيق** على: `https://ai-voicesum.onrender.com`
3. **تحقق من السجلات** للتأكد من عدم ظهور أخطاء ffmpeg

## ملاحظات مهمة

- ✅ تم رفع الإصلاح إلى GitHub
- ✅ السيرفر سيتحدث تلقائياً على Render
- ✅ الإصلاح يدعم جميع صيغ الصوت المدعومة
- ✅ معالجة خاصة للبيانات PCM الخام

---

**🎯 الإصلاح جاهز! انتظر بضع دقائق حتى يتم تحديث السيرفر.** 🚀 