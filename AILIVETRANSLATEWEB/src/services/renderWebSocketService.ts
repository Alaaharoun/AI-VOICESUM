// Render WebSocket Service for Real-time Transcription and Translation
import { getServerConfig } from '../config/servers';
import { AudioConverter } from './audioConverter';

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
  private lastPongTime = 0;
  private connectionTimeout: number | null = null;
  private isReconnecting = false;
  private shouldReconnect = true;
  private audioConverter: AudioConverter;

  constructor() {
    this.isConnected = false;
    this.isStreaming = false;
    this.isInitialized = false;
    this.currentTranscription = '';
    this.currentTranslation = '';
    this.audioConverter = new AudioConverter();
  }

  async connect(
    sourceLanguage: string,
    targetLanguage: string,
    onTranscriptionUpdate: (text: string) => void,
    onTranslationUpdate: (text: string) => void
  ) {
    try {
      console.log('🔧 Initializing Render WebSocket service...');
      
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.onTranslationUpdate = onTranslationUpdate;
      this.currentTranscription = '';
      this.currentTranslation = '';
      this.sourceLanguage = sourceLanguage;
      this.targetLanguage = targetLanguage;
      this.isInitialized = false;
      this.shouldReconnect = true;
      
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
      
      // Send detailed initialization message like the old app
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
      
      console.log('📤 Sending init message:', JSON.stringify(initMessage, null, 2));
      if (this.ws) {
        this.ws.send(JSON.stringify(initMessage));
      }
      
      onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received message:', data);
        
        // Reset pong timeout on any message
        this.resetPongTimeout();
        
        switch (data.type) {
          case 'transcription':
            this.currentTranscription = data.text;
            this.onTranscriptionUpdate?.(data.text);
            console.log('🎤 Transcription received:', data.text);
            break;
            
          case 'translation':
            this.currentTranslation = data.text;
            this.onTranslationUpdate?.(data.text);
            console.log('🌍 Translation received:', data.text);
            break;
            
          case 'status':
            console.log('📊 Server status:', data.message);
            // Check if server is ready for audio input
            if (data.message === 'Ready for audio input') {
              this.isInitialized = true;
              console.log('✅ Server initialization completed, ready for audio input');
            }
            break;
            
          case 'error':
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
            break;
            
          case 'pong':
            this.lastPongTime = Date.now();
            console.log('🏓 Pong received');
            // Clear pong timeout since we received the response
            if (this.pongTimeout) {
              clearTimeout(this.pongTimeout);
              this.pongTimeout = null;
            }
            break;
            
          default:
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('📤 Sent message:', message);
    } else {
      console.warn('⚠️ WebSocket not ready, cannot send message');
    }
  }

  private async sendInitMessage() {
    try {
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

      this.sendMessage({
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

      // Test audio conversion
      console.log('🧪 Testing audio conversion...');
      const testBlob = new Blob([new ArrayBuffer(1024)], { type: 'audio/webm;codecs=opus' });
      try {
        const pcmData = await this.audioConverter.convertToPCM(testBlob);
        console.log('✅ Audio conversion test passed:', pcmData.byteLength, 'bytes');
      } catch (error) {
        console.warn('⚠️ Audio conversion test failed:', error);
      }

    } catch (error) {
      console.error('❌ Error sending init message:', error);
    }
  }

  sendAudioChunk(audioChunk: Blob) {
    if (!this.isStreaming || !this.isConnected) {
      console.warn('⚠️ Streaming not active, ignoring audio chunk');
      return;
    }

    // Wait for initialization to complete before sending audio
    if (!this.isInitialized) {
      console.warn('⚠️ Waiting for initialization to complete before sending audio');
      return;
    }

    // Send audio data directly without complex conversion
    this.sendAudioData(audioChunk);
  }

  private async sendAudioData(audioChunk: Blob) {
    try {
      console.log('📤 Sending audio chunk (raw):', audioChunk.size, 'bytes, format:', audioChunk.type);
      // اقرأ Blob كـ base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64Audio = (reader.result as string).split(',')[1];
        this.sendMessage({
          type: 'audio',
          data: base64Audio,
          format: audioChunk.type // أرسل النوع الأصلي (webm/ogg)
        });
        console.log('📤 Sent raw audio chunk (base64):', audioChunk.size, 'bytes, format:', audioChunk.type);
      };
      reader.readAsDataURL(audioChunk);
    } catch (error) {
      console.error('❌ Error sending raw audio data:', error);
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
      console.log('✅ Render WebSocket streaming stopped');
      
    } catch (error) {
      console.error('❌ Error stopping Render WebSocket streaming:', error);
    }
  }

  disconnect() {
    console.log('🔌 Disconnecting Render WebSocket service...');
    
    this.shouldReconnect = false;
    this.stopStreaming();
    this.stopPingPong();
    this.isConnected = false;
    this.isStreaming = false;
    this.isInitialized = false;
    this.currentTranscription = '';
    this.currentTranslation = '';
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
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
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
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