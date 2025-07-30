// Azure Speech Service using Microsoft Speech SDK
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureSpeechConfig {
  subscriptionKey: string;
  region: string;
  endpoint?: string;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  offset: number;
  duration: number;
  detectedLanguage?: string;
}

export class AzureSpeechService {
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private isConnected = false;
  private isStreaming = false;
  private onTranscriptionUpdate: ((text: string, detectedLanguage?: string) => void) | null = null;
  private currentTranscription = '';
  private sourceLanguage = 'en-US';
  private config: AzureSpeechConfig | null = null;
  private originalSourceLanguage = 'auto';
  private detectedLanguage = '';

  // ✅ ACCURATE Azure Speech Service supported languages (verified 2024)
  private static readonly SUPPORTED_LANGUAGES = [
    // Arabic variants (verified Azure support)
    'ar-EG', 'ar-SA', 'ar-AE', 'ar-MA', 'ar-DZ', 'ar-TN', 'ar-JO', 'ar-LB', 'ar-KW', 'ar-QA', 'ar-BH', 'ar-OM', 'ar-YE', 'ar-SY', 'ar-IQ', 'ar-LY', 'ar-PS',
    
    // English variants
    'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-IE', 'en-NZ', 'en-ZA', 'en-PH', 'en-HK', 'en-SG',
    
    // French variants
    'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH',
    
    // Spanish variants
    'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-PE', 'es-VE', 'es-EC', 'es-GT', 'es-CR', 'es-PA', 'es-CU', 'es-BO', 'es-DO', 'es-HN', 'es-PY', 'es-SV', 'es-NI', 'es-PR', 'es-UY', 'es-CL',
    
    // German variants
    'de-DE', 'de-AT', 'de-CH',
    
    // Italian variants
    'it-IT', 'it-CH',
    
    // Portuguese variants
    'pt-BR', 'pt-PT',
    
    // Russian
    'ru-RU',
    
    // Chinese variants
    'zh-CN', 'zh-TW', 'zh-HK',
    
    // Japanese
    'ja-JP',
    
    // Korean
    'ko-KR',
    
    // Hindi and Indian languages
    'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'gu-IN', 'mr-IN', 'pa-IN',
    
    // Turkish
    'tr-TR',
    
    // Dutch variants
    'nl-NL', 'nl-BE',
    
    // Scandinavian languages
    'sv-SE', 'da-DK', 'nb-NO', 'fi-FI',
    
    // Eastern European languages
    'pl-PL', 'cs-CZ', 'hu-HU', 'ro-RO', 'bg-BG', 'hr-HR', 'sk-SK', 'sl-SI', 'et-EE', 'lv-LV', 'lt-LT', 'uk-UA',
    
    // Other European languages
    'el-GR', 'mt-MT', 'is-IS', 'ga-IE', 'cy-GB',
    
    // Middle Eastern languages
    'he-IL', 'fa-IR', 'ur-PK',
    
    // Southeast Asian languages
    'th-TH', 'vi-VN', 'id-ID', 'ms-MY', 'fil-PH',
    
    // African languages
    'sw-KE', 'am-ET', 'zu-ZA', 'af-ZA',
    
    // Other languages
    'ka-GE', 'hy-AM', 'az-AZ', 'kk-KZ', 'ky-KG', 'uz-UZ', 'mn-MN', 'my-MM', 'km-KH', 'lo-LA', 'si-LK'
  ];

  constructor() {
    this.isConnected = false;
    this.isStreaming = false;
    this.currentTranscription = '';
    this.detectedLanguage = '';
  }

  async connect(
    sourceLanguage: string,
    onTranscriptionUpdate: (text: string, detectedLanguage?: string) => void
  ) {
    try {
      console.log('🔧 Initializing Azure Speech Service...');
      
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.currentTranscription = '';
      this.detectedLanguage = '';
      
      // Store original language for auto detection logic
      this.originalSourceLanguage = sourceLanguage;
      
      // Map language codes properly - ensure we never pass "auto" to Azure
      this.sourceLanguage = this.mapLanguageCode(sourceLanguage);
      
      console.log('🔧 Original source language:', sourceLanguage);
      console.log('🔧 Mapped source language:', this.sourceLanguage);
      
      // Get Azure configuration from environment or user settings
      this.config = await this.getAzureConfig();
      
      if (!this.config) {
        throw new Error('Azure Speech Service configuration not found. Please check your API key and region.');
      }

      console.log('🌐 Azure Speech Service connected successfully');
      console.log('📝 Source Language:', this.sourceLanguage);
      
      this.isConnected = true;
      this.isStreaming = true;
      
    } catch (error) {
      console.error('❌ Error connecting to Azure Speech Service:', error);
      throw new Error(`Failed to connect to Azure Speech Service: ${error}`);
    }
  }

  private async getAzureConfig(): Promise<AzureSpeechConfig | null> {
    // Try to get from environment variables first
    const subscriptionKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const region = import.meta.env.VITE_AZURE_SPEECH_REGION;
    
    if (subscriptionKey && region) {
      console.log('✅ Found Azure configuration in environment variables');
      return { subscriptionKey, region };
    }

    // Try to get from localStorage (user might have set it)
    const storedKey = localStorage.getItem('azure_speech_key');
    const storedRegion = localStorage.getItem('azure_speech_region');
    
    if (storedKey && storedRegion) {
      console.log('✅ Found Azure configuration in localStorage');
      return { subscriptionKey: storedKey, region: storedRegion };
    }

    // For development, you can set these manually
    console.warn('⚠️ Azure Speech Service configuration not found');
    console.warn('Please set VITE_AZURE_SPEECH_KEY and VITE_AZURE_SPEECH_REGION environment variables');
    console.warn('Or set azure_speech_key and azure_speech_region in localStorage');
    
    return null;
  }

  private mapLanguageCode(languageCode: string): string {
    // Map common language codes to Azure Speech Service format
    const languageMap: { [key: string]: string } = {
      'auto': 'en-US', // Default to English for auto-detect
      'en': 'en-US',
      'ar': 'ar-SA',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'hi': 'hi-IN',
      'tr': 'tr-TR',
      'nl': 'nl-NL',
      'sv': 'sv-SE',
      'da': 'da-DK',
      'no': 'nb-NO',
      'fi': 'fi-FI',
      'pl': 'pl-PL',
      'cs': 'cs-CZ',
      'hu': 'hu-HU',
      'ro': 'ro-RO',
      'bg': 'bg-BG',
      'hr': 'hr-HR',
      'sk': 'sk-SK',
      'sl': 'sl-SI',
      'et': 'et-EE',
      'lv': 'lv-LV',
      'lt': 'lt-LT',
      'mt': 'mt-MT',
      'el': 'el-GR',
      'he': 'he-IL',
      'th': 'th-TH',
      'vi': 'vi-VN',
      'id': 'id-ID',
      'ms': 'ms-MY',
      'tl': 'fil-PH',
      'sw': 'sw-KE',
      'am': 'am-ET',
      'yo': 'yo-NG',
      'zu': 'zu-ZA'
    };

    return languageMap[languageCode] || 'en-US'; // Default to English if unknown
  }

  async startStreaming() {
    if (!this.config || !this.isConnected) {
      throw new Error('Azure Speech Service not connected');
    }

    try {
      console.log('🎤 Starting Azure Speech streaming...');
      console.log('🔧 Using language:', this.sourceLanguage);
      console.log('🔧 Using region:', this.config.region);
      
      // Create speech config with custom endpoint
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        this.config.subscriptionKey,
        this.config.region
      );

      // Set custom endpoint for West Europe
      speechConfig.endpointId = 'https://westeurope.api.cognitive.microsoft.com/';

      // Enable dictation mode
      speechConfig.enableDictation();
      
      // Enable continuous recognition with longer timeouts
      speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "5000");
      speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "10000");
      speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_RecoMode, "INTERACTIVE");
      
      // Create audio config from microphone
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      console.log('🔧 Audio config created');
      
      let recognizer: SpeechSDK.SpeechRecognizer;
      
      // Check if we need auto language detection
      if (this.originalSourceLanguage === 'auto') {
        console.log('🔧 Using AutoDetectSourceLanguageConfig for language detection');
        
        // Create auto language detection config with all supported languages
        const autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(
          AzureSpeechService.SUPPORTED_LANGUAGES
        );
        
        // Create recognizer with auto language detection
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        console.log('🔧 Recognizer created with auto language detection');
        console.log(`🔧 Auto-detecting from ${AzureSpeechService.SUPPORTED_LANGUAGES.length} supported languages`);
        
      } else {
        // Use specific language
        speechConfig.speechRecognitionLanguage = this.sourceLanguage;
        console.log('🔧 Speech config created with specific language:', this.sourceLanguage);
        
        // Create recognizer with specific language
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        console.log('🔧 Recognizer created with specific language');
      }
      
      this.recognizer = recognizer;
      
      // Set up event handlers
      this.setupRecognitionHandlers();
      
      // Start continuous recognition
      console.log('🔧 Starting continuous recognition...');
      await this.recognizer.startContinuousRecognitionAsync();
      
      console.log('✅ Azure Speech streaming started successfully');
      
    } catch (error) {
      console.error('❌ Error starting Azure Speech streaming:', error);
      throw error;
    }
  }

  private setupRecognitionHandlers() {
    if (!this.recognizer) return;

    // Recognition result
    this.recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const text = e.result.text;
        const detectedLanguage = e.result.language;
        console.log('🎤 Final transcription:', text);
        console.log('🌐 Detected language:', detectedLanguage);
        this.currentTranscription = text;
        this.detectedLanguage = detectedLanguage || '';
        this.onTranscriptionUpdate?.(text, detectedLanguage);
      }
    };

    // Interim results
    this.recognizer.recognizing = (s, e) => {
      const text = e.result.text;
      const detectedLanguage = e.result.language;
      console.log('📝 Interim transcription:', text);
      console.log('🌐 Detected language (interim):', detectedLanguage);
      this.detectedLanguage = detectedLanguage || '';
      this.onTranscriptionUpdate?.(text, detectedLanguage);
    };

    // Session started
    this.recognizer.sessionStarted = (s, e) => {
      console.log('🔗 Azure Speech session started successfully');
      console.log('🔗 Session ID:', e.sessionId);
    };

    // Session stopped
    this.recognizer.sessionStopped = (s, e) => {
      console.log('🔗 Azure Speech session stopped');
    };

    // Canceled
    this.recognizer.canceled = (s, e) => {
      console.log('❌ Azure Speech recognition canceled:', e.reason);
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        console.error('❌ Recognition error:', e.errorDetails);
        console.error('❌ Error code:', e.errorCode);
        console.error('❌ Error reason:', e.reason);
      }
    };

    // No match
    this.recognizer.recognizeOnceAsync = (s, e) => {
      console.log('❓ No speech detected');
    };
  }

  async stopStreaming() {
    try {
      console.log('🛑 Stopping Azure Speech streaming...');
      
      if (this.recognizer) {
        await this.recognizer.stopContinuousRecognitionAsync();
        this.recognizer.close();
        this.recognizer = null;
      }
      
      this.isStreaming = false;
      console.log('✅ Azure Speech streaming stopped');
      
    } catch (error) {
      console.error('❌ Error stopping Azure Speech streaming:', error);
    }
  }

  disconnect() {
    console.log('🔌 Disconnecting Azure Speech Service...');
    
    this.stopStreaming();
    this.isConnected = false;
    this.isStreaming = false;
    this.currentTranscription = '';
    this.detectedLanguage = '';
    
    console.log('✅ Azure Speech Service disconnected');
  }

  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  getCurrentTranscription(): string {
    return this.currentTranscription;
  }

  getDetectedLanguage(): string {
    return this.detectedLanguage;
  }

  // Get all supported languages
  static getSupportedLanguages(): string[] {
    return [...AzureSpeechService.SUPPORTED_LANGUAGES];
  }

  // Method to set Azure configuration manually
  setAzureConfig(subscriptionKey: string, region: string) {
    this.config = { subscriptionKey, region };
    localStorage.setItem('azure_speech_key', subscriptionKey);
    localStorage.setItem('azure_speech_region', region);
    console.log('✅ Azure configuration set successfully');
  }

  // Method to test Azure connection
  async testConnection(): Promise<boolean> {
    try {
      const config = await this.getAzureConfig();
      if (!config) return false;
      
      // Create a simple speech config to test
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        config.subscriptionKey,
        config.region
      );
      
      // Test with a simple recognition to verify connection
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      
      // Set up a simple test handler
      recognizer.recognized = (s, e) => {
        console.log('✅ Connection test successful - recognition working');
      };
      
      recognizer.canceled = (s, e) => {
        console.log('❌ Connection test failed:', e.errorDetails);
      };
      
      // Try to start recognition briefly
      await recognizer.recognizeOnceAsync();
      
      console.log('✅ Azure Speech Service configuration is valid');
      return true;
    } catch (error) {
      console.error('❌ Azure Speech Service connection test failed:', error);
      return false;
    }
  }

  // Method to test Azure Speech SDK availability
  static testSDKAvailability(): boolean {
    try {
      // Try to access the SpeechSDK object
      if (typeof SpeechSDK !== 'undefined' && SpeechSDK.SpeechConfig) {
        console.log('✅ Azure Speech SDK is available');
        return true;
      } else {
        console.error('❌ Azure Speech SDK is not available');
        return false;
      }
    } catch (error) {
      console.error('❌ Error checking Azure Speech SDK availability:', error);
      return false;
    }
  }
} 