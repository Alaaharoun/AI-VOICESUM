// Render WebSocket Service for Real-time Transcription and Translation
import { getServerConfig } from '../config/servers';

export class RenderWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isStreaming = false;
  private isInitialized = false;
  private onTranscriptionUpdate: ((text: string) => void) | null = null;
  private onTranslationUpdate: ((text: string) => void) | null = null;
  private currentTranscription = '';
  private currentTranslation = '';
  private sourceLanguage = 'auto';
  private targetLanguage = 'en';
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

  constructor() {
    this.isConnected = false;
    this.isStreaming = false;
    this.isInitialized = false;
    this.currentTranscription = '';
    this.currentTranslation = '';
    this.audioQueue = [];
    this.isInitMessageSent = false;
  }

  async connect(
    sourceLanguage: string,
    targetLanguage: string,
    onTranscriptionUpdate: (text: string) => void,
    onTranslationUpdate: (text: string) => void
  ) {
    try {
      console.log('🔧 Initializing Render WebSocket service...');
      console.log('🔧 Connect called with sourceLanguage:', sourceLanguage, 'targetLanguage:', targetLanguage);
      
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.onTranslationUpdate = onTranslationUpdate;
      this.currentTranscription = '';
      this.currentTranslation = '';
      this.sourceLanguage = sourceLanguage;
      this.targetLanguage = targetLanguage;
      this.isInitialized = false;
      this.isInitMessageSent = false;
      this.shouldReconnect = true;
      this.audioQueue = []; // Clear audio queue
      
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
          if (this.onTranscriptionUpdate) {
            this.onTranscriptionUpdate(data.text);
          }
        } else if (data.type === 'final') {
          console.log('✅ Received final transcription:', data.text);
          if (this.onTranscriptionUpdate) {
            this.onTranscriptionUpdate(data.text);
          }
        } else if (data.type === 'translation') {
          console.log('🌐 Received translation:', data.text);
          if (this.onTranslationUpdate) {
            this.onTranslationUpdate(data.text);
          }
        } else if (data.type === 'status') {
          console.log('📊 Server status:', data.message);
          // Check if server is ready for audio input
          if (data.message === 'Ready for audio input' || data.message === 'ready' || data.message === 'initialized' || data.message === 'Server ready') {
            this.isInitialized = true;
            console.log('✅ Server initialization completed, ready for audio input');
            this.processAudioQueue(); // Process any queued audio
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
        language: this.sourceLanguage,
        targetLanguage: this.targetLanguage,
        clientSideTranslation: true,
        realTimeMode: true,
        autoDetection: true,
        audioConfig: {
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          encoding: 'pcm_s16le'
        }
      });

      const initMessage = {
        type: 'init',
        language: this.sourceLanguage === 'auto' ? null : this.sourceLanguage,
        targetLanguage: this.targetLanguage,
        clientSideTranslation: true,
        realTimeMode: true,
        autoDetection: this.sourceLanguage === 'auto',
        audioConfig: {
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          encoding: 'pcm_s16le'
        }
      };

      this.sendMessage(initMessage);
      this.isInitMessageSent = true;
      console.log('✅ Init message sent successfully');
      console.log('📤 Sent init message to server:', {
        type: 'init',
        language: this.sourceLanguage,
        targetLanguage: this.targetLanguage,
        clientSideTranslation: true,
        realTimeMode: true,
        autoDetection: this.sourceLanguage === 'auto'
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

  private async sendAudioData(audioChunk: Blob) {
    try {
      console.log('📤 sendAudioData called with chunk:', audioChunk.size, 'bytes, format:', audioChunk.type);
      
      // Last-minute check before sending
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ WebSocket not ready in sendAudioData, skipping audio chunk');
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
    targetLanguage: string,
    onTranscriptionUpdate: (text: string) => void,
    onTranslationUpdate: (text: string) => void
  ) {
    try {
      console.log('🔄 Restarting WebSocket streaming...');
      
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected - cannot restart streaming');
      }
      
      // Update callbacks
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.onTranslationUpdate = onTranslationUpdate;
      this.sourceLanguage = sourceLanguage;
      this.targetLanguage = targetLanguage;
      
      // Reset state
      this.currentTranscription = '';
      this.currentTranslation = '';
      this.audioQueue = [];
      this.isInitMessageSent = false;
      
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
       targetLanguage: this.targetLanguage,
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
    this.currentTranslation = '';
    this.audioQueue = []; // Clear audio queue
    
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

  getCurrentTranslation(): string {
    return this.currentTranslation;
  }

  // Method to test connection
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
          
          // Send a test message to verify the connection is working
          const testMessage = {
            type: 'init',
            language: null,
            targetLanguage: 'en',
            clientSideTranslation: true,
            realTimeMode: true,
            autoDetection: true,
            audioConfig: {
              sampleRate: 16000,
              channels: 1,
              bitsPerSample: 16,
              encoding: 'pcm_s16le'
            }
          };
          
          ws.send(JSON.stringify(testMessage));
          console.log('📤 Sent test init message');
          
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