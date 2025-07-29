// Real-time Transcription Service
export class RealtimeTranscriptionService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private onTranscriptionUpdate: ((text: string) => void) | null = null;

  constructor() {
    this.ws = null;
    this.isConnected = false;
  }

  async connect(sourceLanguage: string, engine: string, onUpdate: (text: string) => void) {
    try {
      this.onTranscriptionUpdate = onUpdate;
      
      // Create WebSocket connection to Faster Whisper API
      const wsUrl = import.meta.env.VITE_FASTER_WHISPER_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      this.ws = new WebSocket(`${wsUrl}/ws`);
      
      this.ws.onopen = () => {
        console.log('Real-time transcription WebSocket connected');
        this.isConnected = true;
        
        // Send initial configuration
        this.ws?.send(JSON.stringify({
          type: 'init',
          language: sourceLanguage === 'auto' ? null : sourceLanguage,
          engine: engine
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'transcription' && data.text) {
            this.onTranscriptionUpdate?.(data.text);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
      };

    } catch (error) {
      console.error('Error connecting to real-time transcription:', error);
      throw error;
    }
  }

  sendAudioChunk(audioChunk: Blob) {
    if (this.ws && this.isConnected) {
      // Convert audio chunk to base64 and send
      const reader = new FileReader();
      reader.onload = () => {
        const base64Audio = reader.result as string;
        this.ws?.send(JSON.stringify({
          type: 'audio',
          data: base64Audio.split(',')[1] // Remove data URL prefix
        }));
      };
      reader.readAsDataURL(audioChunk);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  isConnectedStatus() {
    return this.isConnected;
  }
}

// Alternative: Server-Sent Events for real-time transcription
export class ServerSentEventsService {
  private eventSource: EventSource | null = null;
  private onTranscriptionUpdate: ((text: string) => void) | null = null;

  async connect(sourceLanguage: string, onUpdate: (text: string) => void) {
    try {
      this.onTranscriptionUpdate = onUpdate;
      
      const url = `${import.meta.env.VITE_FASTER_WHISPER_URL}/stream?language=${sourceLanguage}`;
      this.eventSource = new EventSource(url);
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.transcription) {
            this.onTranscriptionUpdate?.(data.transcription);
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
      };

    } catch (error) {
      console.error('Error connecting to SSE:', error);
      throw error;
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
} 