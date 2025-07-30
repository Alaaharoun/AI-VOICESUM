// Render WebSocket Service for Real-time Transcription
import { getServerConfig } from '../config/servers';

export class RenderWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isStreaming = false;
  private isInitialized = false;
  private onTranscriptionUpdate: ((text: string, detectedLanguage?: string) => void) | null = null;
  private currentTranscription = '';
  private sourceLanguage = 'auto';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private pongTimeout: number | null = null;
  private connectionTimeout: number | null = null;
  private isReconnecting = false;
  private shouldReconnect = true;
  private audioQueue: Blob[] = []; // Queue for audio chunks before initialization
  private isInitMessageSent = false; // Track if init message has been sent
  private detectedLanguage = '';
  private serverSupportedLanguages: string[] = []; // Languages supported by server
  private languageValidationResult: { isValid: boolean; message?: string; supportedLanguages?: string[] } | null = null;

  constructor() {
    this.isConnected = false;
    this.isStreaming = false;
    this.isInitialized = false;
    this.currentTranscription = '';
    this.audioQueue = [];
    this.isInitMessageSent = false;
    this.detectedLanguage = '';
    this.serverSupportedLanguages = [];
    this.languageValidationResult = null;
  }

  // ✅ Azure Speech Service supported languages (verified 2024)
  private static readonly AZURE_SUPPORTED_LANGUAGES = [
    // Auto-detect (special value)
    'auto',
    // Arabic variants (verified Azure support)
    'ar-EG', 'ar-SA', 'ar-AE', 'ar-MA', 'ar-DZ', 'ar-TN', 'ar-JO', 'ar-LB', 'ar-KW', 'ar-QA', 'ar-BH', 'ar-OM', 'ar-YE', 'ar-SY', 'ar-IQ', 'ar-LY', 'ar-PS',
    // English variants
    'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-IE', 'en-NZ', 'en-ZA', 'en-PH',
    // French variants
    'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH', 'fr-LU', 'fr-MC',
    // Spanish variants
    'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-PE', 'es-VE', 'es-EC', 'es-GT', 'es-CR', 'es-PA', 'es-CU', 'es-BO', 'es-DO', 'es-HN', 'es-PY', 'es-SV', 'es-NI', 'es-PR', 'es-UY', 'es-GQ', 'es-CL',
    // German variants
    'de-DE', 'de-AT', 'de-CH', 'de-LU', 'de-LI',
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
    // Hindi
    'hi-IN',
    // Turkish
    'tr-TR',
    // Dutch
    'nl-NL', 'nl-BE',
    // Swedish
    'sv-SE', 'sv-FI',
    // Danish
    'da-DK',
    // Norwegian
    'nb-NO', 'nn-NO',
    // Finnish
    'fi-FI',
    // Polish
    'pl-PL',
    // Czech
    'cs-CZ',
    // Hungarian
    'hu-HU',
    // Romanian
    'ro-RO',
    // Bulgarian
    'bg-BG',
    // Croatian
    'hr-HR',
    // Slovak
    'sk-SK',
    // Slovenian
    'sl-SI',
    // Estonian
    'et-EE',
    // Latvian
    'lv-LV',
    // Lithuanian
    'lt-LT',
    // Maltese
    'mt-MT',
    // Greek
    'el-GR',
    // Hebrew
    'he-IL',
    // Thai
    'th-TH',
    // Vietnamese
    'vi-VN',
    // Indonesian
    'id-ID',
    // Malay
    'ms-MY',
    // Filipino
    'fil-PH',
    // Persian
    'fa-IR',
    // Urdu
    'ur-PK',
    // Bengali
    'bn-IN',
    // Tamil
    'ta-IN',
    // Telugu
    'te-IN',
    // Kannada
    'kn-IN',
    // Malayalam
    'ml-IN',
    // Gujarati
    'gu-IN',
    // Marathi
    'mr-IN',
    // Punjabi
    'pa-IN'
  ];

  /**
   * ✅ Validate source language support
   */
  validateSourceLanguage(sourceLanguage: string): { isValid: boolean; message?: string; suggestion?: string } {
    // Check if language is in Azure supported languages
    const isSupported = RenderWebSocketService.AZURE_SUPPORTED_LANGUAGES.includes(sourceLanguage);
    
    if (isSupported) {
      console.log('✅ Language validation passed:', sourceLanguage);
      return { 
        isValid: true, 
        message: `Language ${sourceLanguage} is supported by Azure Speech Service` 
      };
    }
    
    // Try to find similar language or suggest alternatives
    const baseLang = sourceLanguage.split('-')[0]; // e.g., 'ar' from 'ar-EG'
    const similarLanguages = RenderWebSocketService.AZURE_SUPPORTED_LANGUAGES.filter(lang => 
      lang.startsWith(baseLang + '-') || lang === baseLang
    );
    
    console.warn('⚠️ Language validation failed:', sourceLanguage);
    console.log('💡 Similar supported languages:', similarLanguages);
    
    let suggestion = '';
    if (similarLanguages.length > 0) {
      suggestion = similarLanguages[0]; // Suggest first similar language
    } else if (baseLang === 'ar') {
      suggestion = 'ar-SA'; // Default Arabic
    } else if (baseLang === 'en') {
      suggestion = 'en-US'; // Default English
    } else if (baseLang === 'fr') {
      suggestion = 'fr-FR'; // Default French
    } else if (baseLang === 'es') {
      suggestion = 'es-ES'; // Default Spanish
    } else if (baseLang === 'de') {
      suggestion = 'de-DE'; // Default German
    } else {
      suggestion = 'auto'; // Auto-detect as fallback
    }
    
    return {
      isValid: false,
      message: `Language '${sourceLanguage}' is not supported by Azure Speech Service. ${similarLanguages.length} similar languages found.`,
      suggestion: suggestion
    };
  }

  /**
   * ✅ Test server language support
   */
  async testLanguageSupport(sourceLanguage: string): Promise<{ isSupported: boolean; serverResponse?: any; error?: string }> {
    try {
      console.log('🔍 Testing server language support for:', sourceLanguage);
      
      // First validate client-side
      const clientValidation = this.validateSourceLanguage(sourceLanguage);
      if (!clientValidation.isValid) {
        console.warn('⚠️ Client-side language validation failed:', clientValidation.message);
        return {
          isSupported: false,
          error: `Client validation failed: ${clientValidation.message}. Suggested: ${clientValidation.suggestion}`
        };
      }
      
      const serverConfig = getServerConfig('azure', true);
      
      // Test with a simple WebSocket connection
      const testWs = new WebSocket(serverConfig.wsUrl);
      
      const result = await new Promise<{ isSupported: boolean; serverResponse?: any; error?: string }>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Language support test timeout');
          testWs.close();
          resolve({ 
            isSupported: false, 
            error: 'Timeout waiting for server response' 
          });
        }, 8000);
        
        testWs.onopen = () => {
          console.log('🔗 Test WebSocket opened for language validation');
          
          // Send language test message
          const testMessage = {
            type: 'language_test',
            sourceLanguage: sourceLanguage,
            test: true
          };
          
          console.log('📤 Sending language test message:', testMessage);
          testWs.send(JSON.stringify(testMessage));
        };
        
        testWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Language test response:', data);
            
            clearTimeout(timeout);
            testWs.close();
            
            if (data.type === 'language_support') {
              resolve({
                isSupported: data.supported === true,
                serverResponse: data,
                error: data.supported ? undefined : data.message || 'Language not supported by server'
              });
            } else if (data.type === 'error' && data.message?.includes('language')) {
              resolve({
                isSupported: false,
                serverResponse: data,
                error: data.message
              });
            } else {
              // If server doesn't respond with language_support, assume it's supported
              // (older server versions might not have this feature)
              console.log('💡 Server does not support language testing, assuming language is supported');
              resolve({
                isSupported: true,
                serverResponse: data,
                error: undefined
              });
            }
          } catch (parseError) {
            console.error('❌ Error parsing language test response:', parseError);
            clearTimeout(timeout);
            testWs.close();
            resolve({
              isSupported: false,
              error: 'Invalid server response format'
            });
          }
        };
        
        testWs.onerror = (error) => {
          console.error('❌ Language test WebSocket error:', error);
          clearTimeout(timeout);
          resolve({
            isSupported: false,
            error: 'WebSocket connection error during language test'
          });
        };
        
        testWs.onclose = (event) => {
          console.log('🔌 Language test WebSocket closed:', event.code, event.reason);
          clearTimeout(timeout);
          if (event.code !== 1000) {
            resolve({
              isSupported: false,
              error: `WebSocket closed unexpectedly: ${event.code} ${event.reason}`
            });
          }
        };
      });
      
      console.log('✅ Language support test completed:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Language support test error:', error);
      return {
        isSupported: false,
        error: `Language test failed: ${error}`
      };
    }
  }

  async connect(
    sourceLanguage: string,
    onTranscriptionUpdate: (text: string, detectedLanguage?: string) => void
  ) {
    try {
      console.log('🔧 Initializing Render WebSocket service...');
      console.log('🔧 Connect called with sourceLanguage:', sourceLanguage);
      
      // ✅ Validate language before connecting
      console.log('🔍 Validating source language before connection...');
      const languageValidation = this.validateSourceLanguage(sourceLanguage);
      this.languageValidationResult = languageValidation;
      
      if (!languageValidation.isValid) {
        console.warn('⚠️ Language validation warning:', languageValidation.message);
        console.log('💡 Suggested language:', languageValidation.suggestion);
        
        // Don't fail connection, but warn user
        console.log('🔄 Continuing with suggested language:', languageValidation.suggestion);
        sourceLanguage = languageValidation.suggestion || 'auto';
      }
      
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.currentTranscription = '';
      this.sourceLanguage = sourceLanguage;
      this.isInitialized = false;
      this.isInitMessageSent = false;
      this.shouldReconnect = true;
      this.audioQueue = []; // Clear audio queue
      this.detectedLanguage = '';
      
      // Get server configuration
      const serverConfig = getServerConfig('azure', true);
      console.log('🔧 Using server:', serverConfig.name);
      console.log('🔧 WebSocket URL:', serverConfig.wsUrl);
      
      // Test server health first
      try {
        const healthResponse = await fetch(serverConfig.healthUrl);
        if (!healthResponse.ok) {
          throw new Error(`Server health check failed: ${healthResponse.status}`);
        }
        console.log('✅ Server health check passed');
      } catch (healthError) {
        console.warn('⚠️ Server health check failed:', healthError);
        // Continue anyway, as the WebSocket might still work
      }
      
      // Create WebSocket connection with timeout
      await this.createWebSocketConnection(serverConfig.wsUrl);
      
      console.log('✅ Render WebSocket service connected successfully');
      this.isConnected = true;
      this.isStreaming = true;
      console.log('🔧 Set isStreaming to true');
      this.isInitialized = false; // Will be set to true when server sends "Ready for audio input"
      
    } catch (error) {
      console.error('❌ Error connecting to Render WebSocket service:', error);
      
      // Provide helpful error message
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
        console.error('🔧 Server issue detected: WebSocket endpoint not found');
        console.error('💡 This might be because:');
        console.error('   1. The server is running Faster Whisper instead of Azure Speech Service');
        console.error('   2. The WebSocket endpoint path is incorrect');
        console.error('   3. The server needs to be redeployed with Azure Speech Service');
        console.error('💡 Solutions:');
        console.error('   1. Deploy the Azure server using azure-server.js');
        console.error('   2. Update the client to work with Faster Whisper');
        console.error('   3. Check the server configuration');
      }
      
      throw new Error(`Failed to connect to Render WebSocket service: ${error}`);
    }
  }

  private async createWebSocketConnection(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000); // 10 seconds timeout

      // Create WebSocket connection
      this.ws = new WebSocket(wsUrl);
      
      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(resolve, reject);
    });
  }

  private setupWebSocketHandlers(
    onConnect?: () => void,
    onError?: (error: Error) => void
  ) {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('🔗 WebSocket connection opened');
      this.isConnected = true;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      
      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      // Start ping/pong mechanism
      this.startPingPong();
      
      // Send init message immediately after connection
      console.log('🔄 Connection established, sending init message...');
      console.log('📊 WebSocket state before sending init:', this.ws?.readyState);
      this.sendInitMessage();
      
      // Set initialization timeout - if server doesn't respond within 3 seconds, assume it's ready
              setTimeout(() => {
          if (!this.isInitialized && this.isConnected) {
            console.log('⏰ Initialization timeout - assuming server is ready for audio input');
            this.isInitialized = true;
            this.processAudioQueue(); // Process any queued audio
          }
        }, 3000); // Reduced timeout to 3 seconds for faster response
      
      onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', {
          type: data.type,
          hasText: !!data.text,
          hasMessage: !!data.message,
          timestamp: Date.now(),
          fullData: data
        });
        
        // Reset pong timeout on any message
        this.resetPongTimeout();
        
        // Handle different message types
        if (data.type === 'transcription') {
          console.log('📝 Received transcription:', data.text);
          const detectedLanguage = data.detectedLanguage || data.language;
          this.detectedLanguage = detectedLanguage || '';
          if (this.onTranscriptionUpdate) {
            this.onTranscriptionUpdate(data.text, detectedLanguage);
          }
        } else if (data.type === 'final') {
          console.log('✅ Received final transcription:', data.text);
          const detectedLanguage = data.detectedLanguage || data.language;
          this.detectedLanguage = detectedLanguage || '';
          if (this.onTranscriptionUpdate) {
            this.onTranscriptionUpdate(data.text, detectedLanguage);
          }
        } else if (data.type === 'status') {
          console.log('📊 Server status:', data.message);
          // Check if server is ready for audio input
          if (data.message === 'Ready for audio input' || data.message === 'ready' || data.message === 'initialized' || data.message === 'Server ready') {
            this.isInitialized = true;
            console.log('✅ Server initialization completed, ready for audio input');
            this.processAudioQueue(); // Process any queued audio
          }
        } else if (data.type === 'language_support') {
          console.log('🌍 Server language support response:', data);
          if (data.supported) {
            console.log('✅ Server confirmed language support for:', this.sourceLanguage);
            this.serverSupportedLanguages.push(this.sourceLanguage);
          } else {
            console.warn('⚠️ Server does not support language:', this.sourceLanguage);
            console.log('💡 Server suggested languages:', data.suggestions);
          }
        } else if (data.type === 'language_detected') {
          console.log('🔍 Server detected language:', data.language);
          this.detectedLanguage = data.language;
          // Validate detected language
          const detectedValidation = this.validateSourceLanguage(data.language);
          if (detectedValidation.isValid) {
            console.log('✅ Detected language is supported:', data.language);
          } else {
            console.warn('⚠️ Detected language may not be fully supported:', data.language);
          }
        } else if (data.type === 'ready') {
          console.log('✅ Server ready message received');
          this.isInitialized = true;
          this.processAudioQueue(); // Process any queued audio
        } else if (data.type === 'initialized') {
          console.log('✅ Server initialized message received');
          this.isInitialized = true;
          this.processAudioQueue(); // Process any queued audio
        } else if (data.type === 'init_ack') {
          console.log('✅ Server init acknowledgment received');
          this.isInitialized = true;
          this.processAudioQueue(); // Process any queued audio
        } else if (data.type === 'pong') {
          // Consider pong as a sign that server is ready
          console.log('🏓 Pong received - considering server ready for audio');
          if (!this.isInitialized) {
            this.isInitialized = true;
            console.log('✅ Server considered ready after pong');
          }
        } else if (data.type === 'error') {
          console.error('❌ Server error:', data.message);
          // Don't reset isInitialized for quota exceeded errors
          if (data.error && data.error.includes('Quota exceeded')) {
            console.warn('⚠️ Azure quota exceeded, but keeping connection alive');
            // Keep isInitialized true to continue audio processing
            // Try to reinitialize after a delay
            setTimeout(() => {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log('🔄 Attempting to reinitialize after quota error...');
                this.sendInitMessage();
              }
            }, 2000);
          } else {
            this.isInitialized = false;
          }
        } else if (data.type === 'warning') {
          console.warn('⚠️ Server warning:', data.message);
          if (data.audioStats) {
            console.log('📊 Audio stats:', data.audioStats);
          }
        } else if (data.type === 'ping') {
          // Server sent ping, respond with pong
          console.log('🏓 Ping received from server, sending pong');
          this.sendMessage({ type: 'pong' });
        } else if (data.type === 'pong') {
          console.log('🏓 Pong received');
          // Clear pong timeout since we received the response
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }
        } else {
          console.log('📨 Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket connection closed:', event.code, event.reason);
      this.isConnected = false;
      this.isInitialized = false;
      this.isInitMessageSent = false;
      this.stopPingPong();
      
      // Attempt to reconnect if not manually closed and should reconnect
      if (event.code !== 1000 && this.shouldReconnect && !this.isReconnecting) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.isConnected = false;
      this.isInitialized = false;
      this.isInitMessageSent = false;
      onError?.(new Error('WebSocket connection failed'));
    };
  }

  private startPingPong() {
    // Send ping every 15 seconds (reduced from 30 for better reliability)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        console.log('🏓 Ping sent');
        
        // Set pong timeout
        this.resetPongTimeout();
      }
    }, 15000) as any;
  }

  private resetPongTimeout() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
    }
    
    // Expect pong within 15 seconds (increased from 10 for better tolerance)
    this.pongTimeout = setTimeout(() => {
      console.warn('⚠️ Pong timeout, connection may be stale');
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('🔄 Attempting to reconnect due to pong timeout...');
        this.ws.close(1000, 'Pong timeout');
        // Trigger reconnection
        if (this.shouldReconnect && !this.isReconnecting) {
          this.attemptReconnect();
        }
      }
    }, 15000) as any;
  }

  private stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private attemptReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('⚠️ Max reconnection attempts reached or already reconnecting');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff, max 30s
    
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        const serverConfig = getServerConfig('azure', true);
        await this.createWebSocketConnection(serverConfig.wsUrl);
        console.log('✅ Reconnection successful');
      } catch (error) {
        console.error('❌ Reconnection failed:', error);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          console.error('❌ Max reconnection attempts reached');
        }
      }
    }, delay) as any;
  }

  private sendMessage(message: any) {
    console.log('🔄 sendMessage called with:', {
      type: message.type,
      hasData: !!message.data,
      dataLength: message.data ? message.data.length : 0,
      wsExists: !!this.ws,
      wsState: this.ws?.readyState
    });
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        console.log('🔄 Sending message via WebSocket, JSON length:', messageStr.length);
        
        this.ws.send(messageStr);
        
        console.log('✅ Message sent successfully via WebSocket:', {
          type: message.type,
          messageLength: messageStr.length,
          timestamp: Date.now()
        });
        
        // For audio messages, don't log the full data to avoid console spam
        if (message.type === 'audio') {
          console.log('📤 Audio message details:', {
            type: message.type,
            format: message.format,
            dataLength: message.data?.length,
            size: message.size
          });
        } else {
          console.log('📤 Non-audio message sent:', message);
        }
        
      } catch (error) {
        console.error('❌ Error sending message via WebSocket:', error);
      }
    } else {
      console.warn('⚠️ WebSocket not ready, cannot send message:', {
        wsExists: !!this.ws,
        wsState: this.ws?.readyState,
        messageType: message.type,
        stateMapping: 'CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3'
      });
    }
  }

  private async sendInitMessage() {
    try {
      if (this.isInitMessageSent) {
        console.log('⚠️ Init message already sent, skipping...');
        return;
      }

      console.log('📤 Preparing to send init message...');
      console.log('📊 WebSocket state:', this.ws?.readyState);
      console.log('📊 Connection status:', this.isConnected);

      console.log('📤 Sending init message:', {
        type: 'init',
        sourceLanguage: this.sourceLanguage,
        realTime: true
      });

      const initMessage = {
        type: 'init',
        sourceLanguage: this.sourceLanguage,
        realTime: true
      };

      this.sendMessage(initMessage);
      this.isInitMessageSent = true;
      console.log('✅ Init message sent successfully');
      console.log('📤 Sent init message to server:', {
        type: 'init',
        sourceLanguage: this.sourceLanguage,
        realTime: true
      });
      
      // Add a small delay to ensure the message is sent
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('⏳ Init message sent, waiting for server response...');

      // Audio conversion will be tested with real audio data
      console.log('✅ Audio conversion ready for real audio data');

    } catch (error) {
      console.error('❌ Error sending init message:', error);
    }
  }

  sendAudioChunk(audioChunk: Blob) {
    console.log('🔍 Audio chunk status check:', {
      isStreaming: this.isStreaming,
      isConnected: this.isConnected,
      wsExists: !!this.ws,
      wsReadyState: this.ws?.readyState,
      wsOpen: this.ws?.readyState === WebSocket.OPEN,
      isInitMessageSent: this.isInitMessageSent,
      isInitialized: this.isInitialized,
      audioChunkSize: audioChunk.size,
      audioChunkType: audioChunk.type
    });
    
    // تحليل مفصل لسبب رفض إرسال الصوت
    const failureReasons: string[] = [];
    
    if (!this.isStreaming) failureReasons.push('isStreaming = false');
    if (!this.isConnected) failureReasons.push('isConnected = false');
    if (!this.ws) failureReasons.push('WebSocket is null');
    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
      failureReasons.push(`WebSocket not ready (state: ${this.ws.readyState})`);
    }
    
    if (failureReasons.length > 0) {
      console.warn('⚠️ Cannot send audio chunk - Reasons:', failureReasons);
      console.warn('📊 WebSocket States: CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3');
      
      // Special case: if WebSocket is connected but streaming is stopped, try to restart streaming
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN && !this.isStreaming) {
        console.log('🔄 WebSocket connected but streaming stopped - attempting FORCE auto-restart...');
        console.log('📊 Before auto-restart:', {
          isStreaming: this.isStreaming,
          isConnected: this.isConnected,
          wsReadyState: this.ws.readyState,
          isInitMessageSent: this.isInitMessageSent,
          isInitialized: this.isInitialized
        });
        
        try {
          // FORCE streaming to true
          this.isStreaming = true;
          console.log('🔧 FORCED streaming flag to TRUE');
          
          // Clear any lingering state
          this.audioQueue = [];
          
          // Always re-send init message for safety
          console.log('📤 Re-sending init message for auto-restart...');
          this.isInitMessageSent = false; // Force re-send
          this.sendInitMessage();
          
          console.log('📊 After auto-restart setup:', {
            isStreaming: this.isStreaming,
            isInitMessageSent: this.isInitMessageSent
          });
          
          // Try to send the audio chunk now
          console.log('📤 Retrying audio chunk after FORCE auto-restart...');
          this.sendAudioData(audioChunk);
          
          console.log('✅ FORCE auto-restart completed successfully');
          return;
        } catch (error) {
          console.error('❌ FORCE auto-restart failed:', error);
          this.isStreaming = false;
        }
      }
      
      return;
    }

    console.log('✅ All checks passed, proceeding to send audio chunk');

    // Send init message if not sent yet
    if (!this.isInitMessageSent && this.isConnected) {
      console.log('🔄 Sending init message before audio chunk...');
      this.sendInitMessage();
    }

    // Send audio data directly - more permissive approach
    console.log('📤 Sending audio chunk directly');
    this.sendAudioData(audioChunk);
  }

  private processAudioQueue() {
    if (this.audioQueue.length === 0) {
      console.log('📦 Audio queue is empty');
      return;
    }

    console.log('📦 Processing audio queue with', this.audioQueue.length, 'chunks');
    
    // Process all queued audio chunks
    while (this.audioQueue.length > 0) {
      const chunk = this.audioQueue.shift();
      if (chunk) {
        console.log('📤 Sending queued audio chunk');
        this.sendAudioData(chunk);
      }
    }
    
    console.log('✅ Audio queue processed');
  }

  // ✅ دالة فحص محسنة للـ Raw PCM والبيانات الصوتية
  private async validateAudioChunk(audioChunk: Blob): Promise<{isValid: boolean, reason?: string}> {
    try {
      // 1. فحص الحجم الأساسي
      if (!audioChunk || audioChunk.size === 0) {
        return { isValid: false, reason: 'Empty or null audio chunk' };
      }

      if (audioChunk.size < 32) { // Very minimal for Raw PCM
        return { isValid: false, reason: 'Audio chunk too small (< 32 bytes)' };
      }

      // 2. فحص نوع الصوت
      const audioType = audioChunk.type || '';

      // 3. ✅ معالجة خاصة للـ Raw PCM (الأولوية الأولى)
      if (audioType.includes('pcm')) {
        console.log('✅ Raw PCM audio detected - optimized for Azure Speech Service');
        
        // Basic PCM validation
        if (audioChunk.size >= 1024) { // At least 1KB for good quality
          console.log('✅ Raw PCM chunk size excellent:', audioChunk.size, 'bytes');
        } else {
          console.log('📤 Small PCM chunk:', audioChunk.size, 'bytes - acceptable for Azure');
        }
        
        return { isValid: true };
      }

      // 4. للـ WAV، فحص مبسط
      if (audioType.includes('wav')) {
        console.log('✅ WAV audio detected - good for Azure Speech Service');
        return { isValid: true };
      }

      // 5. فحص WebM/Opus (legacy support مع تحذير)
      if (audioType.includes('webm') || audioType.includes('opus')) {
        console.warn('⚠️ WebM detected - Raw PCM is strongly preferred for Azure Speech Service');
        return await this.validateWebMChunk(audioChunk);
      }

      // 6. للأنواع الأخرى أو المجهولة، اقبلها مع تحذير
      if (!audioType) {
        console.log('⚠️ No audio type specified, assuming Raw PCM');
        return { isValid: true };
      }

      console.log('✅ Audio chunk validation passed (unknown type):', {
        size: audioChunk.size,
        type: audioType
      });

      return { isValid: true };

    } catch (error) {
      console.error('❌ Audio validation error:', error);
      return { isValid: false, reason: `Validation error: ${error}` };
    }
  }

  // ✅ فحص خاص لملفات WebM
  private async validateWebMChunk(audioChunk: Blob): Promise<{isValid: boolean, reason?: string}> {
    try {
      // قراءة أول بضعة بايتات لفحص WebM header
      const headerBuffer = await audioChunk.slice(0, 32).arrayBuffer();
      const headerView = new Uint8Array(headerBuffer);

      // ✅ Strict size validation - minimum 10KB for WebM chunks
      if (audioChunk.size < 10240) { // 10KB minimum to match server validation
        return { 
          isValid: false, 
          reason: `WebM chunk too small: ${audioChunk.size} bytes (minimum 10KB required)` 
        };
      }

      // WebM يجب أن يبدأ بـ EBML signature
      // EBML magic number: 0x1A, 0x45, 0xDF, 0xA3
      if (headerView.length >= 4) {
        const ebmlSignature = [0x1A, 0x45, 0xDF, 0xA3];
        const hasValidHeader = ebmlSignature.every((byte, index) => 
          headerView[index] === byte
        );

        if (!hasValidHeader) {
          // ✅ Strict validation - reject ALL WebM chunks without valid EBML header
          console.error('❌ WebM chunk lacks valid EBML header:', audioChunk.size, 'bytes');
          return { 
            isValid: false, 
            reason: `WebM chunk lacks valid EBML header (${audioChunk.size} bytes). All WebM files must have proper headers.` 
          };
        } else {
          // ✅ Additional header validation for WebM
          console.log('✅ Valid EBML header detected');
          
          // Check for additional WebM markers if available
          if (headerView.length >= 16) {
            // Look for WebM identifier in the header
            const webmIndicators = [
              new Uint8Array([0x77, 0x65, 0x62, 0x6D]), // "webm" ASCII
              new Uint8Array([0x1A, 0x45, 0xDF, 0xA3])  // EBML header
            ];
            
            let hasWebMIndicator = false;
            for (let i = 0; i <= headerView.length - 4; i++) {
              const chunk = headerView.slice(i, i + 4);
              for (const indicator of webmIndicators) {
                if (chunk.every((byte, idx) => byte === indicator[idx])) {
                  hasWebMIndicator = true;
                  break;
                }
              }
              if (hasWebMIndicator) break;
            }
            
            if (hasWebMIndicator) {
              console.log('✅ WebM file structure confirmed');
            } else {
              console.warn('⚠️ EBML header present but WebM structure unclear');
            }
          }
        }
      }

      console.log('✅ WebM chunk validation passed:', {
        size: audioChunk.size,
        hasValidHeader: true,
        timestamp: new Date().toISOString()
      });

      return { isValid: true };

    } catch (error) {
      console.error('❌ WebM validation error:', error);
      // في حالة خطأ في الفحص، اقبل الـ chunk إذا كان الحجم معقول (5KB+)
      if (audioChunk.size >= 5120) {
        console.warn('⚠️ WebM validation failed but chunk size is reasonable, accepting...');
        return { isValid: true };
      }
      return { isValid: false, reason: `WebM validation failed: ${error}` };
    }
  }

  private async sendAudioData(audioChunk: Blob) {
    try {
      console.log('📤 sendAudioData called with chunk:', audioChunk.size, 'bytes, format:', audioChunk.type);
      
      // Last-minute check before sending
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ WebSocket not ready in sendAudioData, skipping audio chunk');
        return;
      }

      // ✅ إضافة فحص صحة البيانات الصوتية
      const validationResult = await this.validateAudioChunk(audioChunk);
      if (!validationResult.isValid) {
        console.warn('⚠️ Audio chunk validation failed:', validationResult.reason);
        console.warn('🔧 Skipping corrupted audio chunk:', {
          size: audioChunk.size,
          type: audioChunk.type,
          reason: validationResult.reason
        });
        return;
      }
      
      console.log('🔄 Starting FileReader process for base64 conversion...');
      
      // اقرأ Blob كـ base64
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          console.log('✅ FileReader onload triggered');
          const dataUrl = reader.result as string;
          
          if (!dataUrl || !dataUrl.includes(',')) {
            console.error('❌ Invalid data URL from FileReader');
            return;
          }
          
          const base64Audio = dataUrl.split(',')[1];
          console.log('🔄 Base64 conversion successful, length:', base64Audio.length);
          
          const audioMessage = {
            type: 'audio',
            data: base64Audio,
            format: audioChunk.type,
            timestamp: Date.now(),
            size: audioChunk.size
          };
          
          console.log('📤 Sending audio message to WebSocket:', {
            type: audioMessage.type,
            format: audioMessage.format,
            dataLength: audioMessage.data.length,
            timestamp: audioMessage.timestamp,
            originalSize: audioMessage.size
          });
          
          this.sendMessage(audioMessage);
          console.log('✅ Audio message sent successfully via WebSocket');
          
        } catch (error) {
          console.error('❌ Error in FileReader onload:', error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('❌ FileReader error:', error);
      };
      
      reader.onabort = () => {
        console.warn('⚠️ FileReader aborted');
      };
      
      reader.readAsDataURL(audioChunk);
      console.log('🔄 FileReader.readAsDataURL started');
      
    } catch (error) {
      console.error('❌ Error in sendAudioData:', error);
    }
  }

  async stopStreaming() {
    try {
      console.log('🛑 Stopping Render WebSocket streaming...');
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      this.isStreaming = false;
      console.log('🔧 Set isStreaming to false in stopStreaming');
      console.log('✅ Render WebSocket streaming stopped');
      
    } catch (error) {
      console.error('❌ Error stopping Render WebSocket streaming:', error);
    }
  }

  /**
   * Restart streaming without reconnecting WebSocket
   * Useful when reusing existing connection for new recording session
   */
  async restartStreaming(
    sourceLanguage: string,
    onTranscriptionUpdate: (text: string, detectedLanguage?: string) => void
  ) {
    try {
      console.log('🔄 Restarting WebSocket streaming...');
      
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected - cannot restart streaming');
      }
      
      // Update callbacks
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.sourceLanguage = sourceLanguage;
      
      // Reset state
      this.currentTranscription = '';
      this.audioQueue = [];
      this.isInitMessageSent = false;
      this.detectedLanguage = '';
      
      // Restart streaming
      this.isStreaming = true;
      console.log('🔧 Set isStreaming to true in restartStreaming');
      
      // Send new init message for the new session
      console.log('📤 Sending new init message for streaming restart...');
      this.sendInitMessage();
      
      console.log('✅ WebSocket streaming restarted successfully');
      
    } catch (error) {
      console.error('❌ Error restarting WebSocket streaming:', error);
      throw error;
         }
   }

   /**
    * Force ensure streaming is active
    * Use this when you know WebSocket is connected but streaming might be stuck
    */
   forceEnsureStreaming() {
     console.log('🔧 Force ensuring streaming is active...');
     console.log('📊 Current state before force fix:', {
       isStreaming: this.isStreaming,
       isConnected: this.isConnected,
       wsReadyState: this.ws?.readyState,
       isInitMessageSent: this.isInitMessageSent,
       isInitialized: this.isInitialized
     });
     
     if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
       if (!this.isStreaming) {
         console.log('🔧 FORCING streaming to TRUE');
         this.isStreaming = true;
         
         // Re-send init if needed
         if (!this.isInitMessageSent) {
           console.log('📤 Re-sending init message during force fix...');
           this.sendInitMessage();
         }
       }
       
       console.log('📊 State after force fix:', {
         isStreaming: this.isStreaming,
         isInitMessageSent: this.isInitMessageSent
       });
       
       return true;
     } else {
       console.warn('⚠️ Cannot force streaming - WebSocket not properly connected');
       return false;
     }
   }

   /**
    * Get detailed streaming status for debugging
    */
   getDetailedStatus() {
     return {
       isStreaming: this.isStreaming,
       isConnected: this.isConnected,
       wsExists: !!this.ws,
       wsReadyState: this.ws?.readyState,
       wsOpen: this.ws?.readyState === WebSocket.OPEN,
       isInitMessageSent: this.isInitMessageSent,
       isInitialized: this.isInitialized,
       sourceLanguage: this.sourceLanguage,
       audioQueueLength: this.audioQueue.length
     };
   }
  
    disconnect() {
    console.log('🔌 Disconnecting Render WebSocket service...');
    
    // Stop all operations immediately
    this.shouldReconnect = false;
    this.stopStreaming();
    this.stopPingPong();
    this.isConnected = false;
    this.isStreaming = false;
    console.log('🔧 Set isStreaming to false in disconnect');
    this.isInitialized = false;
    this.isInitMessageSent = false;
    this.currentTranscription = '';
    this.audioQueue = []; // Clear audio queue
    this.detectedLanguage = '';
    
    // Close WebSocket connection
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      try {
        this.ws.close(1000, 'Manual disconnect');
      } catch (error) {
        console.warn('⚠️ Error closing WebSocket:', error);
      }
      this.ws = null;
    }
    
    // Clear all timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    console.log('✅ Render WebSocket service disconnected');
  }

  isConnectedStatus(): boolean {
    const connected = this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    console.log('🔍 Connection status check:', {
      isConnected: this.isConnected,
      wsReadyState: this.ws?.readyState,
      wsExists: !!this.ws,
      finalResult: connected
    });
    return connected;
  }

  isInitializedStatus(): boolean {
    return this.isInitialized;
  }

  getCurrentTranscription(): string {
    return this.currentTranscription;
  }

  getDetectedLanguage(): string {
    return this.detectedLanguage;
  }

  /**
   * ✅ Get supported languages list
   */
  getSupportedLanguages(): string[] {
    return [...RenderWebSocketService.AZURE_SUPPORTED_LANGUAGES];
  }

  /**
   * ✅ Get language validation result
   */
  getLanguageValidationResult(): { isValid: boolean; message?: string; suggestion?: string } | null {
    return this.languageValidationResult;
  }

  /**
   * ✅ Get server confirmed supported languages
   */
  getServerSupportedLanguages(): string[] {
    return [...this.serverSupportedLanguages];
  }

  /**
   * ✅ Check if a specific language is supported
   */
  isLanguageSupported(language: string): boolean {
    return RenderWebSocketService.AZURE_SUPPORTED_LANGUAGES.includes(language);
  }

  /**
   * ✅ Get language information
   */
  getLanguageInfo(language: string): { 
    isClientSupported: boolean; 
    isServerConfirmed: boolean; 
    validation: { isValid: boolean; message?: string; suggestion?: string }; 
    currentSource: string;
    detectedLanguage: string;
  } {
    const validation = this.validateSourceLanguage(language);
    return {
      isClientSupported: RenderWebSocketService.AZURE_SUPPORTED_LANGUAGES.includes(language),
      isServerConfirmed: this.serverSupportedLanguages.includes(language),
      validation: validation,
      currentSource: this.sourceLanguage,
      detectedLanguage: this.detectedLanguage
    };
  }

  // Method to test connection with language validation
  async testConnection(): Promise<boolean> {
    try {
      const serverConfig = getServerConfig('azure', true);
      console.log('🔍 Testing connection to:', serverConfig.wsUrl);
      
      const ws = new WebSocket(serverConfig.wsUrl);
      
      const result = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⏰ WebSocket connection test timeout');
          ws.close();
          resolve(false);
        }, 10000); // Increased timeout to 10 seconds
        
        ws.onopen = () => {
          console.log('✅ WebSocket connection opened for test');
          clearTimeout(timeout);
          
          // Send a test message with current language to verify the connection is working
          const testMessage = {
            type: 'init',
            sourceLanguage: this.sourceLanguage,
            realTime: true,
            test: true
          };
          
          ws.send(JSON.stringify(testMessage));
          console.log('📤 Sent test init message with language:', this.sourceLanguage);
          
          // Wait a bit for response, then close
          setTimeout(() => {
            ws.close();
            resolve(true);
          }, 1000);
        };
        
        ws.onerror = (error) => {
          console.error('❌ WebSocket connection test error:', error);
          clearTimeout(timeout);
          resolve(false);
        };
        
        ws.onclose = (event) => {
          console.log('🔌 WebSocket connection test closed:', event.code, event.reason);
          clearTimeout(timeout);
          resolve(false);
        };
      });
      
      if (result) {
        console.log('✅ Render WebSocket connection test successful');
      } else {
        console.log('❌ Render WebSocket connection test failed');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Render WebSocket connection test error:', error);
      return false;
    }
  }
} 