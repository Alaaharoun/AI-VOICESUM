# 🔗 دليل ربط التطبيق بخدمة Faster Whisper

## 📋 المتطلبات

### 1. **ملفات التكوين المطلوبة**
- `config.ts` - إعدادات API
- `fasterWhisperService.ts` - خدمة API
- `INTEGRATION_GUIDE.md` - هذا الدليل

### 2. **تحديث ملفات التطبيق**

## 🚀 خطوات الربط

### الخطوة 1: نسخ ملفات التكوين

انسخ الملفات التالية إلى مجلد `services/` في التطبيق الرئيسي:

```bash
# نسخ ملفات التكوين
cp faster_whisper_service/config.ts ../services/
cp faster_whisper_service/fasterWhisperService.ts ../services/
```

### الخطوة 2: تحديث SpeechService

أضف دعم Faster Whisper إلى `services/speechService.ts`:

```typescript
import { fasterWhisperService } from './fasterWhisperService';

export class SpeechService {
  // ... الكود الموجود ...

  /**
   * Transcribe audio using Faster Whisper
   */
  static async transcribeWithFasterWhisper(
    audioBlob: Blob, 
    targetLanguage?: string
  ): Promise<string> {
    try {
      console.log('🎤 Using Faster Whisper for transcription...');
      
      // Check service health first
      const health = await fasterWhisperService.healthCheck();
      console.log('✅ Faster Whisper service health:', health);
      
      // Transcribe audio
      const result = await fasterWhisperService.transcribeAudio(
        audioBlob, 
        targetLanguage
      );
      
      console.log('✅ Faster Whisper transcription successful:', {
        text: result.text,
        language: result.language,
        confidence: result.language_probability
      });
      
      return result.text;
    } catch (error) {
      console.error('❌ Faster Whisper transcription failed:', error);
      throw error;
    }
  }

  /**
   * Detect language using Faster Whisper
   */
  static async detectLanguageWithFasterWhisper(audioBlob: Blob): Promise<string> {
    try {
      console.log('🔍 Detecting language with Faster Whisper...');
      
      const result = await fasterWhisperService.detectLanguage(audioBlob);
      
      console.log('✅ Language detected:', {
        language: result.language,
        confidence: result.language_probability
      });
      
      return result.language;
    } catch (error) {
      console.error('❌ Language detection failed:', error);
      throw error;
    }
  }
}
```

### الخطوة 3: تحديث hooks/useAudioRecorder.ts

أضف دعم Faster Whisper إلى hook التسجيل:

```typescript
import { SpeechService } from '../services/speechService';

export const useAudioRecorder = () => {
  // ... الكود الموجود ...

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setTranscribing(true);
      
      // Try Faster Whisper first
      try {
        const transcription = await SpeechService.transcribeWithFasterWhisper(audioBlob);
        setTranscription(transcription);
        return;
      } catch (fasterWhisperError) {
        console.warn('Faster Whisper failed, falling back to AssemblyAI:', fasterWhisperError);
      }
      
      // Fallback to AssemblyAI
      const transcription = await SpeechService.transcribeAudio(audioBlob);
      setTranscription(transcription);
    } catch (error) {
      console.error('Transcription failed:', error);
      setError(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  // ... باقي الكود ...
};
```

### الخطوة 4: تحديث app.config.js

أضف متغيرات البيئة للـ Faster Whisper:

```javascript
export default ({ config }) => ({
  // ... الإعدادات الموجودة ...
  extra: {
    // ... المتغيرات الموجودة ...
    
    // Faster Whisper Configuration
    FASTER_WHISPER_ENABLED: process.env.FASTER_WHISPER_ENABLED || 'true',
    FASTER_WHISPER_URL: process.env.FASTER_WHISPER_URL || 'https://alaaharoun-faster-whisper-api.hf.space',
    
    // API Token Configuration
    FASTER_WHISPER_API_TOKEN: process.env.FASTER_WHISPER_API_TOKEN || '',
    EXPO_PUBLIC_FASTER_WHISPER_API_TOKEN: process.env.EXPO_PUBLIC_FASTER_WHISPER_API_TOKEN || '',
    FASTER_WHISPER_REQUIRE_AUTH: process.env.FASTER_WHISPER_REQUIRE_AUTH || 'false',
    
    // ... باقي المتغيرات ...
  },
});
```

### الخطوة 5: تحديث ملف .env

أضف متغيرات البيئة الجديدة:

```env
# ... المتغيرات الموجودة ...

# Faster Whisper Service
FASTER_WHISPER_ENABLED=true
FASTER_WHISPER_URL=https://alaaharoun-faster-whisper-api.hf.space

# API Token (اختياري - للتحكم في الوصول)
FASTER_WHISPER_API_TOKEN=your_api_token_here
EXPO_PUBLIC_FASTER_WHISPER_API_TOKEN=your_api_token_here

# إعدادات الأمان
FASTER_WHISPER_REQUIRE_AUTH=false
```

## 🔐 إعدادات الأمان

### API Token Configuration

#### 1. **إنشاء API Token**
```bash
# إنشاء token عشوائي
openssl rand -hex 32
# أو استخدام أي string عشوائي
```

#### 2. **إعداد Token في البيئة**
```env
# في ملف .env
FASTER_WHISPER_API_TOKEN=your_generated_token_here
EXPO_PUBLIC_FASTER_WHISPER_API_TOKEN=your_generated_token_here
```

#### 3. **تفعيل الأمان (اختياري)**
```env
# تفعيل التحقق من Token
FASTER_WHISPER_REQUIRE_AUTH=true
```

#### 4. **اختبار الأمان**
```typescript
// التحقق من حالة الأمان
const apiStatus = fasterWhisperService.getApiStatus();
console.log('API Status:', apiStatus);
// Output: { hasToken: true, requiresAuth: true, isConfigured: true }
```

### استخدام API Token

#### **مع Token:**
```typescript
// سيتم إرسال Token تلقائياً
const result = await fasterWhisperService.transcribeAudio(audioFile);
```

#### **بدون Token (إذا لم يكن مطلوباً):**
```typescript
// سيعمل بدون Token إذا كان REQUIRE_AUTH=false
const result = await fasterWhisperService.transcribeAudio(audioFile);
```

## 🧪 اختبار الربط

### اختبار الاتصال

```typescript
// في أي مكون React Native
import { fasterWhisperService } from '../services/fasterWhisperService';

const testConnection = async () => {
  try {
    const health = await fasterWhisperService.healthCheck();
    console.log('✅ Service is healthy:', health);
  } catch (error) {
    console.error('❌ Service health check failed:', error);
  }
};
```

### اختبار التحويل

```typescript
const testTranscription = async () => {
  try {
    // إنشاء ملف صوتي تجريبي
    const testAudioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
    
    const result = await fasterWhisperService.transcribeAudio(testAudioBlob, 'en');
    console.log('✅ Transcription result:', result);
  } catch (error) {
    console.error('❌ Transcription test failed:', error);
  }
};
```

## 🔧 استكشاف الأخطاء

### مشاكل شائعة وحلولها

#### 1. **خطأ 404 - Service Not Found**
```bash
# تحقق من الرابط
curl https://alaaharoun-faster-whisper-api.hf.space/health
```

**الحل:** تأكد من أن السيرفر يعمل على Hugging Face Spaces

#### 2. **خطأ CORS**
```javascript
// إضافة headers مخصصة
const response = await fetch(url, {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }
});
```

#### 3. **خطأ Timeout**
```typescript
// زيادة timeout
const response = await fetch(url, {
  signal: AbortSignal.timeout(60000) // 60 seconds
});
```

#### 4. **خطأ File Size**
```typescript
// تحقق من حجم الملف
if (audioFile.size > 25 * 1024 * 1024) { // 25MB
  throw new Error('File too large');
}
```

## 📊 مراقبة الأداء

### إضافة Logging

```typescript
// في fasterWhisperService.ts
console.log('🚀 API Request:', {
  url: buildEndpointUrl(endpoint),
  method: 'POST',
  fileSize: audioFile.size,
  language: language || 'auto'
});

console.log('✅ API Response:', {
  status: response.status,
  success: result.success,
  textLength: result.text?.length || 0
});
```

### إضافة Metrics

```typescript
// تتبع الأداء
const startTime = Date.now();
const result = await fasterWhisperService.transcribeAudio(audioFile);
const duration = Date.now() - startTime;

console.log('📊 Performance:', {
  duration: `${duration}ms`,
  fileSize: `${audioFile.size / 1024}KB`,
  textLength: result.text.length
});
```

## 🔄 التبديل بين الخدمات

### إعداد Fallback Strategy

```typescript
const transcribeWithFallback = async (audioBlob: Blob) => {
  const services = [
    { name: 'Faster Whisper', fn: () => SpeechService.transcribeWithFasterWhisper(audioBlob) },
    { name: 'AssemblyAI', fn: () => SpeechService.transcribeAudio(audioBlob) },
    { name: 'Azure Speech', fn: () => SpeechService.transcribeWithAzure(audioBlob) }
  ];

  for (const service of services) {
    try {
      console.log(`🔄 Trying ${service.name}...`);
      const result = await service.fn();
      console.log(`✅ ${service.name} succeeded`);
      return result;
    } catch (error) {
      console.warn(`⚠️ ${service.name} failed:`, error);
      continue;
    }
  }
  
  throw new Error('All transcription services failed');
};
```

## 📱 تحديث واجهة المستخدم

### إضافة مؤشر الحالة

```typescript
const [serviceStatus, setServiceStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

useEffect(() => {
  const checkService = async () => {
    try {
      await fasterWhisperService.healthCheck();
      setServiceStatus('available');
    } catch (error) {
      setServiceStatus('unavailable');
    }
  };
  
  checkService();
}, []);
```

### عرض حالة الخدمة

```tsx
{serviceStatus === 'available' && (
  <Text style={styles.statusText}>✅ Faster Whisper Available</Text>
)}

{serviceStatus === 'unavailable' && (
  <Text style={styles.statusText}>⚠️ Using Fallback Service</Text>
)}
```

## 🎯 النتيجة النهائية

بعد اتباع هذه الخطوات، سيكون التطبيق قادراً على:

1. **✅ الاتصال بخدمة Faster Whisper**
2. **✅ التحويل من الصوت إلى النص**
3. **✅ اكتشاف اللغة تلقائياً**
4. **✅ التبديل التلقائي للخدمات البديلة**
5. **✅ مراقبة الأداء والحالة**

## 📞 الدعم

إذا واجهت أي مشاكل:

1. تحقق من سجلات Console
2. اختبر الاتصال بالسيرفر
3. تحقق من متغيرات البيئة
4. راجع دليل استكشاف الأخطاء 