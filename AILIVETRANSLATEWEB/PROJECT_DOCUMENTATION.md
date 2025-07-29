# توثيق مشروع Live Translation - Project Documentation

## 📋 شرح عمل LiveTranslation.tsx

### الوظائف الأساسية:

#### 1. **initializeStreamingService()**
```typescript
// تهيئة الاتصال مع الخدمة الصوتية
const initializeStreamingService = async () => {
  // إنشاء خدمة البث المباشر
  streamingServiceRef.current = new StreamingService();
  
  // الاتصال بخادم WebSocket
  await streamingServiceRef.current.connect(
    sourceLanguage,    // لغة المصدر
    targetLanguage,    // لغة الهدف
    engine,           // محرك النسخ (faster-whisper/azure)
    onTranscription,  // callback للنسخ
    onTranslation     // callback للترجمة
  );
};
```

#### 2. **startRecording()**
```typescript
// بدء التسجيل الصوتي
const startRecording = async () => {
  // طلب إذن الميكروفون
  const permission = await permissionHelper.requestMicrophonePermission();
  
  // تهيئة خدمة البث
  await initializeStreamingService();
  
  // بدء التسجيل
  const stream = await navigator.mediaDevices.getUserMedia({ audio: {...} });
  const mediaRecorder = new MediaRecorder(stream);
  
  // إرسال البيانات الصوتية للخادم
  mediaRecorder.ondataavailable = (event) => {
    streamingServiceRef.current?.sendAudioChunk(event.data);
  };
};
```

#### 3. **stopRecording()**
```typescript
// إيقاف التسجيل
const stopRecording = () => {
  mediaRecorderRef.current?.stop();
  streamingServiceRef.current?.disconnect();
  setIsRecording(false);
};
```

### الواجهة الرسومية:
- **زر Start/Stop:** زر دائري أزرق مع أيقونة ميكروفون
- **اختيار اللغات:** قوائم منسدلة للغة المصدر والهدف
- **محرك النسخ:** خيارات بين Hugging Face و Azure
- **عرض النتائج:** عرض النص المفرغ والترجمة في الوقت الفعلي

## 🗄️ قاعدة البيانات Supabase

### الجداول الأساسية:

#### 1. **users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subscription_plan TEXT DEFAULT 'free',
  daily_limit INTEGER DEFAULT 10,
  free_trial_expires_at TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE
);
```

#### 2. **subscriptions**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  plan_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. **audio_files**
```sql
CREATE TABLE audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  transcription TEXT,
  translation TEXT,
  source_language TEXT,
  target_language TEXT,
  engine TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. **app_settings**
```sql
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔌 APIs المستخدمة

### 1. **Faster Whisper API (التفريغ)**
```typescript
// Endpoint: https://alaaharoun-faster-whisper-api.hf.space/transcribe
// Method: POST
// Body: FormData with audio file
const transcribeAudio = async (audioFile: File, engine: string) => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('engine', engine);
  
  const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};
```

### 2. **Google Translate API (الترجمة المجانية)**
```typescript
// Endpoint: https://translation.googleapis.com/language/translate/v2
// Method: POST
// Headers: Authorization: Bearer {API_KEY}
const translateText = async (text: string, targetLang: string, sourceLang: string = 'auto') => {
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      target: targetLang,
      source: sourceLang
    })
  });
  
  return response.json();
};
```

### 3. **Qwen API (التلخيص)**
```typescript
// Endpoint: https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
// Method: POST
// Headers: Authorization: Bearer {QWEN_API_KEY}
const summarizeText = async (text: string) => {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: {
        messages: [{
          role: 'user',
          content: `Summarize this text: ${text}`
        }]
      }
    })
  });
  
  return response.json();
};
```

## 🏗️ هيكلية صفحات الموقع

### 1. **الصفحة الرئيسية (Home)**
- عرض الميزات الرئيسية
- أزرار التسجيل والدخول
- عرض الإحصائيات

### 2. **صفحة Live Translation**
- تسجيل صوتي مباشر
- ترجمة فورية
- اختيار اللغات
- عرض النتائج

### 3. **صفحة Upload**
- رفع ملفات صوتية
- معالجة الملفات
- عرض النتائج

### 4. **صفحة History**
- عرض الملفات السابقة
- إمكانية التحميل
- البحث والتصفية

### 5. **صفحة Profile**
- معلومات المستخدم
- إدارة الاشتراك
- الإعدادات

### 6. **صفحة Subscription**
- خطط الاشتراك
- الدفع
- إدارة الحساب

## 🔧 الإعدادات الحالية

### 1. **Hugging Face Spaces**
```typescript
// URL: https://alaaharoun-faster-whisper-api.hf.space
// WebSocket: wss://alaaharoun-faster-whisper-api.hf.space/ws (غير مدعوم)
// HTTP: https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

### 2. **Azure Speech Service**
```typescript
// يحتاج إلى API Key من Azure
// WebSocket URL يتم إنشاؤه ديناميكياً
const getAzureWebSocketUrl = () => {
  return `wss://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
};
```

### 3. **Google Translate**
```typescript
// API Key مطلوب
// مجاني لحد معين
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
```

## ⚠️ المشكلة الحالية

### WebSocket لا يعمل على Hugging Face Spaces
```
Error: WebSocket connection to 'wss://alaaharoun-faster-whisper-api.hf.space/ws' failed
```

### السبب:
- Hugging Face Spaces لا يدعم WebSocket افتراضياً
- يحتاج إلى FastAPI + WebSocket handler
- أو Gradio + custom WebSocket handler

### الحلول المقترحة:

#### 1. **إضافة WebSocket إلى الخادم**
```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            # استقبال البيانات الصوتية
            audio_data = await websocket.receive_bytes()
            
            # معالجة الصوت
            transcription = process_audio(audio_data)
            
            # إرسال النتيجة
            await websocket.send_text(transcription)
        except Exception as e:
            break
```

#### 2. **استخدام REST API بدلاً من WebSocket**
```typescript
// تحويل الكود لاستخدام HTTP requests
const sendAudioChunk = async (audioChunk: Blob) => {
  const formData = new FormData();
  formData.append('audio', audioChunk);
  
  const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};
```

## 📁 ملفات المشروع الحالي

### هيكل المجلدات:
```
AILIVETRANSLATEWEB/
├── src/
│   ├── pages/
│   │   ├── LiveTranslation.tsx
│   │   ├── Upload.tsx
│   │   ├── History.tsx
│   │   ├── Profile.tsx
│   │   └── Subscription.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── streamingService.ts
│   │   └── translationService.ts
│   ├── components/
│   │   ├── Header.tsx
│   │   └── AuthGuard.tsx
│   ├── lib/
│   │   └── supabase.ts
│   └── stores/
│       └── authStore.ts
├── public/
├── package.json
└── vite.config.ts
```

### الملفات الرئيسية:
- `LiveTranslation.tsx` - صفحة الترجمة المباشرة
- `streamingService.ts` - خدمة البث المباشر
- `api.ts` - خدمات API
- `supabase.ts` - إعداد قاعدة البيانات

## 🚀 الخطوات التالية

### 1. إصلاح WebSocket
- إضافة WebSocket handler إلى الخادم
- أو تحويل الكود لاستخدام REST API

### 2. تحسين الأداء
- إضافة caching
- تحسين معالجة الأخطاء
- إضافة loading states

### 3. إضافة ميزات جديدة
- دعم لغات إضافية
- تحسين دقة الترجمة
- إضافة ميزات متقدمة 