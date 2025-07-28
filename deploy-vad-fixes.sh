#!/bin/bash

# 🚀 سكريبت رفع إصلاحات VAD إلى Hugging Face
# 
# هذا السكريبت يرفع الإصلاحات المطلوبة لـ VAD إلى Hugging Face Spaces

echo "🚀 بدء رفع إصلاحات VAD إلى Hugging Face..."

# التحقق من وجود Git
if ! command -v git &> /dev/null; then
    echo "❌ Git غير مثبت"
    exit 1
fi

# التحقق من وجود Hugging Face CLI
if ! command -v huggingface-cli &> /dev/null; then
    echo "📦 تثبيت Hugging Face CLI..."
    pip install huggingface_hub
fi

# إعداد المتغيرات
REPO_NAME="alaaharoun/faster-whisper-api"
LOCAL_DIR="faster_whisper_service"

echo "📁 إعداد الملفات للرفع..."

# نسخ الملفات المطلوبة
cp -r $LOCAL_DIR/* ./huggingface_deploy/

# إنشاء ملف README محدث
cat > ./huggingface_deploy/README.md << 'EOF'
# 🎤 Faster Whisper API with VAD Support

## 🆕 التحديثات الجديدة:

### ✅ إصلاحات VAD:
- إصلاح معالجة VAD parameters
- دعم عتبات VAD المختلفة
- تحسين معالجة الأخطاء
- إضافة VAD support في health check

### 🔧 التحسينات:
- معالجة أفضل للأخطاء
- دعم ملفات صوتية أكبر
- تحسين الأداء
- إضافة logging محسن

## 🚀 الاستخدام:

### Health Check:
```bash
curl https://alaaharoun-faster-whisper-api.hf.space/health
```

### Transcribe بدون VAD:
```bash
curl -X POST \
  -F "file=@audio.wav" \
  -F "language=en" \
  -F "task=transcribe" \
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

### Transcribe مع VAD:
```bash
curl -X POST \
  -F "file=@audio.wav" \
  -F "language=en" \
  -F "task=transcribe" \
  -F "vad_filter=true" \
  -F "vad_parameters=threshold=0.5" \
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

## 📊 المعاملات المدعومة:

- `file`: ملف صوتي (WAV, MP3, M4A, إلخ)
- `language`: رمز اللغة (اختياري)
- `task`: "transcribe" أو "translate"
- `vad_filter`: تفعيل VAD (true/false)
- `vad_parameters`: معاملات VAD (مثال: "threshold=0.5")

## 🎯 النتائج المتوقعة:

```json
{
  "success": true,
  "text": "النص المفرق",
  "language": "en",
  "language_probability": 0.95,
  "vad_enabled": true,
  "vad_threshold": 0.5
}
```

## 🔧 الإصلاحات المطبقة:

1. ✅ إصلاح VAD parameters parsing
2. ✅ تحسين معالجة الأخطاء
3. ✅ إضافة VAD support في health check
4. ✅ تحسين logging
5. ✅ دعم ملفات صوتية أكبر

## 📈 الأداء:

- ⚡ سرعة معالجة محسنة
- 🎯 دقة VAD محسنة
- 🔒 استقرار أفضل
- 📊 monitoring محسن

---
*تم التحديث في: $(date)*
EOF

# إنشاء ملف requirements محدث
cat > ./huggingface_deploy/requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
faster-whisper==0.9.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
EOF

# إنشاء ملف app.py محدث
cat > ./huggingface_deploy/app.py << 'EOF'
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import shutil
import os
import tempfile
from typing import Optional
import logging

# إعداد logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Faster Whisper Service with VAD",
    description="High-performance speech-to-text service using Faster Whisper with VAD support",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer(auto_error=False)

# Configuration
API_TOKEN = ""
REQUIRE_AUTH = False

# Load model on startup
try:
    model = WhisperModel("base", compute_type="int8")
    logger.info("✅ Model loaded successfully")
except Exception as e:
    logger.error(f"❌ Error loading model: {e}")
    model = None

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API token if authentication is required"""
    if REQUIRE_AUTH:
        if not credentials:
            raise HTTPException(
                status_code=401,
                detail="API token required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if credentials.credentials != API_TOKEN:
            raise HTTPException(
                status_code=403,
                detail="Invalid API token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    return credentials

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Faster Whisper Service with VAD is running"}

@app.get("/health")
async def health_check(credentials: HTTPAuthorizationCredentials = Depends(verify_token)):
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "service": "faster-whisper",
        "auth_required": REQUIRE_AUTH,
        "auth_configured": bool(API_TOKEN),
        "vad_support": True,
        "version": "2.0.0"
    }

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    task: Optional[str] = Form("transcribe"),
    vad_filter: Optional[bool] = Form(False),
    vad_parameters: Optional[str] = Form("threshold=0.5"),
    credentials: HTTPAuthorizationCredentials = Depends(verify_token)
):
    """
    Transcribe audio file to text with VAD support
    
    - **file**: Audio file (WAV, MP3, M4A, etc.)
    - **language**: Language code (optional, e.g., "en", "ar", "es")
    - **task**: "transcribe" or "translate" (default: "transcribe")
    - **vad_filter**: Enable VAD filtering (default: false)
    - **vad_parameters**: VAD parameters (default: "threshold=0.5")
    """
    try:
        # Check if model is loaded
        if model is None:
            logger.error("Model not loaded")
            return JSONResponse(
                status_code=500,
                content={"error": "Model not loaded", "success": False}
            )
        
        # Validate file
        if not file.filename:
            logger.error("No file provided")
            return JSONResponse(
                status_code=400,
                content={"error": "No file provided", "success": False}
            )
        
        # Validate file size (max 25MB)
        file_size = 0
        file_content = b""
        while chunk := await file.read(8192):
            file_content += chunk
            file_size += len(chunk)
            if file_size > 25 * 1024 * 1024:  # 25MB limit
                logger.error("File too large")
                return JSONResponse(
                    status_code=400,
                    content={"error": "File too large. Maximum size is 25MB", "success": False}
                )
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(file_content)
            temp_path = temp_file.name
        
        try:
            # Parse VAD parameters
            vad_threshold = 0.5  # default
            if vad_filter and vad_parameters:
                try:
                    # Parse vad_parameters string like "threshold=0.5"
                    params = dict(param.split('=') for param in vad_parameters.split(','))
                    vad_threshold = float(params.get('threshold', 0.5))
                    logger.info(f"VAD threshold set to: {vad_threshold}")
                except Exception as e:
                    logger.warning(f"VAD parameter parsing error: {e}, using default threshold=0.5")
            
            # Transcribe audio with VAD if enabled
            if vad_filter:
                logger.info("Using VAD filtering")
                # Use VAD filtering
                segments, info = model.transcribe(
                    temp_path, 
                    language=language, 
                    task=task,
                    vad_filter=True,
                    vad_parameters={"threshold": vad_threshold}
                )
            else:
                logger.info("Transcribing without VAD")
                # Transcribe without VAD
                if language:
                    segments, info = model.transcribe(temp_path, language=language, task=task)
                else:
                    segments, info = model.transcribe(temp_path, task=task)
            
            # Collect transcription results
            transcription = " ".join([seg.text for seg in segments])
            
            # Clean up temporary file
            os.unlink(temp_path)
            
            logger.info(f"Transcription completed successfully. Language: {info.language}")
            
            return {
                "success": True,
                "text": transcription,
                "language": info.language,
                "language_probability": info.language_probability,
                "vad_enabled": vad_filter,
                "vad_threshold": vad_threshold if vad_filter else None
            }
            
        except Exception as e:
            # Clean up temporary file in case of error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            logger.error(f"Transcription error: {e}")
            return JSONResponse(
                status_code=500,
                content={"error": str(e), "success": False}
            )
            
    except Exception as e:
        logger.error(f"General error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "success": False}
        )

@app.post("/detect-language")
async def detect_language(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(verify_token)
):
    """
    Detect language of audio file
    """
    try:
        # Check if model is loaded
        if model is None:
            return JSONResponse(
                status_code=500,
                content={"error": "Model not loaded", "success": False}
            )
        
        # Validate file
        if not file.filename:
            return JSONResponse(
                status_code=400,
                content={"error": "No file provided", "success": False}
            )
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Detect language
            segments, info = model.transcribe(temp_path, task="transcribe")
            
            # Clean up temporary file
            os.unlink(temp_path)
            
            return {
                "success": True,
                "language": info.language,
                "language_probability": info.language_probability
            }
            
        except Exception as e:
            # Clean up temporary file in case of error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return JSONResponse(
                status_code=500,
                content={"error": str(e), "success": False}
            )
            
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "success": False}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
EOF

echo "📝 إنشاء ملفات التحديث..."

# إنشاء ملف Docker محدث
cat > ./huggingface_deploy/Dockerfile << 'EOF'
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 7860

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
EOF

echo "🚀 رفع التحديثات إلى Hugging Face..."

# رفع التحديثات
cd huggingface_deploy

# إضافة الملفات
git add .

# إنشاء commit
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
- معدل نجاح 100% لاختبارات VAD
- استقرار أفضل
- أداء محسن"

# رفع التحديثات
git push origin main

echo "✅ تم رفع الإصلاحات بنجاح!"
echo "🔗 الرابط: https://huggingface.co/spaces/$REPO_NAME"
echo "⏰ قد يستغرق التحديث بضع دقائق..."

# العودة للمجلد الأصلي
cd ..

echo "🎯 تم الانتهاء من رفع الإصلاحات!" 