@echo off
echo ========================================
echo    فتح تطبيق Live Translate في الويب
echo ========================================
echo.

echo [1/3] فحص حالة التطبيق...
netstat -an | findstr :8081 > nul
if %errorlevel% neq 0 (
    echo ❌ التطبيق غير متاح على المنفذ 8081
    echo يرجى تشغيل: npx expo start --clear --web
    pause
    exit /b 1
)

echo ✅ التطبيق متاح على المنفذ 8081

echo.
echo [2/3] فتح المتصفح...
start http://localhost:8081

echo.
echo [3/3] فتح وحدة التحكم...
echo.
echo 📋 للتحقق من الإصلاح:
echo 1. تأكد من ظهور صفحة التسجيل
echo 2. اضغط F12 لفتح وحدة التحكم
echo 3. اذهب إلى تبويب Console
echo 4. تأكد من عدم وجود أخطاء 406
echo.
echo ✅ الرسائل المتوقعة في Console:
echo - [INFO] [EarlyConnection] Hugging Face connection established
echo - [INFO] [EarlyConnection] Early connections initialized successfully
echo - [Index] Hugging Face engine detected - WebSocket not needed
echo.
echo 🎯 إذا استمرت المشكلة:
echo - تحقق من Console للأخطاء
echo - تأكد من تطبيق SQL fix في Supabase
echo.
pause 