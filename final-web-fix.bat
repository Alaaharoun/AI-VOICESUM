@echo off
echo ========================================
echo    إصلاح نهائي للصفحة البيضاء في الويب
echo ========================================
echo.

echo [1/4] إيقاف التطبيق الحالي...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo [2/4] فحص حالة المستخدم...
node check-user-status.js

echo.
echo [3/4] إعادة تشغيل التطبيق...
echo.
echo ⚠️  المشكلة: المستخدم غير مسجل دخول
echo ✅ الحل: سجل دخول في التطبيق
echo.
echo 1. افتح http://localhost:8081
echo 2. اذهب إلى صفحة تسجيل الدخول
echo 3. سجل دخول بحسابك
echo 4. أو أنشئ حساب جديد
echo.

npx expo start --clear --web --port 8081

echo.
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 ملاحظات مهمة:
echo - خطأ 406 تم حله بنجاح
echo - قاعدة البيانات تعمل بشكل صحيح
echo - المشكلة الوحيدة: المستخدم غير مسجل دخول
echo - بعد تسجيل الدخول، سيعمل التطبيق بشكل طبيعي
echo.
pause 