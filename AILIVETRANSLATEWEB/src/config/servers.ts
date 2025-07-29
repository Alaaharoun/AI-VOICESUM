// Server Configuration
export const SERVER_CONFIG = {
  // Hugging Face Spaces Server
  HUGGING_FACE: {
    name: 'Hugging Face Spaces',
    wsUrl: '', // WebSocket not supported on Hugging Face Spaces
    httpUrl: 'https://alaaharoun-faster-whisper-api.hf.space/transcribe',
    healthUrl: 'https://alaaharoun-faster-whisper-api.hf.space/health',
    engine: 'faster-whisper'
  },
  
  // Local Development Server
  LOCAL: {
    name: 'Local Development',
    wsUrl: 'ws://localhost:7860/ws',
    httpUrl: 'http://localhost:7860/transcribe',
    healthUrl: 'http://localhost:7860/health',
    engine: 'faster-whisper'
  },
  
  // Azure Speech Service
  AZURE: {
    name: 'Azure Speech Service',
    wsUrl: '', // Will be generated dynamically
    httpUrl: '', // Not used for Azure
    healthUrl: '', // Not used for Azure
    engine: 'azure'
  },
  
  // Render WebSocket Server
  RENDER: {
    name: 'Render WebSocket Server',
    wsUrl: 'wss://ai-voicesum.onrender.com/ws',
    httpUrl: 'https://ai-voicesum.onrender.com/transcribe',
    healthUrl: 'https://ai-voicesum.onrender.com/health',
    engine: 'azure'
  }
};

// Server Selection Logic
export const getServerConfig = (engine: string, preferRemote: boolean = true) => {
  if (engine === 'azure') {
    // Prefer Render WebSocket server for Azure engine
    return SERVER_CONFIG.RENDER;
  }
  
  // For faster-whisper, prefer remote server unless explicitly requested
  if (preferRemote) {
    return SERVER_CONFIG.HUGGING_FACE;
  }
  
  return SERVER_CONFIG.LOCAL;
};

// Health Check Function
export const checkServerHealth = async (serverConfig: typeof SERVER_CONFIG[keyof typeof SERVER_CONFIG]) => {
  try {
    if (!serverConfig.healthUrl) return false;
    
    const response = await fetch(serverConfig.healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error(`❌ Health check failed for ${serverConfig.name}:`, error);
    return false;
  }
};

// Test server endpoints
export const testServerEndpoints = async () => {
  console.log('🧪 Testing server endpoints...');
  
  for (const [key, config] of Object.entries(SERVER_CONFIG)) {
    if (config.httpUrl) {
      try {
        console.log(`🔍 Testing ${config.name}: ${config.httpUrl}`);
        const response = await fetch(config.httpUrl, { method: 'OPTIONS' });
        console.log(`✅ ${config.name}: ${response.status}`);
      } catch (error) {
        console.log(`❌ ${config.name}: ${error}`);
      }
    }
  }
};

// Test WebSocket connections
export const testWebSocketConnections = async () => {
  console.log('🧪 Testing WebSocket connections...');
  
  for (const [key, config] of Object.entries(SERVER_CONFIG)) {
    if (config.wsUrl) {
      try {
        console.log(`🔍 Testing WebSocket: ${config.name}: ${config.wsUrl}`);
        
        const ws = new WebSocket(config.wsUrl);
        
        const result = await new Promise<{ success: boolean; error?: any }>((resolve) => {
          const timeout = setTimeout(() => {
            ws.close();
            resolve({ success: false, error: 'Timeout' });
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve({ success: true });
          };
          
          ws.onerror = (error) => {
            clearTimeout(timeout);
            resolve({ success: false, error: error });
          };
        });
        
        if (result.success) {
          console.log(`✅ WebSocket ${config.name}: Connected`);
        } else {
          console.log(`❌ WebSocket ${config.name}: Failed - ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ WebSocket ${config.name}: ${error}`);
      }
    }
  }
}; 