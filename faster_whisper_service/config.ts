// Faster Whisper Service Configuration
export const FASTER_WHISPER_CONFIG = {
  // Production Hugging Face Spaces URL (no port needed - HF handles it)
  PRODUCTION_URL: 'https://alaaharoun-faster-whisper-api.hf.space',
  
  // Local development URL (for testing locally)
  LOCAL_URL: 'http://localhost:7860',
  
  // Docker URL (if running locally with Docker)
  DOCKER_URL: 'http://localhost:7860',
  
  // API Token Configuration
  API_TOKEN: '',
  
  // API Endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    TRANSCRIBE: '/transcribe',
    DETECT_LANGUAGE: '/detect-language',
    ROOT: '/'
  },
  
  // Default settings
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_TASK: 'transcribe',
  
  // Supported languages
  SUPPORTED_LANGUAGES: {
    'en': 'English',
    'ar': 'Arabic',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean'
  },
  
  // Audio file settings
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  SUPPORTED_FORMATS: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm'],
  
  // Timeout settings
  REQUEST_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TIMEOUT: 60000,  // 60 seconds
  
  // Authentication settings
  REQUIRE_AUTH: false, // Set to true if API token is required
};

// Helper function to get the current API URL
export function getApiUrl(): string {
  // Check if we're in development mode
  if (__DEV__) {
    return FASTER_WHISPER_CONFIG.LOCAL_URL;
  }
  
  // In production, use the Hugging Face Spaces URL
  return FASTER_WHISPER_CONFIG.PRODUCTION_URL;
}

// Helper function to build endpoint URL
export function buildEndpointUrl(endpoint: string): string {
  const baseUrl = getApiUrl();
  return `${baseUrl}${endpoint}`;
}

// Helper function to validate language code
export function isValidLanguage(language: string): boolean {
  return language in FASTER_WHISPER_CONFIG.SUPPORTED_LANGUAGES;
}

// Helper function to get language name
export function getLanguageName(languageCode: string): string {
  return FASTER_WHISPER_CONFIG.SUPPORTED_LANGUAGES[languageCode as keyof typeof FASTER_WHISPER_CONFIG.SUPPORTED_LANGUAGES] || languageCode;
}

// Helper function to get API headers
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (FASTER_WHISPER_CONFIG.API_TOKEN && FASTER_WHISPER_CONFIG.REQUIRE_AUTH) {
    headers['Authorization'] = `Bearer ${FASTER_WHISPER_CONFIG.API_TOKEN}`;
  }
  
  return headers;
}

// Helper function to validate API token
export function validateApiToken(): boolean {
  if (FASTER_WHISPER_CONFIG.REQUIRE_AUTH && !FASTER_WHISPER_CONFIG.API_TOKEN) {
    console.warn('⚠️ Faster Whisper API token is required but not provided');
    return false;
  }
  return true;
} 