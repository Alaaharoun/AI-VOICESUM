@echo off
echo 🚀 رفع الإصلاحات النهائية لـ VAD إلى Hugging Face...
echo.

REM Create deployment directory
if not exist "huggingface_deploy" mkdir huggingface_deploy

echo 📁 نسخ الملفات المحدثة...

REM Copy updated app.py with enhanced logging
copy "faster_whisper_service\app.py" "huggingface_deploy\app.py"

REM Create requirements.txt
echo fastapi==0.104.1 > huggingface_deploy\requirements.txt
echo uvicorn==0.24.0 >> huggingface_deploy\requirements.txt
echo faster-whisper==0.9.0 >> huggingface_deploy\requirements.txt
echo python-multipart==0.0.6 >> huggingface_deploy\requirements.txt

REM Create Dockerfile
echo FROM python:3.9-slim > huggingface_deploy\Dockerfile
echo. >> huggingface_deploy\Dockerfile
echo WORKDIR /app >> huggingface_deploy\Dockerfile
echo. >> huggingface_deploy\Dockerfile
echo RUN apt-get update ^&^& apt-get install -y ffmpeg >> huggingface_deploy\Dockerfile
echo. >> huggingface_deploy\Dockerfile
echo COPY requirements.txt . >> huggingface_deploy\Dockerfile
echo RUN pip install -r requirements.txt >> huggingface_deploy\Dockerfile
echo. >> huggingface_deploy\Dockerfile
echo COPY . . >> huggingface_deploy\Dockerfile
echo. >> huggingface_deploy\Dockerfile
echo EXPOSE 8000 >> huggingface_deploy\Dockerfile
echo. >> huggingface_deploy\Dockerfile
echo CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"] >> huggingface_deploy\Dockerfile

REM Create README.md
echo # Faster Whisper API with Enhanced VAD Support > huggingface_deploy\README.md
echo. >> huggingface_deploy\README.md
echo ## 🎯 Features >> huggingface_deploy\README.md
echo - ✅ Enhanced VAD support with fallback mechanism >> huggingface_deploy\README.md
echo - ✅ Comprehensive logging for debugging >> huggingface_deploy\README.md
echo - ✅ Better error handling >> huggingface_deploy\README.md
echo - ✅ Support for multiple audio formats >> huggingface_deploy\README.md
echo. >> huggingface_deploy\README.md
echo ## 🔧 VAD Improvements >> huggingface_deploy\README.md
echo - Fixed VAD parameters handling >> huggingface_deploy\README.md
echo - Added fallback to non-VAD transcription >> huggingface_deploy\README.md
echo - Enhanced error logging with traceback >> huggingface_deploy\README.md
echo - Better file validation and processing >> huggingface_deploy\README.md
echo. >> huggingface_deploy\README.md
echo ## 📊 Health Check >> huggingface_deploy\README.md
echo ```bash >> huggingface_deploy\README.md
echo curl https://alaaharoun-faster-whisper-api.hf.space/health >> huggingface_deploy\README.md
echo ``` >> huggingface_deploy\README.md
echo. >> huggingface_deploy\README.md
echo ## 🎤 Transcription with VAD >> huggingface_deploy\README.md
echo ```bash >> huggingface_deploy\README.md
echo curl -X POST -F "file=@audio.wav" -F "vad_filter=true" \ >> huggingface_deploy\README.md
echo   https://alaaharoun-faster-whisper-api.hf.space/transcribe >> huggingface_deploy\README.md
echo ``` >> huggingface_deploy\README.md

echo ✅ تم إنشاء ملفات النشر
echo.

REM Navigate to deployment directory
cd huggingface_deploy

echo 🔄 إضافة الملفات إلى Git...
git add .

echo 📝 إنشاء commit...
git commit -m "🚀 Enhanced VAD support with comprehensive logging and fallback mechanism

✅ Fixed VAD parameters handling
✅ Added fallback to non-VAD transcription  
✅ Enhanced error logging with traceback
✅ Better file validation and processing
✅ Comprehensive request logging
✅ Improved error handling"

echo 🚀 رفع التحديثات...
git push

echo.
echo ✅ تم رفع الإصلاحات بنجاح!
echo.
echo 🧪 اختبار الإصلاحات:
echo curl https://alaaharoun-faster-whisper-api.hf.space/health
echo.
echo curl -X POST -F "file=@better-test-audio.wav" -F "vad_filter=true" ^
echo   https://alaaharoun-faster-whisper-api.hf.space/transcribe
echo.
echo 📊 انتظر دقيقة واحدة ثم اختبر الخدمة... 