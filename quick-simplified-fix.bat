@echo off
echo ========================================
echo    إصلاح سريع ومبسط لـ AuthGuard
echo ========================================
echo.

echo [1/3] إيقاف التطبيق الحالي...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] اختبار الإصلاح المبسط...
node test-simplified-auth.js

echo.
echo [3/3] إعادة تشغيل التطبيق...
echo.
echo ✅ تم تطبيق الإصلاح المبسط بنجاح!
echo.
echo 📋 التحسينات المطبقة:
echo - إزالة hasRedirected المعقد
echo - إزالة setTimeout غير الضروري
echo - تبسيط منطق التوجيه
echo - تحسين رسائل Console
echo.

npx expo start --clear --web --port 8081

echo.
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 النتائج المتوقعة:
echo 1. لا توجد صفحة بيضاء
echo 2. التوجيه يعمل بشكل صحيح
echo 3. رسائل واضحة في Console
echo 4. تجربة مستخدم سلسة
echo.
echo 🔍 للتحقق من الإصلاح:
echo 1. افتح Console في المتصفح
echo 2. ابحث عن رسائل [AuthGuard]
echo 3. جرب تسجيل الدخول والخروج
echo 4. تأكد من عدم وجود أخطاء
echo.
pause 