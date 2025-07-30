# 🔧 Server Connection Diagnostic Guide

## المشكلة
التطبيق يعمل بشكل صحيح من جانب العميل، لكن لا تظهر أي سجلات في السيرفر وكأننا لا نرسل أي بيانات صوتية فعليًا.

## الأدوات المتاحة للتشخيص

### 1. أداة التشخيص التفاعلية
```
test-server-connection.html
```
- اختبار صحة السيرفر
- اختبار اتصال WebSocket
- اختبار إرسال البيانات الصوتية
- سجلات فورية مفصلة

### 2. السيرفر المحسن
```
deploy-improved-server.js
```
- سجلات مفصلة لجميع الرسائل
- معلومات تفصيلية عن البيانات الصوتية
- معالجة الأخطاء مع تفاصيل كاملة

## خطوات التشخيص

### الخطوة 1: تشغيل السيرفر المحسن
```bash
cd AILIVETRANSLATEWEB
node deploy-improved-server.js
```

### الخطوة 2: اختبار الاتصال
1. افتح `test-server-connection.html` في المتصفح
2. اضغط على "Test Health Check"
3. اضغط على "Test WebSocket"
4. اضغط على "Send Test Audio"

### الخطوة 3: مراقبة السجلات
راقب سجلات السيرفر للحصول على:
- `[WebSocket] 📥 Received message from client`
- `[WebSocket] 🎵 Processing audio message...`
- `[WebSocket] 📤 Writing audio buffer to Azure push stream...`

## المشاكل المحتملة والحلول

### المشكلة 1: لا تظهر سجلات الاتصال
**الأعراض:** لا تظهر رسائل `[WebSocket] 🔗 New client connected`

**الحلول:**
- تأكد من أن السيرفر يعمل على المنفذ الصحيح
- تحقق من إعدادات CORS
- تأكد من أن WebSocket endpoint صحيح

### المشكلة 2: لا تظهر سجلات الرسائل
**الأعراض:** لا تظهر رسائل `[WebSocket] 📥 Received message from client`

**الحلول:**
- تحقق من أن العميل يرسل الرسائل بالشكل الصحيح
- تأكد من أن WebSocket connection مفتوح
- تحقق من تنسيق الرسائل

### المشكلة 3: لا تظهر سجلات البيانات الصوتية
**الأعراض:** لا تظهر رسائل `[WebSocket] 🎵 Processing audio message...`

**الحلول:**
- تحقق من أن العميل يرسل رسائل `audio` type
- تأكد من أن البيانات مشفرة بـ base64
- تحقق من حجم البيانات الصوتية

### المشكلة 4: لا تظهر سجلات Azure
**الأعراض:** لا تظهر رسائل `[Azure Speech] 🔄 Partial result`

**الحلول:**
- تحقق من إعدادات Azure Speech Service
- تأكد من أن المفاتيح صحيحة
- تحقق من تنسيق البيانات الصوتية

## معلومات إضافية للتشخيص

### سجلات العميل المتوقعة
```
📤 Sent message: {type: 'init', ...}
📤 Sent message: {type: 'audio', data: '...', format: 'audio/pcm'}
📤 Sent raw audio chunk (base64): 32768 bytes, format: audio/pcm
```

### سجلات السيرفر المتوقعة
```
[WebSocket] 🔗 New client connected
[WebSocket] 📥 Received message from client
[WebSocket] 📋 Parsed JSON message: init
[WebSocket] 🎵 Processing audio message...
[WebSocket] 📤 Writing audio buffer to Azure push stream...
[Azure Speech] 🔄 Partial result: "..."
```

### اختبار سريع
```javascript
// في console المتصفح
const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'init',
    language: 'auto',
    targetLanguage: 'en'
  }));
};
```

## الاتصال بالدعم
إذا استمرت المشكلة، يرجى تقديم:
1. سجلات السيرفر الكاملة
2. سجلات console المتصفح
3. نتائج اختبار `test-server-connection.html`
4. لقطة شاشة من واجهة التطبيق 