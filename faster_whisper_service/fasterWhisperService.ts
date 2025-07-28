import { FASTER_WHISPER_CONFIG, getApiUrl, buildEndpointUrl, isValidLanguage, getApiHeaders, validateApiToken } from './config';

export interface TranscriptionResult {
  success: boolean;
  text: string;
  language: string;
  language_probability: number;
}

export interface LanguageDetectionResult {
  success: boolean;
  language: string;
  language_probability: number;
}

export interface HealthCheckResult {
  status: string;
  model_loaded: boolean;
  service: string;
}

export class FasterWhisperService {
  private static instance: FasterWhisperService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = getApiUrl();
  }

  public static getInstance(): FasterWhisperService {
    if (!FasterWhisperService.instance) {
      FasterWhisperService.instance = new FasterWhisperService();
    }
    return FasterWhisperService.instance;
  }

  /**
   * Check if the service is healthy and ready
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      // Validate API token if required
      if (!validateApiToken()) {
        throw new Error('API token validation failed');
      }

      const response = await fetch(buildEndpointUrl(FASTER_WHISPER_CONFIG.ENDPOINTS.HEALTH), {
        method: 'GET',
        headers: getApiHeaders(),
        signal: AbortSignal.timeout(FASTER_WHISPER_CONFIG.REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      throw new Error(`Service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio file to text
   */
  async transcribeAudio(
    audioFile: File | Blob,
    language?: string,
    task: 'transcribe' | 'translate' = 'transcribe'
  ): Promise<TranscriptionResult> {
    try {
      // Validate API token if required
      if (!validateApiToken()) {
        throw new Error('API token validation failed');
      }

      // Validate file size
      if (audioFile.size > FASTER_WHISPER_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File size too large. Maximum allowed: ${FASTER_WHISPER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      // Validate language if provided
      if (language && !isValidLanguage(language)) {
        throw new Error(`Unsupported language: ${language}`);
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', audioFile);
      
      if (language) {
        formData.append('language', language);
      }
      
      if (task) {
        formData.append('task', task);
      }

      // Make request
      const response = await fetch(buildEndpointUrl(FASTER_WHISPER_CONFIG.ENDPOINTS.TRANSCRIBE), {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(FASTER_WHISPER_CONFIG.UPLOAD_TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Transcription failed');
      }

      return result;
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error(`Audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect the language of an audio file
   */
  async detectLanguage(audioFile: File | Blob): Promise<LanguageDetectionResult> {
    try {
      // Validate API token if required
      if (!validateApiToken()) {
        throw new Error('API token validation failed');
      }

      // Validate file size
      if (audioFile.size > FASTER_WHISPER_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File size too large. Maximum allowed: ${FASTER_WHISPER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', audioFile);

      // Make request
      const response = await fetch(buildEndpointUrl(FASTER_WHISPER_CONFIG.ENDPOINTS.DETECT_LANGUAGE), {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(FASTER_WHISPER_CONFIG.UPLOAD_TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Language detection failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Language detection failed');
      }

      return result;
    } catch (error) {
      console.error('Language detection error:', error);
      throw new Error(`Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio with automatic language detection
   */
  async transcribeWithAutoDetection(audioFile: File | Blob): Promise<TranscriptionResult> {
    try {
      // First detect the language
      const languageResult = await this.detectLanguage(audioFile);
      
      // Then transcribe with the detected language
      return await this.transcribeAudio(audioFile, languageResult.language);
    } catch (error) {
      console.error('Auto-detection transcription error:', error);
      throw new Error(`Auto-detection transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Record<string, string> {
    return { ...FASTER_WHISPER_CONFIG.SUPPORTED_LANGUAGES };
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return isValidLanguage(language);
  }

  /**
   * Get the current API URL
   */
  getApiUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if API token is configured
   */
  isTokenConfigured(): boolean {
    return !!FASTER_WHISPER_CONFIG.API_TOKEN;
  }

  /**
   * Check if authentication is required
   */
  isAuthenticationRequired(): boolean {
    return FASTER_WHISPER_CONFIG.REQUIRE_AUTH;
  }

  /**
   * Get API configuration status
   */
  getApiStatus(): {
    hasToken: boolean;
    requiresAuth: boolean;
    isConfigured: boolean;
  } {
    return {
      hasToken: this.isTokenConfigured(),
      requiresAuth: this.isAuthenticationRequired(),
      isConfigured: this.isTokenConfigured() || !this.isAuthenticationRequired(),
    };
  }
}

// Export singleton instance
export const fasterWhisperService = FasterWhisperService.getInstance(); 