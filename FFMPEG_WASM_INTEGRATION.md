# تكامل ffmpeg.wasm مع جمع الـ Chunks

## نظرة عامة
تم تحديث النظام لاستخدام ffmpeg.wasm لتحويل الصوت من webm/opus إلى WAV قبل الإرسال، مع نظام محسن لجمع الـ chunks.

## المميزات الجديدة

### 🔧 تحويل الصوت التلقائي
- تحويل من `audio/webm;codecs=opus` إلى `audio/wav`
- تحويل من `audio/webm;codecs=opus` إلى `audio/mpeg`
- معالجة أخطاء مع fallback للصيغة الأصلية

### 📦 جمع الـ Chunks المحسن
- جمع حسب العدد (5 chunks)
- جمع حسب الحجم (50KB)
- جمع حسب الوقت (3 ثوانٍ)
- إرسال تلقائي عند تحقيق أي شرط

### ⚡ إدارة الطلبات المحسنة
- طلب واحد متزامن فقط
- تأخير بين الطلبات
- معالجة أفضل للأخطاء

## التثبيت

### 1. تثبيت المكتبات المطلوبة
```bash
npm install @ffmpeg/ffmpeg @ffmpeg/core
```

### 2. إضافة المكتبات إلى package.json
```json
{
  "dependencies": {
    "@ffmpeg/ffmpeg": "^0.11.0",
    "@ffmpeg/core": "^0.11.0"
  }
}
```

## الاستخدام

### 1. إعدادات افتراضية
```typescript
import { ChunkCollector, DEFAULT_CHUNK_CONFIG } from './services/chunkCollector';

// إعدادات افتراضية
const config = DEFAULT_CHUNK_CONFIG;
// {
//   maxChunks: 5,        // عدد الـ chunks قبل الإرسال
//   maxSize: 51200,      // 50KB
//   maxTime: 3000,       // 3 ثوانٍ
//   targetFormat: 'wav'  // التنسيق المستهدف
// }
```

### 2. إعدادات مخصصة
```typescript
import { ChunkCollector, HIGH_PERFORMANCE_CONFIG, STABLE_CONFIG } from './services/chunkCollector';

// للأداء العالي (chunks أصغر)
const highPerformanceConfig = HIGH_PERFORMANCE_CONFIG;
// {
//   maxChunks: 3,
//   maxSize: 25600,      // 25KB
//   maxTime: 2000,       // 2 ثانية
//   targetFormat: 'wav'
// }

// للاستقرار العالي (chunks أكبر)
const stableConfig = STABLE_CONFIG;
// {
//   maxChunks: 8,
//   maxSize: 102400,     // 100KB
//   maxTime: 5000,       // 5 ثوانٍ
//   targetFormat: 'wav'
// }
```

### 3. استخدام ChunkCollector
```typescript
const chunkCollector = new ChunkCollector(
  DEFAULT_CHUNK_CONFIG,
  (convertedBlob) => {
    // معالجة الصوت المحول
    console.log('Audio converted:', convertedBlob.size, 'bytes');
    uploadToServer(convertedBlob);
  }
);

// إضافة chunks
mediaRecorder.ondataavailable = (event) => {
  chunkCollector.addChunk(event.data);
};
```

## مراقبة الأداء

### 🔍 رسائل Console المهمة
ابحث عن هذه الرسائل في console:

**✅ نجح التحويل**:
- `🔄 Loading ffmpeg.wasm...`
- `✅ ffmpeg.wasm loaded successfully`
- `📦 Chunk added: 16422 bytes, Total: 32844 bytes, Chunks: 2`
- `🔄 Processing 5 chunks (51200 bytes total)`
- `📊 Combined blob: 51200 bytes, type: audio/webm`
- `🔄 Converting audio to WAV...`
- `✅ Audio converted to WAV: 25600 bytes`

**⚠️ مشاكل محتملة**:
- `❌ Error loading ffmpeg.wasm`
- `❌ Error converting audio to WAV`
- `⚠️ Using fallback (original format)`

### 📊 إحصائيات الأداء
```typescript
const stats = chunkCollector.getStats();
console.log('Current stats:', stats);
// {
//   chunkCount: 3,
//   totalSize: 32844,
//   timeSinceLastChunk: 1500
// }
```

## إعدادات قابلة للتعديل

### ChunkConfig Interface
```typescript
interface ChunkConfig {
  maxChunks: number;     // عدد الـ chunks قبل الإرسال
  maxSize: number;       // الحد الأقصى للحجم (بالبايت)
  maxTime: number;       // الحد الأقصى للوقت (بالمللي ثانية)
  targetFormat: 'wav' | 'mp3'; // التنسيق المستهدف
}
```

### إعدادات مخصصة
```typescript
const customConfig: ChunkConfig = {
  maxChunks: 4,          // 4 chunks
  maxSize: 40960,        // 40KB
  maxTime: 2500,         // 2.5 ثانية
  targetFormat: 'mp3'    // تحويل إلى MP3
};
```

## استكشاف الأخطاء

### مشكلة: ffmpeg.wasm لا يتحمل
**الحل**:
1. تأكد من تثبيت المكتبات بشكل صحيح
2. تحقق من اتصال الإنترنت (يحتاج لتحميل الملفات)
3. تحقق من console للأخطاء

### مشكلة: تحويل الصوت فشل
**الحل**:
1. النظام يستخدم fallback للصيغة الأصلية
2. تحقق من حجم البيانات (يجب أن تكون > 1KB)
3. تحقق من نوع البيانات الصوتية

### مشكلة: تأخير في التحويل
**الحل**:
1. قلل `maxChunks` أو `maxSize`
2. استخدم `HIGH_PERFORMANCE_CONFIG`
3. تحقق من أداء المتصفح

## مقارنة الأداء

| الإعداد | maxChunks | maxSize | maxTime | الاستخدام |
|---------|-----------|---------|---------|-----------|
| **الأداء العالي** | 3 | 25KB | 2s | للتفاعل السريع |
| **الافتراضي** | 5 | 50KB | 3s | للتوازن |
| **الاستقرار العالي** | 8 | 100KB | 5s | للجودة العالية |

## ملاحظات مهمة

### ⚠️ حدود النظام
- ffmpeg.wasm يحتاج لتحميل أول مرة (1-2MB)
- التحويل يستغرق وقت (100-500ms حسب الحجم)
- يستهلك ذاكرة أكثر من النظام السابق

### 🔧 تحسينات مستقبلية
1. **تحميل مسبق**: تحميل ffmpeg.wasm عند بدء التطبيق
2. **تحويل متوازي**: معالجة عدة chunks في نفس الوقت
3. **ضغط إضافي**: ضغط البيانات قبل التحويل
4. **تخزين مؤقت**: تخزين النتائج المحولة

### 📊 مؤشرات النجاح
- عدم ظهور أخطاء `InvalidDataError`
- تحويل ناجح للصوت إلى WAV
- استقرار في البث المباشر
- تحسن في سرعة الاستجابة من الخادم 