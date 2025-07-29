@echo off
echo ========================================
echo    إصلاح مشاكل الويب - Live Translate
echo ========================================
echo.

echo [1/4] فحص متغيرات البيئة...
if not exist ".env" (
    echo ❌ ملف .env غير موجود
    echo يرجى إنشاء ملف .env مع متغيرات Supabase
    pause
    exit /b 1
)

echo ✅ ملف .env موجود

echo.
echo [2/4] اختبار الاتصال بقاعدة البيانات...
node fix_web_connection.js
if %errorlevel% neq 0 (
    echo ❌ فشل اختبار الاتصال
    echo يرجى تطبيق SQL fix في Supabase Dashboard
    pause
    exit /b 1
)

echo ✅ اختبار الاتصال نجح

echo.
echo [3/4] تنظيف الكاش...
npx expo start --clear --web --port 8081
if %errorlevel% neq 0 (
    echo ❌ فشل في تشغيل التطبيق
    pause
    exit /b 1
)

echo.
echo [4/4] إعادة تشغيل التطبيق...
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 للتحقق من الإصلاح:
echo 1. افتح المتصفح على http://localhost:8081
echo 2. تأكد من ظهور صفحة التسجيل
echo 3. تحقق من Console (F12) للتأكد من عدم وجود أخطاء
echo.
echo 🎯 إذا استمرت المشكلة:
echo - اذهب إلى Supabase Dashboard > SQL Editor
echo - انسخ محتوى fix_web_white_screen.sql
echo - الصق الكود واضغط Run
echo.
pause 