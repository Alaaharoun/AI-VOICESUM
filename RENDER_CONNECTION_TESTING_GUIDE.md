# دليل اختبار الاتصال مع Render WebSocket

## 📋 نظرة عامة

هذا الدليل يوضح كيفية اختبار الاتصال بين التطبيق والسيرفر على Render باستخدام WebSocket.

## 🛠️ أدوات الاختبار المتاحة

### 1. اختبار شامل للاتصال
```bash
node test-render-websocket-connection.js
```
**الميزات:**
- اختبار HTTP Health Check
- اختبار WebSocket Connection
- اختبار Ping/Pong
- تقرير مفصل بالنتائج

### 2. اختبار سريع
```bash
node quick-render-status-check.js
```
**الميزات:**
- فحص سريع لحالة السيرفر
- نتائج فورية
- مناسب للفحص السريع

### 3. مراقبة مستمرة
```bash
node monitor-render-connection.js
```
**الميزات:**
- مراقبة مستمرة كل 30 ثانية
- إحصائيات مفصلة
- تتبع حالة الاتصال عبر الزمن

### 4. اختبار من المتصفح
افتح الملف `test-render-websocket-browser.html` في المتصفح

## 📊 تفسير النتائج

### ✅ النتائج الإيجابية
```
🎯 Overall Status: ✅ CONNECTED
✅ السيرفر على Render يعمل بشكل صحيح
```

**معنى النتائج:**
- **HTTP Health: PASS** - السيرفر يستجيب لطلبات HTTP
- **WebSocket Connection: PASS** - يمكن الاتصال بـ WebSocket
- **Ping/Pong: PASS** - السيرفر يستجيب لرسائل Ping

### ❌ النتائج السلبية
```
🎯 Overall Status: ❌ DISCONNECTED
❌ هناك مشاكل في الاتصال مع Render WebSocket
```

**الأسباب المحتملة:**
1. السيرفر غير متاح على Render
2. مشاكل في متغيرات البيئة
3. أخطاء في الكود
4. مشاكل في الشبكة

## 🔧 استكشاف الأخطاء

### 1. فحص حالة السيرفر على Render
- تحقق من لوحة تحكم Render
- راجع سجلات الأخطاء
- تأكد من أن السيرفر يعمل

### 2. فحص متغيرات البيئة
```bash
# تحقق من وجود المفاتيح المطلوبة
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=westeurope
```

### 3. فحص سجلات السيرفر
```bash
# في Render Dashboard
# اذهب إلى Logs لرؤية الأخطاء
```

### 4. اختبار الاتصال المحلي
```bash
# إذا كان السيرفر يعمل محلياً
node test-local-websocket.js
```

## 📈 مراقبة الأداء

### استخدام المراقب المستمر
```bash
node monitor-render-connection.js
```

**المخرجات:**
```
✅ [2025-07-31T06:32:13.164Z] HTTP: OK, WS: OK, Ping: 🏓, Response: 245ms
✅ [2025-07-31T06:32:43.164Z] HTTP: OK, WS: OK, Ping: 🏓, Response: 198ms
```

### إحصائيات المراقبة
```
📊 === إحصائيات المراقبة ===
📈 Total Checks: 50
✅ Successful: 48
❌ Failed: 2
📊 Uptime: 96.00%
📈 Recent Uptime (last 10): 100.00%
```

## 🚀 أفضل الممارسات

### 1. اختبار دوري
```bash
# أضف إلى cron job للفحص الدوري
*/5 * * * * node quick-render-status-check.js
```

### 2. مراقبة مستمرة في الإنتاج
```bash
# تشغيل المراقب في الخلفية
nohup node monitor-render-connection.js > connection.log 2>&1 &
```

### 3. تنبيهات تلقائية
```javascript
// إضافة تنبيهات عند فشل الاتصال
if (!result.httpHealth || !result.websocketConnection) {
  // إرسال تنبيه عبر email أو Slack
  sendAlert('Render connection failed');
}
```

## 🔍 فحص شامل

### اختبار جميع المكونات
```bash
# 1. اختبار HTTP
curl https://ai-voicesum.onrender.com/health

# 2. اختبار WebSocket
node test-websocket-connection.js

# 3. اختبار الصوت
node test-audio-processing.js

# 4. اختبار الترجمة
node test-translation-service.js
```

## 📝 سجلات الأخطاء الشائعة

### 1. خطأ الاتصال
```
❌ WebSocket error: connect ECONNREFUSED
```
**الحل:** تحقق من أن السيرفر يعمل على Render

### 2. خطأ المفاتيح
```
❌ Azure Speech credentials missing
```
**الحل:** تأكد من تعيين متغيرات البيئة

### 3. خطأ التوقيت
```
⏰ WebSocket test timeout
```
**الحل:** تحقق من استجابة السيرفر ووقت الاستجابة

## 🎯 نصائح للتحسين

### 1. تحسين وقت الاستجابة
- استخدم CDN للتحميل السريع
- ضغط البيانات المرسلة
- تحسين حجم رسائل WebSocket

### 2. تحسين الموثوقية
- إضافة إعادة المحاولة التلقائية
- تنفيذ آلية failover
- مراقبة مستمرة للأداء

### 3. تحسين الأمان
- استخدام WSS (WebSocket Secure)
- التحقق من صحة البيانات
- حماية من هجمات DDoS

## 📞 الدعم

إذا واجهت مشاكل في الاتصال:

1. **تحقق من السجلات** - راجع سجلات Render
2. **اختبر الاتصال** - استخدم أدوات الاختبار المذكورة
3. **تحقق من الإعدادات** - تأكد من صحة متغيرات البيئة
4. **راجع الكود** - تأكد من صحة إعدادات WebSocket

## 🔗 روابط مفيدة

- [Render Documentation](https://render.com/docs)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Azure Speech Service](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/)

---

**آخر تحديث:** 31 يوليو 2025
**الإصدار:** 1.0.0 