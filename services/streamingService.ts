// Real-time Streaming Service for Mobile App
import { transcriptionEngineService } from './transcriptionEngineService';
import { SpeechService } from './speechService';

export class StreamingService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private onTranscriptionUpdate: ((text: string) => void) | null = null;
  private onTranslationUpdate: ((text: string) => void) | null = null;
  private currentTranscription = '';
  private currentTranslation = '';
  private audioBuffer: Uint8Array[] = [];
  private bufferTimeout: number | null = null;
  private engine: string = 'faster-whisper';
  private sourceLanguage: string = 'auto';
  private targetLanguage: string = 'en';
  private isStreaming = false;

  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.currentTranscription = '';
    this.currentTranslation = '';
    this.audioBuffer = [];
  }

  async connect(
    sourceLanguage: string, 
    targetLanguage: string, 
    engine: string,
    onTranscriptionUpdate: (text: string) => void,
    onTranslationUpdate: (text: string) => void
  ) {
    try {
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.onTranslationUpdate = onTranslationUpdate;
      this.currentTranscription = '';
      this.currentTranslation = '';
      this.engine = engine;
      this.sourceLanguage = sourceLanguage;
      this.targetLanguage = targetLanguage;
      this.isStreaming = true;
      
      // Clear any existing buffers
      this.audioBuffer = [];
      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
        this.bufferTimeout = null;
      }
      
      if (engine === 'azure') {
        // Azure uses WebSocket for real-time streaming
        await this.connectToAzure();
      } else {
        // Hugging Face uses HTTP API with streaming
        this.isConnected = true;
        console.log('Hugging Face streaming service ready');
      }
      
    } catch (error) {
      console.error('Error connecting to streaming service:', error);
      throw error;
    }
  }

  private async connectToAzure() {
    try {
      // Get current engine settings
      const currentEngine = await transcriptionEngineService.getCurrentEngine();
      
      if (currentEngine !== 'azure') {
        throw new Error('Azure engine not configured');
      }

      // Create WebSocket connection to Azure Speech Service
      const wsUrl = this.getAzureWebSocketUrl();
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('Azure WebSocket connected');
        this.isConnected = true;
        
        // Send initial configuration
        this.ws?.send(JSON.stringify({
          type: 'init',
          sourceLanguage: this.sourceLanguage === 'auto' ? null : this.sourceLanguage,
          targetLanguage: this.targetLanguage,
          engine: this.engine
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'transcription' && data.text) {
            this.currentTranscription = data.text;
            this.onTranscriptionUpdate?.(data.text);
          }
          
          if (data.type === 'translation' && data.text) {
            this.currentTranslation = data.text;
            this.onTranslationUpdate?.(data.text);
          }
          
          if (data.type === 'error') {
            console.error('Azure streaming error:', data.message);
          }
        } catch (error) {
          console.error('Error parsing Azure WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Azure WebSocket error:', error);
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        console.log('Azure WebSocket connection closed');
        this.isConnected = false;
      };

    } catch (error) {
      console.error('Error connecting to Azure:', error);
      throw error;
    }
  }

  private getAzureWebSocketUrl(): string {
    // Azure Speech Service WebSocket URL
    // This would need to be configured based on your Azure setup
    const region = 'eastus'; // Replace with your Azure region
    const language = this.sourceLanguage === 'auto' ? 'en-US' : this.sourceLanguage;
    
    return `wss://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
  }

  // Send audio chunk for real-time processing
  sendAudioChunk(audioData: Uint8Array) {
    if (!this.isConnected || !this.isStreaming) {
      console.warn('Streaming service not connected or not streaming');
      return;
    }

    if (this.engine === 'azure') {
      this.sendToAzure(audioData);
    } else {
      this.sendToHuggingFace(audioData);
    }
  }

  private sendToAzure(audioData: Uint8Array) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        // Send audio data directly to Azure
        this.ws.send(audioData);
      } catch (error) {
        console.error('Error sending audio to Azure:', error);
      }
    }
  }

  private sendToHuggingFace(audioData: Uint8Array) {
    // Add to buffer
    this.audioBuffer.push(audioData);
    
    // Calculate total buffer size
    const totalSize = this.audioBuffer.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const targetSize = 32000; // ~1 second of 16kHz 16-bit audio
    
    // Send when buffer reaches target size or after timeout
    if (totalSize >= targetSize) {
      this.flushHuggingFaceBuffer();
    } else {
      // Set timeout for smaller chunks
      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
      }
      this.bufferTimeout = setTimeout(() => {
        this.flushHuggingFaceBuffer();
      }, 1000); // 1 second timeout
    }
  }

  private async flushHuggingFaceBuffer() {
    if (this.audioBuffer.length === 0) return;
    
    try {
      // Combine all audio chunks
      const totalSize = this.audioBuffer.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const combinedAudio = new Uint8Array(totalSize);
      let offset = 0;
      
      this.audioBuffer.forEach(chunk => {
        combinedAudio.set(chunk, offset);
        offset += chunk.byteLength;
      });
      
      // Create audio blob
      const audioBlob = new Blob([combinedAudio], { type: 'audio/wav' });
      
      // Send to Hugging Face API using SpeechService
      const transcription = await SpeechService.transcribeAudio(
        audioBlob,
        this.targetLanguage,
        false // No VAD for streaming
      );
      
      if (transcription) {
        this.currentTranscription = transcription;
        this.onTranscriptionUpdate?.(transcription);
        
        // Translate if needed
        if (this.sourceLanguage !== this.targetLanguage) {
          await this.translateText(transcription);
        }
      }
      
    } catch (error) {
      console.error('Error processing audio with Hugging Face:', error);
    } finally {
      // Clear buffer
      this.audioBuffer = [];
      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
        this.bufferTimeout = null;
      }
    }
  }

  private async translateText(text: string) {
    try {
      // Use Google Translate (free)
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${this.sourceLanguage === 'auto' ? 'auto' : this.sourceLanguage}&tl=${this.targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data[0] && Array.isArray(data[0])) {
        const translatedText = data[0].map((segment: any) => segment[0]).join('');
        this.currentTranslation = translatedText;
        this.onTranslationUpdate?.(translatedText);
      }
      
    } catch (error) {
      console.error('Translation error:', error);
    }
  }

  stopStreaming() {
    this.isStreaming = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    
    this.audioBuffer = [];
    this.isConnected = false;
  }

  disconnect() {
    this.stopStreaming();
  }

  isConnectedStatus() {
    return this.isConnected && this.isStreaming;
  }

  getCurrentTranscription() {
    return this.currentTranscription;
  }

  getCurrentTranslation() {
    return this.currentTranslation;
  }
} 