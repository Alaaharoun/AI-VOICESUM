// Audio Converter Service for Azure Speech Service
// Converts various audio formats to PCM 16kHz 16-bit mono

export class AudioConverter {
  private audioContext: AudioContext | null = null;
  private sampleRate = 16000;
  private channels = 1;
  private bitsPerSample = 16;

  constructor() {
    // Initialize AudioContext for conversion
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext({
        sampleRate: this.sampleRate,
        latencyHint: 'interactive'
      });
    }
  }

  /**
   * Convert audio blob to PCM 16kHz 16-bit mono
   * Azure Speech Service requires PCM format for best compatibility
   */
  async convertToPCM(audioBlob: Blob): Promise<ArrayBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      console.log('🔄 Converting audio to PCM format...');
      console.log('📊 Input format:', audioBlob.type, 'Size:', audioBlob.size, 'bytes');

      // Validate input blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Invalid audio blob: empty or null');
      }

      if (audioBlob.size < 100) {
        throw new Error('Audio blob too small to be valid');
      }

      // Check if the format is directly supported by AudioContext
      if (this.isDirectlySupported(audioBlob.type)) {
        return await this.convertDirectly(audioBlob);
      } else {
        // For unsupported formats like WebM/Opus, use alternative method
        return await this.convertWithAlternativeMethod(audioBlob);
      }
    } catch (error) {
      console.error('❌ Error converting audio to PCM:', error);
      throw new Error(`Audio conversion failed: ${error}`);
    }
  }

  /**
   * Convert audio blob to WAV format
   * This is a static method for compatibility with existing code
   */
  static async convertToWav(audioBlob: Blob): Promise<Blob> {
    try {
      console.log('🔄 Converting audio to WAV format...');
      console.log('📊 Input format:', audioBlob.type, 'Size:', audioBlob.size, 'bytes');

      // Validate input blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Invalid audio blob: empty or null');
      }

      if (audioBlob.size < 100) {
        throw new Error('Audio blob too small to be valid');
      }

      // Create a new AudioConverter instance
      const converter = new AudioConverter();
      
      // Convert to PCM first
      const pcmData = await converter.convertToPCM(audioBlob);
      
      // Create WAV header
      const wavBlob = converter.createWavBlob(pcmData);
      
      console.log('✅ Audio converted to WAV successfully');
      return wavBlob;
    } catch (error) {
      console.error('❌ Error converting audio to WAV:', error);
      throw new Error(`WAV conversion failed: ${error}`);
    }
  }

  /**
   * Create WAV blob from PCM data
   */
  private createWavBlob(pcmData: ArrayBuffer): Blob {
    // Create WAV header
    const headerSize = 44;
    const dataSize = pcmData.byteLength;
    const fileSize = headerSize + dataSize - 8;
    
    const header = new ArrayBuffer(headerSize);
    const view = new DataView(header);
    
    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, this.channels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * this.channels * this.bitsPerSample / 8, true); // byte rate
    view.setUint16(32, this.channels * this.bitsPerSample / 8, true); // block align
    view.setUint16(34, this.bitsPerSample, true);
    
    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Combine header with PCM data
    const wavData = new Uint8Array(headerSize + dataSize);
    wavData.set(new Uint8Array(header), 0);
    wavData.set(new Uint8Array(pcmData), headerSize);
    
    return new Blob([wavData], { type: 'audio/wav' });
  }

  /**
   * Write string to DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Check if format is directly supported by AudioContext
   */
  private isDirectlySupported(mimeType: string): boolean {
    const supportedFormats = [
      'audio/wav',
      'audio/mp4',
      'audio/aac',
      'audio/mpeg'
    ];
    
    return supportedFormats.some(format => 
      mimeType.toLowerCase().includes(format.toLowerCase())
    );
  }

  /**
   * Convert directly using AudioContext (for supported formats)
   */
  private async convertDirectly(audioBlob: Blob): Promise<ArrayBuffer> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Check if array buffer is valid
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty audio data');
      }
      
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      // Check if decoded audio is valid
      if (audioBuffer.length === 0 || audioBuffer.duration === 0) {
        throw new Error('Invalid decoded audio: no duration or length');
      }
      
      console.log('📊 Decoded audio:', {
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length,
        duration: audioBuffer.duration,
        numberOfChannels: audioBuffer.numberOfChannels
      });

      // Convert to mono if stereo
      const monoChannel = this.convertToMono(audioBuffer);
      
      // Resample to 16kHz if needed
      const resampledData = this.resampleTo16kHz(monoChannel, audioBuffer.sampleRate);
      
      // Convert to 16-bit PCM
      const pcmData = this.convertTo16BitPCM(resampledData);
      
      console.log('✅ Audio converted to PCM:', {
        sampleRate: this.sampleRate,
        channels: this.channels,
        bitsPerSample: this.bitsPerSample,
        size: pcmData.byteLength,
        duration: pcmData.byteLength / (this.sampleRate * this.channels * this.bitsPerSample / 8)
      });

      return pcmData;
    } catch (error) {
      console.error('❌ Error in direct conversion:', error);
      throw error;
    }
  }

  /**
   * Convert using alternative method for unsupported formats (WebM/Opus)
   */
  private async convertWithAlternativeMethod(audioBlob: Blob): Promise<ArrayBuffer> {
    console.log('🔄 Using alternative conversion method for:', audioBlob.type);
    
    // Check if blob is valid
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Invalid aud io blob: empty or null');
    }
    
    // For WebM/Opus, try to use MediaRecorder API directly
    try {
      return await this.convertWithMediaRecorder(audioBlob);
    } catch (error) {
      console.warn('⚠️ MediaRecorder conversion failed, trying fallback method:', error);
      return await this.convertWithFallbackMethod(audioBlob);
    }
  }

  /**
   * Convert using MediaRecorder API (more reliable for WebM/Opus)
   */
  private async convertWithMediaRecorder(audioBlob: Blob): Promise<ArrayBuffer> {
    console.log('🔄 Converting with MediaRecorder API...');
    
    // Create a temporary audio element with better error handling
    const audio = new Audio();
    const url = URL.createObjectURL(audioBlob);
    
    return new Promise((resolve, reject) => {
      let timeoutId: number;
      
      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (timeoutId) clearTimeout(timeoutId);
      };
      
      // Set timeout to prevent hanging
      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Audio loading timeout'));
      }, 10000); // 10 seconds timeout
      
      audio.oncanplaythrough = async () => {
        try {
          clearTimeout(timeoutId);
          console.log('✅ Audio loaded successfully, duration:', audio.duration);
          
          // Create a MediaElementSource from the audio element
          const source = this.audioContext!.createMediaElementSource(audio);
          const destination = this.audioContext!.createMediaStreamDestination();
          source.connect(destination);
          
          // Get the audio stream
          const stream = destination.stream;
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/wav'
          });
          
          const chunks: Blob[] = [];
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };
          
          mediaRecorder.onstop = async () => {
            try {
              if (chunks.length === 0) {
                throw new Error('No audio data recorded');
              }
              
              const wavBlob = new Blob(chunks, { type: 'audio/wav' });
              console.log('📊 Converted WAV size:', wavBlob.size, 'bytes');
              
              const pcmData = await this.convertDirectly(wavBlob);
              cleanup();
              resolve(pcmData);
            } catch (error) {
              cleanup();
              reject(error);
            }
          };
          
          mediaRecorder.onerror = (event) => {
            cleanup();
            reject(new Error('MediaRecorder error: ' + event));
          };
          
          // Start recording and play audio
          mediaRecorder.start();
          await audio.play();
          
          // Stop after audio duration (with safety margin)
          const duration = Math.max(audio.duration, 0.1) * 1000; // minimum 100ms
          setTimeout(() => {
            try {
              mediaRecorder.stop();
              audio.pause();
            } catch (error) {
              console.warn('⚠️ Error stopping MediaRecorder:', error);
            }
          }, duration + 100); // Add 100ms safety margin
          
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      
      audio.onerror = (event) => {
        cleanup();
        console.error('❌ Audio loading error:', event);
        reject(new Error('Failed to load audio: ' + audio.error?.message || 'Unknown error'));
      };
      
      audio.onabort = () => {
        cleanup();
        reject(new Error('Audio loading aborted'));
      };
      
      // Set audio source
      audio.src = url;
      audio.load(); // Explicitly load the audio
    });
  }

  /**
   * Fallback conversion method using raw data
   */
  private async convertWithFallbackMethod(audioBlob: Blob): Promise<ArrayBuffer> {
    console.log('🔄 Using fallback conversion method...');
    
    try {
      // For WebM/Opus, try to extract raw audio data
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // If the blob is too small, it might be invalid
      if (arrayBuffer.byteLength < 100) {
        throw new Error('Audio blob too small to be valid');
      }
      
      // For now, return the raw data and let the server handle it
      console.log('📊 Returning raw audio data:', arrayBuffer.byteLength, 'bytes');
      return arrayBuffer;
      
    } catch (error) {
      console.error('❌ Fallback conversion failed:', error);
      throw new Error('All conversion methods failed');
    }
  }

  /**
   * Alternative: Send raw audio data without conversion
   * This is a fallback when conversion fails
   */
  async sendRawAudio(audioBlob: Blob): Promise<ArrayBuffer> {
    console.log('🔄 Sending raw audio data without conversion...');
    return await audioBlob.arrayBuffer();
  }

  /**
   * Convert multi-channel audio to mono
   */
  private convertToMono(audioBuffer: AudioBuffer): Float32Array {
    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0);
    }

    const monoData = new Float32Array(audioBuffer.length);
    const numChannels = audioBuffer.numberOfChannels;

    for (let i = 0; i < audioBuffer.length; i++) {
      let sum = 0;
      for (let channel = 0; channel < numChannels; channel++) {
        sum += audioBuffer.getChannelData(channel)[i];
      }
      monoData[i] = sum / numChannels;
    }

    return monoData;
  }

  /**
   * Resample audio to 16kHz
   */
  private resampleTo16kHz(audioData: Float32Array, originalSampleRate: number): Float32Array {
    if (originalSampleRate === this.sampleRate) {
      return audioData;
    }

    const ratio = originalSampleRate / this.sampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const resampledData = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originalIndex = Math.round(i * ratio);
      if (originalIndex < audioData.length) {
        resampledData[i] = audioData[originalIndex];
      }
    }

    return resampledData;
  }

  /**
   * Convert float32 audio data to 16-bit PCM
   */
  private convertTo16BitPCM(audioData: Float32Array): ArrayBuffer {
    const pcmData = new Int16Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      // Clamp value between -1 and 1
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      // Convert to 16-bit integer
      pcmData[i] = Math.round(sample * 32767);
    }

    return pcmData.buffer;
  }

  /**
   * Get optimal audio format for recording
   * Prioritizes formats that work well with Azure Speech Service
   */
  static getOptimalAudioFormat(): string {
    // For real-time streaming, use PCM directly to avoid WebM header issues
    // WebM requires complete headers which are problematic with small chunks
    const formats = [
      'audio/pcm',                 // Direct PCM - best for real-time streaming
      'audio/raw',                 // Raw audio data
      'audio/webm;codecs=opus',    // WebM with Opus (fallback)
      'audio/webm',                // WebM without codec specification
      'audio/ogg;codecs=opus',     // OGG with Opus
      'audio/mp4',                 // MP4 as fallback
      'audio/wav'                  // WAV as last resort
    ];

    console.log('🔍 Testing audio format support...');
    
    for (const format of formats) {
      const isSupported = MediaRecorder.isTypeSupported(format);
      console.log(`🎵 Format ${format}: ${isSupported ? '✅ Supported' : '❌ Not supported'}`);
      
      if (isSupported) {
        console.log('🎵 Selected audio format:', format);
        return format;
      }
    }

    // Test what formats are actually supported
    console.warn('⚠️ No optimal audio format supported, testing common formats...');
    const commonFormats = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const format of commonFormats) {
      const isSupported = MediaRecorder.isTypeSupported(format);
      console.log(`🔍 Common format ${format}: ${isSupported ? '✅ Supported' : '❌ Not supported'}`);
    }
    
    console.warn('⚠️ Using empty format (browser default)');
    return '';
  }

  /**
   * Get optimal recording settings for Azure Speech Service
   */
  static getOptimalRecordingSettings(): MediaTrackConstraints {
    return {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // Additional settings for better quality
      latency: 0.01,
      volume: 1.0
    };
  }

  /**
   * Validate audio format compatibility with Azure Speech Service
   */
  static isFormatCompatible(mimeType: string): boolean {
    const compatibleFormats = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav',
      'audio/pcm',
      'audio/raw'
    ];

    return compatibleFormats.some(format => 
      mimeType.toLowerCase().includes(format.toLowerCase())
    );
  }

  /**
   * Get audio format information for debugging
   */
  static getFormatInfo(mimeType: string): {
    isCompatible: boolean;
    recommended: boolean;
    compression: string;
    quality: string;
  } {
    const formatInfo: { [key: string]: any } = {
      'audio/webm;codecs=opus': {
        isCompatible: true,
        recommended: true,
        compression: 'Opus',
        quality: 'High'
      },
      'audio/webm': {
        isCompatible: true,
        recommended: true,
        compression: 'Variable',
        quality: 'Good'
      },
      'audio/ogg;codecs=opus': {
        isCompatible: true,
        recommended: true,
        compression: 'Opus',
        quality: 'High'
      },
      'audio/mp4': {
        isCompatible: true,
        recommended: false,
        compression: 'AAC',
        quality: 'Medium'
      },
      'audio/wav': {
        isCompatible: true,
        recommended: false,
        compression: 'None',
        quality: 'High'
      }
    };

    return formatInfo[mimeType] || {
      isCompatible: false,
      recommended: false,
      compression: 'Unknown',
      quality: 'Unknown'
    };
  }
} 