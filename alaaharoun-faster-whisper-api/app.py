from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import shutil
import os
import tempfile
import sys
from typing import Optional

# Create FastAPI app
app = FastAPI(
    title="Faster Whisper Service",
    description="High-performance speech-to-text service using Faster Whisper",
    version="1.0.0"
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

# Global model variable
model = None

def load_model():
    """Load the Whisper model"""
    global model
    try:
        print("🔄 Loading Whisper model...")
        model = WhisperModel("base", compute_type="int8")
        print("✅ Model loaded successfully")
        return True
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        print(f"Python version: {sys.version}")
        print(f"Current working directory: {os.getcwd()}")
        model = None
        return False

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

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    load_model()

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Faster Whisper Service is running"}

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
        "python_version": sys.version
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
    Transcribe audio file to text with optional VAD support
    """
    temp_path = None
    try:
        print(f"🎵 Starting transcription for file: {file.filename}")
        
        # Check if model is loaded
        if model is None:
            print("❌ Model not loaded")
            return JSONResponse(
                status_code=500,
                content={"error": "Model not loaded", "success": False}
            )
        
        # Validate file
        if not file.filename:
            print("❌ No file provided")
            return JSONResponse(
                status_code=400,
                content={"error": "No file provided", "success": False}
            )
        
        # Validate file size (25MB limit)
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        print(f"📁 File size: {file_size} bytes")
        
        if file_size > 25 * 1024 * 1024:  # 25MB
            print("❌ File too large")
            return JSONResponse(
                status_code=400,
                content={"error": "File too large. Maximum size is 25MB", "success": False}
            )
        
        # Create temporary file
        print("📝 Creating temporary file...")
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
        
        print(f"✅ Temporary file created: {temp_path}")
        
        # Parse VAD parameters
        vad_threshold = 0.5  # default
        if vad_filter and vad_parameters:
            try:
                for param in vad_parameters.split(','):
                    if '=' in param:
                        key, value = param.strip().split('=')
                        if key == 'threshold':
                            vad_threshold = float(value)
            except Exception as e:
                print(f"⚠️ Warning: Failed to parse VAD parameters: {e}")
        
        # Transcribe audio
        print("🎤 Starting transcription...")
        if vad_filter:
            print(f"🔊 Using VAD with threshold: {vad_threshold}")
            try:
                if language:
                    segments, info = model.transcribe(
                        temp_path, 
                        language=language, 
                        task=task,
                        vad_filter=True,
                        vad_parameters=f"threshold={vad_threshold}"
                    )
                else:
                    segments, info = model.transcribe(
                        temp_path, 
                        task=task,
                        vad_filter=True,
                        vad_parameters=f"threshold={vad_threshold}"
                    )
            except Exception as vad_error:
                print(f"⚠️ VAD transcription failed, falling back to standard: {vad_error}")
                if language:
                    segments, info = model.transcribe(temp_path, language=language, task=task)
                else:
                    segments, info = model.transcribe(temp_path, task=task)
        else:
            if language:
                segments, info = model.transcribe(temp_path, language=language, task=task)
            else:
                segments, info = model.transcribe(temp_path, task=task)
        
        # Collect transcription results
        transcription = " ".join([seg.text for seg in segments])
        
        print(f"✅ Transcription completed: {len(transcription)} characters")
        print(f"🌍 Detected language: {info.language} (probability: {info.language_probability:.2f})")
        
        # Prepare response
        response = {
            "success": True,
            "text": transcription,
            "language": info.language,
            "language_probability": info.language_probability,
            "vad_enabled": vad_filter,
            "vad_threshold": vad_threshold if vad_filter else None
        }
        
        return JSONResponse(content=response)
        
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"❌ Transcription error ({error_type}): {error_msg}")
        
        return JSONResponse(
            status_code=500,
            content={
                "error": error_msg,
                "error_type": error_type,
                "success": False
            }
        )
    finally:
        # Clean up temporary file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                print(f"🧹 Cleaned up temporary file: {temp_path}")
            except Exception as e:
                print(f"⚠️ Warning: Failed to delete temp file: {e}")

@app.post("/detect-language")
async def detect_language(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(verify_token)
):
    """
    Detect the language of an audio file
    """
    temp_path = None
    try:
        print(f"🌍 Starting language detection for file: {file.filename}")
        
        # Check if model is loaded
        if model is None:
            print("❌ Model not loaded")
            return JSONResponse(
                status_code=500,
                content={"error": "Model not loaded", "success": False}
            )
        
        # Validate file
        if not file.filename:
            print("❌ No file provided")
            return JSONResponse(
                status_code=400,
                content={"error": "No file provided", "success": False}
            )
        
        # Create temporary file
        print("📝 Creating temporary file...")
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
        
        print(f"✅ Temporary file created: {temp_path}")
        
        # Detect language
        print("🌍 Detecting language...")
        segments, info = model.transcribe(temp_path)
        
        print(f"✅ Language detected: {info.language} (probability: {info.language_probability:.2f})")
        
        return JSONResponse(content={
            "success": True,
            "language": info.language,
            "language_probability": info.language_probability
        })
        
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"❌ Language detection error ({error_type}): {error_msg}")
        
        return JSONResponse(
            status_code=500,
            content={
                "error": error_msg,
                "error_type": error_type,
                "success": False
            }
        )
    finally:
        # Clean up temporary file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                print(f"🧹 Cleaned up temporary file: {temp_path}")
            except Exception as e:
                print(f"⚠️ Warning: Failed to delete temp file: {e}")

# For Hugging Face Spaces compatibility
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860) 