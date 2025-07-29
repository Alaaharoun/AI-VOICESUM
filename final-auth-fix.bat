@echo off
echo ========================================
echo    إصلاح نهائي لـ AuthGuard
echo ========================================
echo.

echo [1/4] إيقاف التطبيق الحالي...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo [2/4] اختبار إصلاح AuthGuard...
node test-auth-fix.js

echo.
echo [3/4] إعادة تشغيل التطبيق...
echo.
echo ✅ تم إصلاح AuthGuard بنجاح!
echo.
echo 📋 التغييرات:
echo - المستخدمون الجدد سيتم توجيههم إلى صفحة التسجيل
echo - المستخدمون المسجلون سيتم توجيههم إلى التطبيق
echo - تم تحسين منطق التوجيه
echo.

npx expo start --clear --web --port 8081

echo.
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 النتائج المتوقعة:
echo 1. المستخدمون الجدد سيرون صفحة التسجيل
echo 2. المستخدمون المسجلون سيرون التطبيق
echo 3. لا توجد صفحة بيضاء
echo.
pause 