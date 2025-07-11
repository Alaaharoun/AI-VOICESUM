# دليل حل مشاكل البناء - Expo Go vs EAS Build

## لماذا يعمل Expo Go ولا يعمل EAS Build؟

### 1. **الفرق الأساسي:**

#### Expo Go (Development):
- ✅ **بيئة محدودة** - يدعم APIs الأساسية فقط
- ✅ **لا يحتاج تكوين Native** معقد
- ✅ **مكتبات محدودة** - لا يدعم جميع المكتبات
- ✅ **بناء سريع** - لا يحتاج compile Native code

#### EAS Build (Production):
- ❌ **بناء كامل** مع جميع Native Modules
- ❌ **يتطلب تكوين Android** صحيح
- ❌ **يدعم جميع المكتبات** (بما فيها المعقدة)
- ❌ **يتعرض لمشاكل التوافق** أكثر

### 2. **المشاكل المحتملة وحلولها:**

#### أ) مشاكل المكتبات Native:
```bash
# المكتبات التي قد تسبب مشاكل:
- react-native-audio-recorder-player
- @react-native-community/voice
- ffmpeg-static
```

**الحل:**
- تأكد من وجود `react-native.config.js`
- تحقق من `android/app/build.gradle`
- أضف excludes للمكتبات القديمة

#### ب) مشاكل التوافق:
```bash
# إصدارات قد تسبب مشاكل:
- React Native 0.79.5
- Expo SDK 53
- Android SDK 34
```

**الحل:**
- تحديث `app.config.js` مع إعدادات Android صحيحة
- تحسين `eas.json` مع buildTypes مناسبة
- إضافة `metro.config.js` و `babel.config.js`

### 3. **خطوات الحل:**

#### الخطوة 1: تنظيف المشروع
```bash
# حذف node_modules و reinstall
rm -rf node_modules
npm install

# تنظيف cache
npx expo start --clear
```

#### الخطوة 2: بناء Development Build
```bash
# بناء development build أولاً
eas build --platform android --profile development
```

#### الخطوة 3: بناء Preview Build
```bash
# بناء preview build للاختبار
eas build --platform android --profile preview
```

#### الخطوة 4: بناء Production Build
```bash
# بناء production build
eas build --platform android --profile production
```

### 4. **ملفات التكوين المهمة:**

#### `app.config.js`:
- إضافة `compileSdkVersion: 34`
- إضافة `targetSdkVersion: 34`
- إضافة permissions كاملة

#### `eas.json`:
- تحديد `buildType: "apk"` للاختبار
- تحديد `buildType: "aab"` للإنتاج

#### `android/app/build.gradle`:
- إضافة excludes للمكتبات القديمة
- تحسين configurations

### 5. **نصائح إضافية:**

#### أ) تحسين الذاكرة:
```bash
# في android/gradle.properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

#### ب) تحسين السرعة:
```bash
# في android/gradle.properties
org.gradle.parallel=true
org.gradle.daemon=true
```

#### ج) حل مشاكل Network:
```bash
# استخدام VPN أو تغيير DNS
# أو محاولة البناء في وقت مختلف
```

### 6. **أوامر التشخيص:**

```bash
# فحص التكوين
npx expo doctor

# فحص المكتبات
npx expo install --fix

# فحص Android
cd android && ./gradlew clean

# بناء محلي للاختبار
npx expo run:android
```

### 7. **متى تستخدم كل نوع:**

#### Expo Go:
- ✅ تطوير سريع
- ✅ اختبار APIs الأساسية
- ✅ لا تحتاج تكوين معقد

#### EAS Build:
- ✅ بناء للإنتاج
- ✅ دعم جميع المكتبات
- ✅ نشر على Google Play
- ✅ اختبار الأداء الحقيقي

### 8. **استراتيجية التطوير الموصى بها:**

1. **ابدأ بـ Expo Go** للتطوير السريع
2. **انتقل إلى Development Build** عند الحاجة لمكتبات Native
3. **استخدم Preview Build** للاختبار الشامل
4. **استخدم Production Build** للنشر النهائي

### 9. **مشاكل شائعة وحلولها:**

#### مشكلة: "Duplicate class found"
**الحل:** إضافة excludes في `build.gradle`

#### مشكلة: "Network timeout"
**الحل:** استخدام VPN أو محاولة في وقت مختلف

#### مشكلة: "Memory limit exceeded"
**الحل:** زيادة `org.gradle.jvmargs`

#### مشكلة: "Permission denied"
**الحل:** إضافة permissions في `app.config.js`

---

**ملاحظة:** إذا استمرت المشاكل، جرب بناء Development Build أولاً قبل الانتقال إلى Production Build. 