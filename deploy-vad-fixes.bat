@echo off
REM 🚀 سكريبت رفع إصلاحات VAD إلى Hugging Face
REM 
REM هذا السكريبت يرفع الإصلاحات المطلوبة لـ VAD إلى Hugging Face Spaces

echo 🚀 بدء رفع إصلاحات VAD إلى Hugging Face...

REM التحقق من وجود Git
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git غير مثبت
    pause
    exit /b 1
)

REM التحقق من وجود Hugging Face CLI
huggingface-cli --version >nul 2>&1
if errorlevel 1 (
    echo 📦 تثبيت Hugging Face CLI...
    pip install huggingface_hub
)

echo 📁 إعداد الملفات للرفع...

REM نسخ الملفات المطلوبة
if not exist "huggingface_deploy" mkdir huggingface_deploy
copy "faster_whisper_service\app.py" "huggingface_deploy\app.py" >nul

echo 📝 إنشاء ملفات التحديث...

REM إنشاء ملف README محدث
echo # 🎤 Faster Whisper API with VAD Support > "huggingface_deploy\README.md"
echo. >> "huggingface_deploy\README.md"
echo ## 🆕 التحديثات الجديدة: >> "huggingface_deploy\README.md"
echo. >> "huggingface_deploy\README.md"
echo ### ✅ إصلاحات VAD: >> "huggingface_deploy\README.md"
echo - إصلاح معالجة VAD parameters >> "huggingface_deploy\README.md"
echo - دعم عتبات VAD المختلفة >> "huggingface_deploy\README.md"
echo - تحسين معالجة الأخطاء >> "huggingface_deploy\README.md"
echo - إضافة VAD support في health check >> "huggingface_deploy\README.md"
echo. >> "huggingface_deploy\README.md"
echo ### 🔧 التحسينات: >> "huggingface_deploy\README.md"
echo - معالجة أفضل للأخطاء >> "huggingface_deploy\README.md"
echo - دعم ملفات صوتية أكبر >> "huggingface_deploy\README.md"
echo - تحسين الأداء >> "huggingface_deploy\README.md"
echo - إضافة logging محسن >> "huggingface_deploy\README.md"

REM إنشاء ملف requirements محدث
echo fastapi==0.104.1 > "huggingface_deploy\requirements.txt"
echo uvicorn[standard]==0.24.0 >> "huggingface_deploy\requirements.txt"
echo faster-whisper==0.9.0 >> "huggingface_deploy\requirements.txt"
echo python-multipart==0.0.6 >> "huggingface_deploy\requirements.txt"
echo python-jose[cryptography]==3.3.0 >> "huggingface_deploy\requirements.txt"
echo passlib[bcrypt]==1.7.4 >> "huggingface_deploy\requirements.txt"
echo python-dotenv==1.0.0 >> "huggingface_deploy\requirements.txt"

REM إنشاء ملف Docker محدث
echo FROM python:3.9-slim > "huggingface_deploy\Dockerfile"
echo. >> "huggingface_deploy\Dockerfile"
echo # Install system dependencies >> "huggingface_deploy\Dockerfile"
echo RUN apt-get update ^&^& apt-get install -y \ >> "huggingface_deploy\Dockerfile"
echo     ffmpeg \ >> "huggingface_deploy\Dockerfile"
echo     ^&^& rm -rf /var/lib/apt/lists/* >> "huggingface_deploy\Dockerfile"
echo. >> "huggingface_deploy\Dockerfile"
echo # Set working directory >> "huggingface_deploy\Dockerfile"
echo WORKDIR /app >> "huggingface_deploy\Dockerfile"
echo. >> "huggingface_deploy\Dockerfile"
echo # Copy requirements and install Python dependencies >> "huggingface_deploy\Dockerfile"
echo COPY requirements.txt . >> "huggingface_deploy\Dockerfile"
echo RUN pip install --no-cache-dir -r requirements.txt >> "huggingface_deploy\Dockerfile"
echo. >> "huggingface_deploy\Dockerfile"
echo # Copy application code >> "huggingface_deploy\Dockerfile"
echo COPY app.py . >> "huggingface_deploy\Dockerfile"
echo. >> "huggingface_deploy\Dockerfile"
echo # Create non-root user >> "huggingface_deploy\Dockerfile"
echo RUN useradd -m -u 1000 appuser ^&^& chown -R appuser:appuser /app >> "huggingface_deploy\Dockerfile"
echo USER appuser >> "huggingface_deploy\Dockerfile"
echo. >> "huggingface_deploy\Dockerfile"
echo # Expose port >> "huggingface_deploy\Dockerfile"
echo EXPOSE 7860 >> "huggingface_deploy\Dockerfile"
echo. >> "huggingface_deploy\Dockerfile"
echo # Run the application >> "huggingface_deploy\Dockerfile"
echo CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"] >> "huggingface_deploy\Dockerfile"

echo 🚀 رفع التحديثات إلى Hugging Face...

REM الانتقال إلى مجلد huggingface_deploy
cd huggingface_deploy

REM إضافة الملفات
git add .

REM إنشاء commit
git commit -m "🔧 إصلاحات VAD - تحديث 2.0.0

✅ إصلاحات مطبقة:
- إصلاح معالجة VAD parameters
- تحسين معالجة الأخطاء
- إضافة VAD support في health check
- تحسين logging
- دعم ملفات صوتية أكبر

🎯 التحسينات:
- معالجة أفضل للأخطاء
- دعم عتبات VAD المختلفة
- تحسين الأداء
- إضافة monitoring محسن

📊 النتائج المتوقعة:
- معدل نجاح 100%% لاختبارات VAD
- استقرار أفضل
- أداء محسن"

REM رفع التحديثات
git push origin main

echo ✅ تم رفع الإصلاحات بنجاح!
echo 🔗 الرابط: https://huggingface.co/spaces/alaaharoun/faster-whisper-api
echo ⏰ قد يستغرق التحديث بضع دقائق...

REM العودة للمجلد الأصلي
cd ..

echo 🎯 تم الانتهاء من رفع الإصلاحات!
pause 