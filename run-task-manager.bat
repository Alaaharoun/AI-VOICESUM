@echo off
chcp 65001 >nul
echo 🚀 تشغيل نظام إدارة مهام Voice Activity Detection (VAD)
echo ========================================================
echo.

echo 📋 المهام المتاحة:
echo.
echo 1. 🔍 فحص الخدمة
echo 2. 🧪 اختبار Transcribe بدون VAD
echo 3. 🎤 اختبار Transcribe مع VAD
echo 4. ⚙️ اختبار VAD Thresholds
echo 5. 📁 اختبار Audio Formats
echo 6. 🛡️ اختبار Error Handling
echo.

echo ⚠️ ملاحظة: سيتم إشعارك عند الانتهاء من كل مهمة
echo.

echo 🎯 بدء النظام...
node VAD_TASK_MANAGER.js

echo.
echo ✅ انتهى تشغيل نظام إدارة المهام
pause 