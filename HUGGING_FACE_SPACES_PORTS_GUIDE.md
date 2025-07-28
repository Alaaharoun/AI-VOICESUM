# 🔧 دليل منافذ Hugging Face Spaces

## 📋 فهم كيفية عمل Hugging Face Spaces

### 🎯 المبدأ الأساسي

**Hugging Face Spaces يدير البنية التحتية تلقائياً** - لا تحتاج لتحديد المنافذ في العميل (client).

### ✅ كيف يعمل الخادم:

1. **التشغيل الداخلي**: الخادم يعمل داخلياً على المنفذ `7860`
2. **إعادة التوجيه التلقائي**: Hugging Face يعيد توجيه المنفذ تلقائياً
3. **النطاق العام**: يتم الوصول عبر رابط عام بدون منفذ

## 🔧 الإعدادات الصحيحة

### 1. في ملف الخادم (`app.py`)

```python
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Faster Whisper Service on port 7860...")
    uvicorn.run(app, host="0.0.0.0", port=7860)
```

### 2. في Dockerfile

```dockerfile
# Expose port (Hugging Face Spaces uses 7860 internally)
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
```

### 3. في التطبيق (Client)

```typescript
// ✅ صحيح - لا حاجة للمنفذ
const url = 'https://alaaharoun-faster-whisper-api.hf.space';

// ❌ خطأ - لا تضيف منفذ
const url = 'https://alaaharoun-faster-whisper-api.hf.space:7860';
```

## 🌐 روابط الوصول

### ✅ الروابط الصحيحة:

```bash
# Health Check
https://alaaharoun-faster-whisper-api.hf.space/health

# Transcribe
https://alaaharoun-faster-whisper-api.hf.space/transcribe

# Root
https://alaaharoun-faster-whisper-api.hf.space/
```

### ❌ الروابط الخاطئة:

```bash
# لا تضيف منفذ
https://alaaharoun-faster-whisper-api.hf.space:7860/health
https://alaaharoun-faster-whisper-api.hf.space:8000/health
```

## 🔍 اختبار الاتصال

### 1. اختبار Health Endpoint

```bash
curl https://alaaharoun-faster-whisper-api.hf.space/health
```

**النتيجة المتوقعة:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "service": "faster-whisper",
  "auth_required": false,
  "auth_configured": false
}
```

### 2. اختبار في المتصفح

افتح الرابط مباشرة:
```
https://alaaharoun-faster-whisper-api.hf.space/health
```

## 📱 في التطبيق

### ✅ الكود الصحيح:

```typescript
// في services/transcriptionEngineService.ts
if (engine === 'huggingface') {
  config.huggingFaceUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
}

// في services/speechService.ts
const response = await fetch(`${config.huggingFaceUrl}/transcribe`, {
  method: 'POST',
  body: formData,
  signal: AbortSignal.timeout(60000),
});
```

## 🚨 أخطاء شائعة

### 1. إضافة منفذ في العميل
```typescript
// ❌ خطأ
const url = 'https://alaaharoun-faster-whisper-api.hf.space:7860';

// ✅ صحيح
const url = 'https://alaaharoun-faster-whisper-api.hf.space';
```

### 2. استخدام منفذ خاطئ في الخادم
```python
# ❌ خطأ - قد لا يعمل في Hugging Face Spaces
uvicorn.run(app, host="0.0.0.0", port=8000)

# ✅ صحيح - المنفذ القياسي لـ Hugging Face Spaces
uvicorn.run(app, host="0.0.0.0", port=7860)
```

## 🔧 التطوير المحلي

### للتطوير المحلي فقط:

```typescript
// في config.ts
LOCAL_URL: 'http://localhost:7860',  // للتطوير المحلي
PRODUCTION_URL: 'https://alaaharoun-faster-whisper-api.hf.space',  // للإنتاج
```

### تشغيل محلي:

```bash
# تشغيل الخادم محلياً
uvicorn app:app --host 0.0.0.0 --port 7860

# اختبار محلي
curl http://localhost:7860/health
```

## 📊 ملخص المنافذ

| البيئة | المنفذ الداخلي | الرابط العام |
|--------|----------------|--------------|
| Hugging Face Spaces | 7860 | لا حاجة لمنفذ |
| التطوير المحلي | 7860 | localhost:7860 |
| Docker محلي | 7860 | localhost:7860 |

## ✅ النتيجة النهائية

**لا تحتاج لتحديد المنفذ في العميل عند استخدام Hugging Face Spaces**

- الخادم يعمل داخلياً على المنفذ `7860`
- Hugging Face يدير إعادة التوجيه تلقائياً
- استخدم الرابط مباشرة بدون منفذ

---

**🎯 تذكر: Hugging Face Spaces يدير البنية التحتية تلقائياً!** 