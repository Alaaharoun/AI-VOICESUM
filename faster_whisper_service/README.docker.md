---
title: Faster Whisper API
emoji: 🎤
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
license: mit
---

# Faster Whisper API

A high-performance speech-to-text service using Faster Whisper and FastAPI, deployed with Docker on Hugging Face Spaces.

## Features

- **Fast Audio Transcription**: Powered by Faster Whisper
- **Language Detection**: Automatic language detection
- **Multi-language Support**: 99+ languages
- **API Token Authentication**: Optional Bearer token security
- **RESTful API**: Simple HTTP endpoints
- **Docker Deployment**: Optimized for Hugging Face Spaces

## API Endpoints

### Health Check
```
GET /health
```

### Transcribe Audio
```
POST /transcribe
Content-Type: multipart/form-data
Parameters:
- file: Audio file (WAV, MP3, M4A, etc.)
- language: Language code (optional)
- task: "transcribe" or "translate" (optional)
```

### Detect Language
```
POST /detect-language
Content-Type: multipart/form-data
Parameters:
- file: Audio file to analyze
```

## Authentication

The API supports optional Bearer token authentication:

```bash
# Without authentication (default)
curl -X POST https://your-space.hf.space/transcribe \
  -F "file=@audio.wav"

# With authentication
curl -X POST https://your-space.hf.space/transcribe \
  -H "Authorization: Bearer your_token" \
  -F "file=@audio.wav"
```

## Environment Variables

Set these in Hugging Face Space settings:

- `FASTER_WHISPER_API_TOKEN`: API token for authentication
- `FASTER_WHISPER_REQUIRE_AUTH`: Enable authentication (true/false)

## Usage

1. Visit the Space URL
2. Use the interactive API documentation at `/docs`
3. Test endpoints with your audio files

## Supported Languages

- English (en)
- Arabic (ar)
- Spanish (es)
- French (fr)
- German (de)
- And 90+ more languages 