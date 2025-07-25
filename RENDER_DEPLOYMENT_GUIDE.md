# 🚀 Render Deployment Guide for AI Voice Translate

## Environment Variables Required on Render

### Azure Speech Services (Required for Audio Transcription)
```
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here
```

### Supabase (Required for Account Management)
```
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

### Server Configuration
```
PORT=10000
```

## Render Settings

### Build & Deploy Settings
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Environment**: `Node`
- **Auto-Deploy**: `Yes` (connected to GitHub)

### Health Check
- **Health Check Path**: `/health`
- **Expected Response**: `{"status":"ok","apiKey":"Present","timestamp":"..."}`

## Current Status

### ✅ Working Features:
- Server deployment and basic health check
- WebSocket connection establishment
- GitHub auto-deployment

### ⚠️ Requires Investigation:
- Azure Speech Service responses (may need environment variable update)
- WebSocket message handling

## Testing Commands

### Test Server Health:
```bash
curl https://ai-voicesum.onrender.com/health
```

### Test Live Translation API:
```bash
curl -X POST "https://ai-voicesum.onrender.com/live-translate" \
  -H "Content-Type: application/json" \
  -d '{"audio":"dGVzdA==","audioType":"audio/wav","language":"ar-SA"}'
```

### Test WebSocket:
```javascript
const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
ws.onopen = () => ws.send(JSON.stringify({type: 'init', language: 'ar-SA'}));
```

## Next Steps

1. **Check Environment Variables**: Verify Azure credentials are set in Render dashboard
2. **Monitor Logs**: Check Render deployment logs for Azure Speech errors
3. **Test Audio Processing**: Ensure audio chunks are properly formatted for Azure
4. **Verify Auto-Deploy**: Confirm latest code changes are deployed

## Latest Optimizations Applied

- ✅ Audio chunk size optimization (5 second intervals)
- ✅ Client-side audio buffering (10 seconds)
- ✅ Azure Speech SDK configuration improvements
- ✅ Enhanced debugging and logging
- ✅ WebSocket timeout management
- ✅ Proper audio format specification (48kHz PCM)

## Support

If Azure Speech Service is not responding:
1. Check Render environment variables
2. Verify Azure Speech Service quota and billing
3. Check Render deployment logs for specific errors
4. Test with local server to isolate issues 