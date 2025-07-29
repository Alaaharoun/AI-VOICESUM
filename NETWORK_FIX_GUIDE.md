# 🌐 دليل إصلاح مشاكل الاتصال

## 🔍 **المشاكل المكتشفة:**

### 1. **مشكلة DNS:**
```
Could not resolve host: huggingface.co
Could not resolve host: github.com
```

### 2. **مشكلة في مسار الملفات:**
```
File not found - *
0 File(s) copied
```

## 🛠️ **الحلول:**

### **الحل الأول: تغيير DNS**

#### Windows:
1. **افتح Network Settings:**
   - اضغط `Win + I`
   - اختر "Network & Internet"
   - اضغط "Change adapter options"

2. **تغيير DNS:**
   - اضغط بالزر الأيمن على "Wi-Fi" أو "Ethernet"
   - اختر "Properties"
   - اختر "Internet Protocol Version 4 (TCP/IPv4)"
   - اضغط "Properties"
   - اختر "Use the following DNS server addresses"
   - اكتب:
     - Preferred DNS: `8.8.8.8`
     - Alternate DNS: `8.8.4.4`
   - اضغط "OK"

### **الحل الثاني: استخدام VPN**

1. **قم بتشغيل VPN**
2. **اختبر الاتصال:**
   ```bash
   ping huggingface.co
   ping github.com
   ```

### **الحل الثالث: استخدام Proxy**

إذا كان لديك proxy في العمل:
1. **افتح Command Prompt كـ Administrator**
2. **اضبط Proxy:**
   ```bash
   git config --global http.proxy http://proxy.company.com:8080
   git config --global https.proxy https://proxy.company.com:8080
   ```

## 🚀 **الحل الأسهل: الواجهة الإلكترونية**

بدلاً من إصلاح مشاكل الاتصال، استخدم:

### **الخطوات:**
1. **اذهب إلى:** https://huggingface.co/spaces
2. **أنشئ Space جديد**
3. **ارفع الملفات يدوياً**

### **الملفات المطلوبة:**
- `app.py`
- `requirements.txt`
- `Dockerfile`
- `config.json`
- `README.md`
- `docker-compose.yml`
- `.dockerignore`

## ⏱️ **اختبار الاتصال:**

```bash
# اختبار DNS
nslookup huggingface.co
nslookup github.com

# اختبار الاتصال
ping huggingface.co
ping github.com

# اختبار HTTPS
curl -I https://huggingface.co
```

## 🎯 **التوصية:**

**استخدم الواجهة الإلكترونية** - إنها أسهل وأسرع من إصلاح مشاكل الاتصال! 