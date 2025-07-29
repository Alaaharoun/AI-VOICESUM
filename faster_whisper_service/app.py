from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import shutil
import os
import tempfile
import sys
import json
import asyncio
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

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove disconnected clients
                self.active_connections.remove(connection)

manager = ConnectionManager()

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
        "websocket_support": True,
        "python_version": sys.version
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription"""
    await manager.connect(websocket)
    try:
        print("🔌 WebSocket connection established")
        await manager.send_personal_message(
            json.dumps({
                "type": "connection",
                "status": "connected",
                "message": "WebSocket connection established"
            }), 
            websocket
        )
        
        while True:
            try:
                # Receive data from client
                message = await websocket.receive()
                
                # Handle different message types
                if "bytes" in message:
                    # Binary audio data
                    data = message["bytes"]
                    print(f"🎵 WebSocket: Processing audio chunk ({len(data)} bytes)")
                    
                    # Save audio data to temporary file
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                        temp_file.write(data)
                        temp_path = temp_file.name
                    
                    # Transcribe audio
                    if model:
                        segments, info = model.transcribe(temp_path)
                        transcription = " ".join([seg.text for seg in segments])
                        
                        # Send transcription result
                        result = {
                            "type": "transcription",
                            "text": transcription,
                            "language": info.language,
                            "language_probability": info.language_probability,
                            "success": True
                        }
                        
                        await manager.send_personal_message(json.dumps(result), websocket)
                        print(f"✅ WebSocket: Sent transcription: '{transcription}'")
                    else:
                        error_result = {
                            "type": "error",
                            "message": "Model not loaded",
                            "success": False
                        }
                        await manager.send_personal_message(json.dumps(error_result), websocket)
                    
                    # Clean up temporary file
                    os.unlink(temp_path)
                    
                elif "text" in message:
                    # Text message (JSON configuration)
                    try:
                        data = json.loads(message["text"])
                        print(f"📨 WebSocket: Received configuration: {data}")
                        
                        if data.get("type") == "init":
                            # Handle initialization
                            await manager.send_personal_message(
                                json.dumps({
                                    "type": "connection",
                                    "status": "initialized",
                                    "message": "Configuration received"
                                }), 
                                websocket
                            )
                    except json.JSONDecodeError:
                        print(f"⚠️ WebSocket: Invalid JSON received: {message['text']}")
                        
            except Exception as e:
                print(f"❌ WebSocket processing error: {e}")
                error_result = {
                    "type": "error",
                    "message": str(e),
                    "success": False
                }
                await manager.send_personal_message(json.dumps(error_result), websocket)
                
    except WebSocketDisconnect:
        print("🔌 WebSocket connection disconnected")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        manager.disconnect(websocket)

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
                print(f"✅ VAD transcription completed successfully")
            except Exception as vad_error:
                print(f"⚠️ VAD error: {vad_error}")
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
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
            print(f"🧹 Temporary file cleaned after error: {temp_path}")
        
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
        
        # Clean up temporary file
        os.unlink(temp_path)
        print(f"🧹 Temporary file cleaned: {temp_path}")
        
        return JSONResponse(content={
            "success": True,
            "language": info.language,
            "language_probability": info.language_probability
        })
        
    except Exception as e:
        # Clean up temporary file in case of error
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
            print(f"🧹 Temporary file cleaned after error: {temp_path}")
        
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

# For Hugging Face Spaces compatibility
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860) 