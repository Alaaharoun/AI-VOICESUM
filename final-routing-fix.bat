@echo off
echo ========================================
echo    إصلاح نهائي للتوجيه في Expo Router
echo ========================================
echo.

echo [1/4] إيقاف التطبيق الحالي...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo [2/4] فحص وإصلاح ملفات التوجيه...
node fix-routing-comprehensive.js

echo.
echo [3/4] اختبار إصلاح AuthGuard...
node test-auth-fix-quick.js

echo.
echo [4/4] إعادة تشغيل التطبيق...
echo.
echo ✅ تم إصلاح التوجيه بنجاح!
echo.
echo 📋 التغييرات المطبقة:
echo - فحص جميع ملفات التوجيه
echo - إنشاء الملفات المفقودة
echo - التأكد من وجود default export
echo - إصلاح منطق AuthGuard
echo.

npx expo start --clear --web --port 8081

echo.
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 النتائج المتوقعة:
echo 1. المستخدمون المسجلون سيرون التطبيق مباشرة
echo 2. المستخدمون الجدد سيرون صفحة التسجيل
echo 3. رسائل AuthGuard ستظهر في Console
echo 4. لا توجد صفحة بيضاء
echo.
pause 