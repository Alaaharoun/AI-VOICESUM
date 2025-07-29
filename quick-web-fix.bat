@echo off
echo ========================================
echo    إصلاح سريع للصفحة البيضاء في الويب
echo ========================================
echo.

echo [1/4] إيقاف التطبيق الحالي...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo [2/4] تنظيف الكاش...
npx expo start --clear --web --port 8081 --no-dev --minify

echo [3/4] فحص الملفات...
node fix-white-screen-web.js

echo [4/4] إعادة تشغيل التطبيق...
start http://localhost:8081

echo.
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 إذا كانت الصفحة لا تزال بيضاء:
echo 1. افتح Developer Tools (F12)
echo 2. اذهب إلى Console
echo 3. تحقق من وجود أخطاء
echo 4. جرب تسجيل الدخول من جديد
echo 5. تحقق من أن المستخدم مسجل دخول
echo.
pause 