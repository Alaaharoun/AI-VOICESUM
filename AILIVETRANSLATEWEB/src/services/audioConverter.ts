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
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    
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
  }

  /**
   * Convert using alternative method for unsupported formats (WebM/Opus)
   */
  private async convertWithAlternativeMethod(audioBlob: Blob): Promise<ArrayBuffer> {
    console.log('🔄 Using alternative conversion method for:', audioBlob.type);
    
    // Create a temporary audio element to decode the audio
    const audio = new Audio();
    const url = URL.createObjectURL(audioBlob);
    
    return new Promise((resolve, reject) => {
      audio.oncanplaythrough = async () => {
        try {
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
            chunks.push(event.data);
          };
          
          mediaRecorder.onstop = async () => {
            try {
              const wavBlob = new Blob(chunks, { type: 'audio/wav' });
              const pcmData = await this.convertDirectly(wavBlob);
              URL.revokeObjectURL(url);
              resolve(pcmData);
            } catch (error) {
              reject(error);
            }
          };
          
          // Start recording and play audio
          mediaRecorder.start();
          audio.play();
          
          // Stop after audio duration
          setTimeout(() => {
            mediaRecorder.stop();
            audio.pause();
          }, audio.duration * 1000);
          
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load audio'));
      };
      
      audio.src = url;
    });
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

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported(format)) {
        console.log('🎵 Using audio format:', format);
        return format;
      }
    }

    // Fallback to default
    console.warn('⚠️ No optimal audio format supported, using default');
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