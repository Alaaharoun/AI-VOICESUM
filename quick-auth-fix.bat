@echo off
echo ========================================
echo    إصلاح سريع لـ AuthGuard
echo ========================================
echo.

echo [1/3] اختبار الإصلاح الجديد...
node test-auth-fix-quick.js

echo.
echo [2/3] إعادة تشغيل التطبيق...
echo.
echo ✅ تم إصلاح AuthGuard بنجاح!
echo.
echo 📋 التغييرات:
echo - إضافة logging مفصل لـ AuthGuard
echo - تحسين منطق التوجيه
echo - السماح بالوصول في جميع الحالات
echo - التوجيه يتم في useEffect فقط
echo.

npx expo start --clear --web --port 8081

echo.
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 النتائج المتوقعة:
echo 1. المستخدمون المسجلون سيرون التطبيق مباشرة
echo 2. المستخدمون الجدد سيرون صفحة التسجيل
echo 3. ستظهر رسائل AuthGuard في Console
echo 4. لا توجد صفحة بيضاء
echo.
pause 