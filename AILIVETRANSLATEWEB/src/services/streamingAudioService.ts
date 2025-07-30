// Streaming Audio Service - Mimics Azure's continuous audio streaming
// Replaces MediaRecorder chunks with continuous raw PCM streaming

export interface StreamingAudioOptions {
  sampleRate?: number;
  channelCount?: number;
  bufferSize?: number;
  onAudioData?: (audioData: Float32Array) => void;
  onError?: (error: Error) => void;
}

export interface AudioMetrics {
  averageLevel: number;
  peakLevel: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  hasSpeech: boolean;
}

export class StreamingAudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: AudioWorkletNode | null = null;
  private isStreaming = false;
  private options: Required<StreamingAudioOptions>;

  constructor(options: StreamingAudioOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate || 16000,
      channelCount: options.channelCount || 1,
      bufferSize: options.bufferSize || 4096,
      onAudioData: options.onAudioData || (() => {}),
      onError: options.onError || (() => {})
    };
  }

  /**
   * Initialize streaming audio with AudioWorklet for continuous processing
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎵 Initializing Streaming Audio Service...');
      
             // Create AudioContext with optimal settings for speech processing
       this.audioContext = new AudioContext({
         sampleRate: this.options.sampleRate,
         latencyHint: 'interactive'
       });

      // Create AudioWorklet processor for continuous streaming
      const workletCode = `
        class StreamingAudioProcessor extends AudioWorkletProcessor {
          constructor(options) {
            super();
            this.bufferSize = options.processorOptions.bufferSize || 4096;
            this.sampleRate = options.processorOptions.sampleRate || 16000;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0) {
              const inputChannel = input[0];
              
              for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex] = inputChannel[i];
                this.bufferIndex++;
                
                // When buffer is full, send to main thread
                if (this.bufferIndex >= this.bufferSize) {
                  // Calculate audio metrics
                  const metrics = this.calculateAudioMetrics(this.buffer);
                  
                  // Send audio data and metrics to main thread
                  this.port.postMessage({
                    type: 'audioData',
                    audioData: this.buffer.slice(), // Copy buffer
                    metrics: metrics,
                    timestamp: currentTime
                  });
                  
                  this.bufferIndex = 0;
                }
              }
              
              // Copy input to output (pass-through)
              const output = outputs[0];
              if (output.length > 0) {
                output[0].set(inputChannel);
              }
            }
            
            return true;
          }

          calculateAudioMetrics(buffer) {
            let sum = 0;
            let peak = 0;
            let zeroCrossings = 0;
            let spectralSum = 0;

            for (let i = 0; i < buffer.length; i++) {
              const sample = Math.abs(buffer[i]);
              sum += sample;
              peak = Math.max(peak, sample);
              
              // Zero crossing rate calculation
              if (i > 0 && ((buffer[i] >= 0) !== (buffer[i-1] >= 0))) {
                zeroCrossings++;
              }
              
              // Simple spectral centroid approximation
              spectralSum += sample * i;
            }

            const averageLevel = sum / buffer.length;
            const zeroCrossingRate = zeroCrossings / buffer.length;
            const spectralCentroid = spectralSum / sum || 0;
            
            // Simple speech detection based on multiple factors
            const hasSpeech = averageLevel > 0.01 && 
                            zeroCrossingRate > 0.1 && 
                            zeroCrossingRate < 0.5 &&
                            peak > 0.05;

            return {
              averageLevel,
              peakLevel: peak,
              zeroCrossingRate,
              spectralCentroid,
              hasSpeech
            };
          }
        }

        registerProcessor('streaming-audio-processor', StreamingAudioProcessor);
      `;

      // Create and add worklet
      const workletBlob = new Blob([workletCode], { type: 'application/javascript' });
      const workletURL = URL.createObjectURL(workletBlob);
      
      await this.audioContext.audioWorklet.addModule(workletURL);
      console.log('✅ AudioWorklet module loaded successfully');

      // Clean up blob URL
      URL.revokeObjectURL(workletURL);

    } catch (error) {
      console.error('❌ Failed to initialize Streaming Audio Service:', error);
      throw new Error(`Streaming audio initialization failed: ${error}`);
    }
  }

  /**
   * Start continuous audio streaming - Azure-like behavior
   */
  async startStreaming(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Streaming Audio Service not initialized');
    }

    if (this.isStreaming) {
      console.warn('⚠️ Already streaming audio');
      return;
    }

    try {
      console.log('🎙️ Starting continuous audio streaming...');

      // Get microphone stream with optimal settings
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: this.options.channelCount,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          latency: 0.01 // 10ms latency for real-time processing
        }
      });

      // Create source node from stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create processor node with our worklet
      this.processorNode = new AudioWorkletNode(this.audioContext, 'streaming-audio-processor', {
        processorOptions: {
          bufferSize: this.options.bufferSize,
          sampleRate: this.options.sampleRate
        }
      });

      // Handle messages from worklet
      this.processorNode.port.onmessage = (event) => {
        const { type, audioData, metrics, timestamp } = event.data;
        
        if (type === 'audioData') {
          console.log(`🎵 Streaming audio: ${audioData.length} samples, Speech: ${metrics.hasSpeech ? '✅' : '❌'}`);
          
          // Only process audio with speech detection (Azure-like behavior)
          if (metrics.hasSpeech) {
            this.options.onAudioData(audioData);
          }
        }
      };

      // Connect audio nodes for continuous processing
      this.sourceNode.connect(this.processorNode);
      // Note: We don't connect to destination to avoid feedback

      this.isStreaming = true;
      console.log('✅ Continuous audio streaming started successfully');

    } catch (error) {
      console.error('❌ Failed to start audio streaming:', error);
      this.options.onError(new Error(`Audio streaming failed: ${error}`));
      throw error;
    }
  }

  /**
   * Stop audio streaming
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    try {
      console.log('🛑 Stopping audio streaming...');

      if (this.processorNode) {
        this.processorNode.disconnect();
        this.processorNode = null;
      }

      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
        });
        this.mediaStream = null;
      }

      this.isStreaming = false;
      console.log('✅ Audio streaming stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping audio streaming:', error);
    }
  }

  /**
   * Destroy the streaming service and clean up resources
   */
  async destroy(): Promise<void> {
    try {
      await this.stopStreaming();

      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      console.log('✅ Streaming Audio Service destroyed and resources cleaned up');
    } catch (error) {
      console.error('❌ Error destroying Streaming Audio Service:', error);
    }
  }

  /**
   * Get current streaming status
   */
  getStatus() {
    return {
      isStreaming: this.isStreaming,
      sampleRate: this.options.sampleRate,
      channelCount: this.options.channelCount,
      bufferSize: this.options.bufferSize,
      audioContextState: this.audioContext?.state || 'not-initialized'
    };
  }

  /**
   * Convert Float32Array to PCM Int16Array for server transmission
   */
  static float32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp and convert to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = Math.round(sample * 32767);
    }
    return pcm16;
  }

  /**
   * Convert Float32Array to base64 for WebSocket transmission
   */
  static audioToBase64(audioData: Float32Array): string {
    const pcm16 = StreamingAudioService.float32ToPCM16(audioData);
    const buffer = new ArrayBuffer(pcm16.length * 2);
    const view = new DataView(buffer);
    
    for (let i = 0; i < pcm16.length; i++) {
      view.setInt16(i * 2, pcm16[i], true); // little-endian
    }
    
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    
    return btoa(binary);
  }
} 