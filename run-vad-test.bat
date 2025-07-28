@echo off
echo 🚀 تشغيل اختبار Voice Activity Detection (VAD)
echo ================================================

echo.
echo 📋 قائمة التحقق السريعة:
echo.

echo 1. 🔌 تحقق من تشغيل الخدمة...
curl -s https://alaaharoun-faster-whisper-api.hf.space/health
if %errorlevel% neq 0 (
    echo ❌ الخدمة غير متاحة
    pause
    exit /b 1
)
echo ✅ الخدمة متاحة

echo.
echo 2. 🧪 تشغيل الاختبار السريع...
node quick-vad-test.js
if %errorlevel% neq 0 (
    echo ❌ فشل الاختبار السريع
    pause
    exit /b 1
)

echo.
echo 3. 🔍 تشغيل الاختبار الشامل...
node test-vad-comprehensive.js
if %errorlevel% neq 0 (
    echo ❌ فشل الاختبار الشامل
    pause
    exit /b 1
)

echo.
echo ✅ جميع الاختبارات مكتملة بنجاح!
echo 🎯 VAD يعمل بشكل صحيح
echo.
pause 