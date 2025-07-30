// Voice Activity Detection Service - Mimics Azure's intelligent audio processing
// Uses VAD to detect speech and only process audio when speech is present

// @ts-ignore - VAD library will be loaded dynamically
// import { MicVAD } from '@ricky0123/vad-web';

export interface VADOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audio: Float32Array) => void;
  onVADMisfire?: () => void;
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
  preSpeechPadFrames?: number;
  redemptionFrames?: number;
  frameSamples?: number;
  minSpeechFrames?: number;
}

export interface AudioSegment {
  audio: Float32Array;
  start: number;
  end: number;
  hasSpeech: boolean;
}

export class VADService {
  private vad: any = null;
  private isInitialized = false;
  private isListening = false;
  private audioSegments: AudioSegment[] = [];
  private currentSegmentStart = 0;

  constructor(private options: VADOptions = {}) {}

  /**
   * Initialize VAD with optimized settings for Azure-like behavior
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎤 Initializing Voice Activity Detection...');
      
      // Enhanced VAD configuration to mimic Azure's behavior
      // @ts-ignore - MicVAD will be available at runtime
      const { MicVAD } = window as any;
      this.vad = await MicVAD.new({
        // ✅ Azure-like speech detection thresholds
        positiveSpeechThreshold: this.options.positiveSpeechThreshold || 0.8, // High confidence for speech
        negativeSpeechThreshold: this.options.negativeSpeechThreshold || 0.35, // Conservative for silence
        
        // ✅ Frame processing settings
        preSpeechPadFrames: this.options.preSpeechPadFrames || 1, // Minimal pre-padding
        redemptionFrames: this.options.redemptionFrames || 8, // Short redemption for responsive detection
        frameSamples: this.options.frameSamples || 1536, // Optimized frame size
        minSpeechFrames: this.options.minSpeechFrames || 3, // Require at least 3 frames of speech
        
        // ✅ Model configuration for better accuracy
        ortConfig(ort: any) {
          ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
        },

        // ✅ Speech start callback - Azure-like behavior
        onSpeechStart: () => {
          console.log('🎙️ VAD: Speech detected - starting processing');
          this.currentSegmentStart = Date.now();
          this.options.onSpeechStart?.();
        },

        // ✅ Speech end callback with audio processing
        onSpeechEnd: (audio: Float32Array) => {
          const segmentEnd = Date.now();
          const duration = segmentEnd - this.currentSegmentStart;
          
          console.log(`🎙️ VAD: Speech ended - processed ${audio.length} samples (${duration}ms)`);
          console.log(`📊 Audio stats: ${audio.length} samples at 16kHz = ${(audio.length / 16000).toFixed(2)}s`);
          
          // ✅ Create audio segment with metadata
          const segment: AudioSegment = {
            audio: audio,
            start: this.currentSegmentStart,
            end: segmentEnd,
            hasSpeech: true
          };
          
          this.audioSegments.push(segment);
          this.options.onSpeechEnd?.(audio);
        },

        // ✅ VAD misfire callback
        onVADMisfire: () => {
          console.warn('⚠️ VAD: Misfire detected - false positive speech detection');
          this.options.onVADMisfire?.();
        },

        // ✅ Worklet URL configuration
        workletURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.22/dist/vad.worklet.bundle.min.js',
        modelURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.22/dist/silero_vad.onnx'
      });

      this.isInitialized = true;
      console.log('✅ VAD initialized successfully with Azure-like settings');
      
    } catch (error) {
      console.error('❌ Failed to initialize VAD:', error);
      throw new Error(`VAD initialization failed: ${error}`);
    }
  }

  /**
   * Start voice activity detection - Azure-like continuous monitoring
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VAD not initialized. Call initialize() first.');
    }

    if (this.isListening) {
      console.warn('⚠️ VAD already listening');
      return;
    }

    try {
      console.log('🎙️ Starting VAD listening - Azure-like continuous monitoring...');
      await this.vad.start();
      this.isListening = true;
      console.log('✅ VAD listening started successfully');
    } catch (error) {
      console.error('❌ Failed to start VAD:', error);
      throw new Error(`VAD start failed: ${error}`);
    }
  }

  /**
   * Stop voice activity detection
   */
  async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      console.log('🛑 Stopping VAD listening...');
      await this.vad.pause();
      this.isListening = false;
      console.log('✅ VAD stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop VAD:', error);
    }
  }

  /**
   * Destroy VAD instance and clean up resources
   */
  async destroy(): Promise<void> {
    try {
      if (this.isListening) {
        await this.stop();
      }

      if (this.vad) {
        await this.vad.destroy();
        this.vad = null;
      }

      this.audioSegments = [];
      this.isInitialized = false;
      console.log('✅ VAD destroyed and resources cleaned up');
    } catch (error) {
      console.error('❌ Error destroying VAD:', error);
    }
  }

  /**
   * Get current VAD status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      segmentsProcessed: this.audioSegments.length
    };
  }

  /**
   * Get processed audio segments
   */
  getAudioSegments(): AudioSegment[] {
    return this.audioSegments.slice(); // Return copy
  }

  /**
   * Clear processed audio segments
   */
  clearAudioSegments(): void {
    this.audioSegments = [];
    console.log('🧹 VAD audio segments cleared');
  }

  /**
   * Check if VAD is currently detecting speech
   */
  isDetectingSpeech(): boolean {
    return this.isListening && this.vad?.listening;
  }

  /**
   * Get VAD configuration summary
   */
  getConfiguration() {
    return {
      positiveSpeechThreshold: this.options.positiveSpeechThreshold || 0.8,
      negativeSpeechThreshold: this.options.negativeSpeechThreshold || 0.35,
      preSpeechPadFrames: this.options.preSpeechPadFrames || 1,
      redemptionFrames: this.options.redemptionFrames || 8,
      frameSamples: this.options.frameSamples || 1536,
      minSpeechFrames: this.options.minSpeechFrames || 3
    };
  }
} 