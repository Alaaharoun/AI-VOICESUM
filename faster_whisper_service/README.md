# Faster Whisper Service

A high-performance speech-to-text service built with Faster Whisper and FastAPI, optimized for Hugging Face Spaces deployment. Provides real-time audio transcription and language detection capabilities.

## Features

- **Fast Audio Transcription**: Powered by Faster Whisper for efficient speech-to-text conversion
- **Language Detection**: Automatic language detection with confidence scores
- **Multi-language Support**: Support for 99+ languages
- **RESTful API**: Simple HTTP endpoints for easy integration
- **Auto-generated Documentation**: Swagger UI and ReDoc included
- **Hugging Face Spaces Ready**: Optimized for easy deployment
- **API Token Authentication**: Optional Bearer token authentication for security
- **Flexible Security**: Configurable authentication requirements

## Installation

### Prerequisites

- Python 3.8 or higher
- FFmpeg (required for audio processing)
- Hugging Face account (for deployment)

### Environment Variables

Copy `env.example` to `.env` and configure:

```env
# API Token (optional)
FASTER_WHISPER_API_TOKEN=your_api_token_here

# Require Authentication (true/false)
FASTER_WHISPER_REQUIRE_AUTH=false
```

### Setup

1. **Clone or navigate to the service directory:**
   ```bash
   cd faster_whisper_service
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install FFmpeg:**
   - **Ubuntu/Debian:**
     ```bash
     sudo apt update && sudo apt install ffmpeg
     ```
   - **macOS:**
     ```bash
     brew install ffmpeg
     ```
   - **Windows:** Download from [FFmpeg official website](https://ffmpeg.org/download.html)

## Usage

### Local Development

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The service will start on `http://localhost:8000`

### Docker Deployment

#### Using Docker Compose (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop the service
docker-compose down
```

#### Using Docker directly

```bash
# Build the image
docker build -t faster-whisper-service .

# Run the container
docker run -p 8000:8000 faster-whisper-service

# Run in background
docker run -d -p 8000:8000 --name whisper-service faster-whisper-service
```

### Hugging Face Spaces Deployment

1. Create a new Space on Hugging Face
2. Choose "FastAPI" as the SDK
3. Upload these files to your Space
4. The service will automatically deploy

### API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### Health Check

**GET** `/health`

Check service status and model loading status.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "service": "faster-whisper"
}
```

### Transcribe Audio

**POST** `/transcribe`

Transcribe an audio file to text.

**Parameters:**
- `file` (file): Audio file (WAV, MP3, M4A, etc.)
- `language` (optional, string): Language code (e.g., "en", "ar", "es")
- `task` (optional, string): "transcribe" or "translate" (default: "transcribe")

**Example Request:**
```bash
curl -X POST http://localhost:8000/transcribe \
  -F "file=@audio_file.wav" \
  -F "language=en" \
  -F "task=transcribe"
```

**Response:**
```json
{
  "success": true,
  "text": "Hello, this is a test transcription.",
  "language": "en",
  "language_probability": 0.99
}
```

### Detect Language

**POST** `/detect-language`

Detect the language of an audio file.

**Parameters:**
- `file` (file): Audio file to analyze

**Example Request:**
```bash
curl -X POST http://localhost:8000/detect-language \
  -F "file=@audio_file.wav"
```

**Response:**
```json
{
  "success": true,
  "language": "en",
  "language_probability": 0.95
}
```

## Language Codes

The service supports 99+ languages. Common language codes include:

- `en` - English
- `ar` - Arabic
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `zh` - Chinese
- `ja` - Japanese
- `ko` - Korean

## Performance Optimization

### Model Size Options

You can modify the model size in `app.py`:

- `"tiny"` - Fastest, least accurate
- `"base"` - Balanced (default)
- `"small"` - More accurate, slower
- `"medium"` - High accuracy, slower
- `"large"` - Highest accuracy, slowest

### Hugging Face Spaces Optimization

- Uses CPU-optimized compute type (`int8`)
- Automatic scaling based on usage
- No GPU required for deployment

## Security

### API Token Authentication

The service supports optional Bearer token authentication:

#### **Without Authentication (Default)**
```bash
curl -X POST http://localhost:8000/transcribe \
  -F "file=@audio_file.wav"
```

#### **With Authentication**
```bash
curl -X POST http://localhost:8000/transcribe \
  -H "Authorization: Bearer your_api_token_here" \
  -F "file=@audio_file.wav"
```

#### **Configuration**
```env
# Set API token
FASTER_WHISPER_API_TOKEN=your_secure_token_here

# Enable authentication
FASTER_WHISPER_REQUIRE_AUTH=true
```

### Security Features

- **Optional Authentication**: Can be enabled/disabled via environment variables
- **Bearer Token**: Standard HTTP Bearer token authentication
- **Flexible Configuration**: Works with or without authentication
- **Secure Headers**: Proper HTTP security headers

## Error Handling

The service includes comprehensive error handling:

- **400 Bad Request**: Missing or invalid audio file
- **401 Unauthorized**: Missing or invalid API token (when auth is required)
- **403 Forbidden**: Invalid API token
- **500 Internal Server Error**: Model loading issues or transcription errors

All errors return JSON responses with descriptive error messages.

## Integration Examples

### JavaScript/Node.js

```javascript
const FormData = require('form-data');
const fs = require('fs');

async function transcribeAudio(audioPath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(audioPath));
  form.append('language', 'en');

  const response = await fetch('http://localhost:8000/transcribe', {
    method: 'POST',
    body: form
  });

  return await response.json();
}
```

### Python

```python
import requests

def transcribe_audio(audio_path, language='en'):
    with open(audio_path, 'rb') as audio_file:
        files = {'file': audio_file}
        data = {'language': language}
        
        response = requests.post(
            'http://localhost:8000/transcribe',
            files=files,
            data=data
        )
        
        return response.json()
```

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Install FFmpeg and ensure it's in your PATH
2. **Audio format not supported**: Convert audio to WAV format
3. **Model download issues**: Check internet connection and disk space

### Logs

The service logs important events. Check the console output for:
- Model loading status
- Transcription progress
- Error messages

## Deployment Options

### Docker Deployment

The service includes Docker support for easy deployment in any environment.

#### Docker Features

- **Multi-stage build** for optimized image size
- **Security**: Runs as non-root user
- **Health checks** for monitoring
- **FFmpeg included** in the image
- **Easy scaling** with Docker Compose

#### Production Deployment

```bash
# Build for production
docker build -t faster-whisper-service:latest .

# Run with resource limits
docker run -d \
  --name whisper-service \
  -p 8000:8000 \
  --memory=2g \
  --cpus=1.0 \
  faster-whisper-service:latest
```

#### Docker Compose for Production

```yaml
version: '3.8'
services:
  whisper-service:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    restart: unless-stopped
```

### Hugging Face Spaces Deployment

#### Step-by-Step Guide

1. **Create a Hugging Face Account**
   - Go to [huggingface.co](https://huggingface.co)
   - Sign up for a free account

2. **Create a New Space**
   - Click "New Space" on your profile
   - Choose "FastAPI" as the SDK
   - Set visibility (Public or Private)
   - Click "Create Space"

3. **Upload Files**
   - Upload `app.py` to the root directory
   - Upload `requirements.txt` to the root directory
   - Upload this `README.md` file

4. **Deploy**
   - The Space will automatically build and deploy
   - Wait for the build to complete (usually 2-5 minutes)
   - Your API will be available at `https://your-username-your-space-name.hf.space`

#### Space Configuration

The service is optimized for Hugging Face Spaces with:
- CPU-only deployment (no GPU required)
- Automatic scaling
- Built-in monitoring
- Free tier support

#### API Usage After Deployment

Once deployed, you can use the API at your Space URL:

```bash
# Replace with your actual Space URL
curl -X POST https://your-username-your-space-name.hf.space/transcribe \
  -F "file=@audio_file.wav" \
  -F "language=en"
```

## License

This project is part of the LiveTranslate application.

## Support

For issues and questions, please refer to the main project documentation. 