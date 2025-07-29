@echo off
echo ========================================
echo    إصلاح مبسط للويب - يحافظ على البيانات
echo ========================================
echo.

echo [1/4] إيقاف التطبيق الحالي...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo [2/4] تطبيق إصلاح قاعدة البيانات المبسط...
echo.
echo ⚠️  يرجى تطبيق ملف fix_subscription_simple.sql في Supabase Dashboard
echo.
echo 1. اذهب إلى Supabase Dashboard > SQL Editor
echo 2. انسخ محتوى ملف fix_subscription_simple.sql
echo 3. الصق الكود واضغط Run
echo 4. انتظر حتى تظهر "Simple database fix completed successfully!"
echo 5. ستظهر رسالة "Total records preserved: [عدد]" لتأكيد حفظ البيانات
echo.
echo ✅ هذا الإصلاح سيحافظ على جميع المشتركين الحاليين
echo ✅ لا يستخدم ON CONFLICT لتجنب الأخطاء
echo.
pause

echo [3/4] اختبار الاتصال...
node fix_web_connection.js
if %errorlevel% neq 0 (
    echo ❌ فشل اختبار الاتصال
    echo يرجى التأكد من تطبيق SQL fix
    pause
    exit /b 1
)

echo [4/4] إعادة تشغيل التطبيق...
npx expo start --clear --web --port 8081

echo.
echo ✅ التطبيق يعمل على http://localhost:8081
echo.
echo 📋 للتحقق من الإصلاح:
echo 1. افتح المتصفح على http://localhost:8081
echo 2. تأكد من عدم وجود أخطاء 406 في Console
echo 3. يجب أن تظهر صفحة التسجيل
echo 4. جميع المشتركين الحاليين محفوظين
echo.
pause 