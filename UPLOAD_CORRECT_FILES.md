# 📁 دليل رفع الملفات الصحيحة

## ❌ **الملفات التي تم حذفها:**
- ✅ `README.docker.md` - تم حذفه
- ❌ `config.ts` - يجب حذفه واستبداله بـ `config.json`

## ✅ **الملفات المطلوبة للرفع:**

### **من مجلد `faster-whisper-api/`:**
1. **README.md** (9.71 kB) - يحتوي على التكوين الصحيح
2. **config.json** (49 Bytes) - ملف التكوين الجديد
3. **app.py** (10.9 kB) - التطبيق الرئيسي
4. **requirements.txt** (105 Bytes) - التبعيات
5. **Dockerfile** (888 Bytes) - تكوين Docker
6. **docker-compose.yml** (453 Bytes) - للتطوير المحلي
7. **.dockerignore** (447 Bytes) - لتحسين البناء

## 🚨 **المشكلة الحالية:**

**`config.ts` موجود بدلاً من `config.json`!**

### **الحل:**
1. **احذف `config.ts`** من Hugging Face Spaces
2. **ارفع `config.json`** بدلاً منه

## 📋 **خطوات الرفع:**

### **الخطوة 1: حذف الملفات الخاطئة**
- احذف `README.docker.md` ✅ (تم)
- احذف `config.ts` ❌ (يجب حذفه)

### **الخطوة 2: رفع الملفات الصحيحة**
1. **config.json** (أولاً - ملف التكوين)
2. **README.md** (ثانياً - يحتوي على YAML)
3. **app.py**
4. **requirements.txt**
5. **Dockerfile**
6. **docker-compose.yml**
7. **.dockerignore**

## 🔍 **تأكد من محتوى config.json:**

```json
{
  "sdk": "docker",
  "app_file": "app.py"
}
```

## ⏱️ **بعد الرفع:**

1. **انتظر 5-10 دقائق** لبناء Docker
2. **تحقق من "Settings" > "Build logs"**
3. **اختبر الخدمة:**
   ```bash
   curl https://alaaharoun-faster-whisper-api.hf.space/health
   ```

## 🎯 **النتيجة المتوقعة:**

بعد رفع الملفات الصحيحة:
- ✅ لا مزيد من "configuration error"
- ✅ لا مزيد من "Missing configuration in README"
- ✅ Space يعمل بشكل صحيح

**الآن ارفع `config.json` بدلاً من `config.ts`!** 🚀 