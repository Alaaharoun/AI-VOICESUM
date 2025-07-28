# 🎤 Faster Whisper API - Fixed Version

## 🆕 Latest Fixes Applied:

### ✅ Critical Bug Fixes:
- **Fixed "name 'traceback' is not defined" error** - Removed problematic traceback import
- **Improved error handling** - Better error messages and logging
- **Enhanced CORS middleware** - Better browser compatibility
- **Added detailed logging** - For easier debugging on Hugging Face Spaces

### 🔧 Performance Improvements:
- **Better file validation** - 25MB file size limit
- **Enhanced VAD support** - Voice Activity Detection with fallback
- **Improved model loading** - Better error handling during startup
- **Added health check endpoint** - For monitoring service status

## 🚀 Quick Start:

### Health Check:
```bash
curl https://alaaharoun-faster-whisper-api.hf.space/health
```

### Transcribe Audio (without VAD):
```bash
curl -X POST \
  -F "file=@audio.wav" \
  -F "language=en" \
  -F "task=transcribe" \
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

### Transcribe Audio (with VAD):
```bash
curl -X POST \
  -F "file=@audio.wav" \
  -F "language=en" \
  -F "task=transcribe" \
  -F "vad_filter=true" \
  -F "vad_parameters=threshold=0.5" \
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

## 📊 Supported Parameters:

- **`file`**: Audio file (WAV, MP3, M4A, FLAC, OGG, WEBM)
- **`language`**: Language code (optional, e.g., "en", "ar", "es")
- **`task`**: "transcribe" or "translate" (default: "transcribe")
- **`vad_filter`**: Enable Voice Activity Detection (default: false)
- **`vad_parameters`**: VAD parameters (default: "threshold=0.5")

## 🔧 Response Format:

### Success Response:
```json
{
  "success": true,
  "text": "Transcribed text here",
  "language": "en",
  "language_probability": 0.95,
  "vad_enabled": false,
  "vad_threshold": null
}
```

### Error Response:
```json
{
  "error": "Error message",
  "error_type": "ExceptionType",
  "success": false
}
```

## 🛠️ Local Development:

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

Or with uvicorn:
```bash
uvicorn app:app --host 0.0.0.0 --port 7860
```

## 📝 Important Notes:

- **Maximum file size**: 25MB
- **Supported formats**: WAV, MP3, M4A, FLAC, OGG, WEBM
- **VAD support**: Configurable threshold with fallback mechanism
- **Language detection**: Automatic if not specified
- **Error handling**: Detailed error messages for debugging

## 🔍 Troubleshooting:

### Common Issues:

1. **500 Internal Server Error**: 
   - Check if the model is loaded properly
   - Verify file format and size
   - Check server logs for detailed error messages

2. **VAD Issues**:
   - The service will automatically fallback to standard transcription
   - Check VAD parameters format

3. **File Upload Issues**:
   - Ensure file size is under 25MB
   - Check file format compatibility

## 🌐 Service URLs:

- **Main Service**: https://alaaharoun-faster-whisper-api.hf.space
- **Health Check**: https://alaaharoun-faster-whisper-api.hf.space/health
- **API Documentation**: https://alaaharoun-faster-whisper-api.hf.space/docs

## 📈 Performance:

- **Model**: Whisper base model with int8 quantization
- **Processing**: Optimized for real-time transcription
- **Memory**: Efficient memory usage for Hugging Face Spaces
- **Concurrency**: Supports multiple concurrent requests

## 🔒 Security:

- **CORS**: Configured for cross-origin requests
- **File Validation**: Strict file type and size validation
- **Error Handling**: No sensitive information in error messages
- **Authentication**: Optional API token support (currently disabled)

## 📞 Support:

For issues or questions:
1. Check the health endpoint first
2. Review server logs for detailed error messages
3. Test with a simple audio file
4. Verify file format and size requirements
