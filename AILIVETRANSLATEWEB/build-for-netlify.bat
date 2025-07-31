@echo off
echo 🚀 بدء بناء المشروع للنشر على Netlify...
echo.

echo 📋 التحقق من الملفات المطلوبة...
if exist "netlify.toml" (
    echo ✅ ملف netlify.toml موجود
) else (
    echo ❌ ملف netlify.toml غير موجود
    pause
    exit /b 1
)

if exist "public\_redirects" (
    echo ✅ ملف public\_redirects موجود
) else (
    echo ❌ ملف public\_redirects غير موجود
    pause
    exit /b 1
)

echo.
echo 🔨 بناء المشروع...
call npm run build

if %errorlevel% neq 0 (
    echo ❌ فشل في بناء المشروع
    pause
    exit /b 1
)

echo ✅ تم بناء المشروع بنجاح

if exist "dist" (
    echo ✅ مجلد dist موجود
    echo 📁 محتويات مجلد dist:
    dir dist
) else (
    echo ❌ مجلد dist غير موجود
    pause
    exit /b 1
)

echo.
echo 🎉 تم إكمال البناء بنجاح!
echo.
echo 📋 الخطوات التالية:
echo 1. ارفع مجلد dist إلى Netlify
echo 2. أو اربط repository بـ Netlify
echo.
echo 🔗 رابط Netlify: https://app.netlify.com/
echo.
pause 