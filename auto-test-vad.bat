@echo off
chcp 65001 >nul
echo 🤖 تشغيل اختبار VAD التلقائي
echo =================================
echo.

echo 📋 المهام التي سيتم تنفيذها تلقائياً:
echo.
echo 1. 🔍 فحص الخدمة
echo 2. 🧪 اختبار Transcribe بدون VAD
echo 3. 🎤 اختبار Transcribe مع VAD
echo 4. ⚙️ اختبار VAD Thresholds
echo 5. 📁 اختبار Audio Formats
echo 6. 🛡️ اختبار Error Handling
echo.

echo ⚠️ ملاحظة: سيتم تنفيذ جميع المهام تلقائياً
echo    ستظهر الإشعارات عند الانتهاء من كل مهمة
echo.

echo 🎯 بدء الاختبار التلقائي...
echo.

node VAD_TASK_MANAGER.js auto

echo.
echo ✅ انتهى الاختبار التلقائي
echo 📊 تحقق من النتائج أعلاه
pause 