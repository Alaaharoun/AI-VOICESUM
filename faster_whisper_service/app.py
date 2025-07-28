from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import shutil
import os
import tempfile
from typing import Optional

app = FastAPI(
    title="Faster Whisper Service",
    description="High-performance speech-to-text service using Faster Whisper",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# For Hugging Face Spaces compatibility
# Note: This is a FastAPI app, no Gradio needed for Docker deployment

# Security
security = HTTPBearer(auto_error=False)

# Configuration
API_TOKEN = ""  # No API token required
REQUIRE_AUTH = False  # Authentication disabled

# Load model on startup
try:
    model = WhisperModel("base", compute_type="int8")
    print("✅ Model loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")
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
        "vad_support": True
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
    Transcribe audio file to text
    
    - **file**: Audio file (WAV, MP3, M4A, etc.)
    - **language**: Language code (optional, e.g., "en", "ar", "es")
    - **task**: "transcribe" or "translate" (default: "transcribe")
    """
    print(f"📥 Received transcription request:")
    print(f"   - File: {file.filename}")
    print(f"   - Language: {language}")
    print(f"   - Task: {task}")
    print(f"   - VAD Filter: {vad_filter}")
    print(f"   - VAD Parameters: {vad_parameters}")
    
    try:
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
        
        print(f"📁 Processing file: {file.filename}")
        
        # Validate file size (max 25MB)
        file_size = 0
        file_content = b""
        while chunk := await file.read(8192):
            file_content += chunk
            file_size += len(chunk)
            if file_size > 25 * 1024 * 1024:  # 25MB limit
                print(f"❌ File too large: {file_size} bytes")
                return JSONResponse(
                    status_code=400,
                    content={"error": "File too large. Maximum size is 25MB", "success": False}
                )
        
        print(f"📊 File size: {file_size} bytes")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(file_content)
            temp_path = temp_file.name
            print(f"💾 Temporary file created: {temp_path}")
        
        try:
            # Parse VAD parameters
            vad_threshold = 0.5  # default
            if vad_filter and vad_parameters:
                try:
                    # Parse vad_parameters string like "threshold=0.5"
                    params = dict(param.split('=') for param in vad_parameters.split(','))
                    vad_threshold = float(params.get('threshold', 0.5))
                    print(f"🔧 Using VAD with threshold: {vad_threshold}")
                except Exception as e:
                    print(f"⚠️ VAD parameter parsing error: {e}, using default threshold=0.5")
            
            # Transcribe audio with VAD if enabled
            if vad_filter:
                print("🎤 Starting transcription with VAD...")
                # Use VAD filtering without parameters (fallback)
                try:
                    segments, info = model.transcribe(
                        temp_path, 
                        language=language, 
                        task=task,
                        vad_filter=True
                    )
                    print(f"✅ VAD transcription completed successfully")
                except Exception as vad_error:
                    print(f"⚠️ VAD error: {vad_error}")
                    print(f"📋 Full error details:")
                    traceback.print_exc()
                    print(f"🔄 Trying without VAD...")
                    # Fallback to transcription without VAD
                    if language:
                        segments, info = model.transcribe(temp_path, language=language, task=task)
                    else:
                        segments, info = model.transcribe(temp_path, task=task)
                    print(f"✅ Fallback transcription completed")
            else:
                print("🎤 Starting transcription without VAD...")
                # Transcribe without VAD
                if language:
                    segments, info = model.transcribe(temp_path, language=language, task=task)
                else:
                    segments, info = model.transcribe(temp_path, task=task)
                print(f"✅ Transcription completed successfully")
            
            # Collect transcription results
            transcription = " ".join([seg.text for seg in segments])
            print(f"📝 Transcription result: '{transcription}'")
            print(f"🌍 Detected language: {info.language} (probability: {info.language_probability})")
            
            # Clean up temporary file
            os.unlink(temp_path)
            print(f"🧹 Temporary file cleaned: {temp_path}")
            
            result = {
                "success": True,
                "text": transcription,
                "language": info.language,
                "language_probability": info.language_probability,
                "vad_enabled": vad_filter,
                "vad_threshold": vad_threshold if vad_filter else None
            }
            print(f"✅ Request completed successfully")
            return result
            
        except Exception as e:
            # Clean up temporary file in case of error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                print(f"🧹 Temporary file cleaned after error: {temp_path}")
            
            print(f"❌ Transcription error: {e}")
            print(f"📋 Full error details:")
            traceback.print_exc()
            
            return JSONResponse(
                status_code=500,
                content={"error": str(e), "success": False}
            )
            
    except Exception as e:
        print(f"❌ General error: {e}")
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
    Detect the language of an audio file
    
    - **file**: Audio file to analyze
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
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
        
        try:
            # Detect language
            segments, info = model.transcribe(temp_path, beam_size=5)
            
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
            raise e
            
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "success": False}
        )

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Faster Whisper Service on port 7860...")
    uvicorn.run(app, host="0.0.0.0", port=7860) 