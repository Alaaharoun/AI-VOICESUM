# 🔧 Quick Diagnostic Guide

## المشكلة
التطبيق يعمل من جانب العميل لكن لا تظهر سجلات في السيرفر.

## الحل السريع

### 1. تشغيل السيرفر المحسن
```bash
cd AILIVETRANSLATEWEB
node deploy-improved-server.js
```

### 2. اختبار الاتصال
```bash
node quick-test.js
```

### 3. اختبار تفاعلي
افتح `test-server-connection.html` في المتصفح

## ما يجب مراقبته

### في سجلات السيرفر:
- `[WebSocket] 🔗 New client connected`
- `[WebSocket] 📥 Received message from client`
- `[WebSocket] 🎵 Processing audio message...`
- `[WebSocket] 📤 Writing audio buffer to Azure push stream...`

### في console المتصفح:
- `📤 Sent message: {type: 'init', ...}`
- `📤 Sent message: {type: 'audio', data: '...', format: 'audio/pcm'}`

## إذا لم تظهر السجلات:

1. **تحقق من الاتصال:**
   ```javascript
   // في console المتصفح
   const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
   ws.onopen = () => console.log('Connected!');
   ```

2. **تحقق من إرسال الرسائل:**
   ```javascript
   ws.send(JSON.stringify({
     type: 'init',
     language: 'auto',
     targetLanguage: 'en'
   }));
   ```

3. **تحقق من البيانات الصوتية:**
   ```javascript
   ws.send(JSON.stringify({
     type: 'audio',
     data: 'base64_audio_data',
     format: 'audio/pcm'
   }));
   ```

## المشاكل الشائعة:

1. **لا تظهر سجلات الاتصال** → تحقق من WebSocket endpoint
2. **لا تظهر سجلات الرسائل** → تحقق من تنسيق الرسائل
3. **لا تظهر سجلات الصوت** → تحقق من تنسيق البيانات الصوتية
4. **لا تظهر سجلات Azure** → تحقق من إعدادات Azure Speech Service

## للحصول على مساعدة إضافية:
- راجع `DIAGNOSTIC_GUIDE.md` للحصول على دليل مفصل
- استخدم `test-server-connection.html` للاختبار التفاعلي
- راقب سجلات السيرفر المحسن للحصول على تفاصيل أكثر 