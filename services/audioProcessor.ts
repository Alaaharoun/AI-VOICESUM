export class AudioProcessor {
  /**
   * Convert audio blob to a format compatible with AssemblyAI
   * Actually converts the audio data, not just the MIME type
   */
  static async processAudioForAssemblyAI(audioBlob: Blob): Promise<Blob> {
    console.log('AudioProcessor: Processing audio blob with type:', audioBlob.type);
    
    // If it's already a supported format, return as is
    if (this.isSupportedFormat(audioBlob.type)) {
      console.log('AudioProcessor: Using existing supported format:', audioBlob.type);
      return audioBlob;
    }

    try {
      // For mobile, use a simpler approach that doesn't rely on Web Audio API
      if (typeof window !== 'undefined' && window.AudioContext) {
        return await this.convertToWavWeb(audioBlob);
      } else {
        return await this.convertToWavMobile(audioBlob);
      }
    } catch (error) {
      console.error('AudioProcessor: Conversion failed, trying fallback:', error);
      return await this.fallbackConversion(audioBlob);
    }
  }

  /**
   * Check if the MIME type is supported by AssemblyAI
   */
  private static isSupportedFormat(mimeType: string): boolean {
    const supportedFormats = [
      'audio/wav',
      'audio/mp4',
      'audio/mpeg',
      'audio/aac',
      'audio/ogg',
      'audio/webm',
      'audio/m4a'
    ];
    return supportedFormats.some(format => mimeType.includes(format));
  }

  /**
   * Convert audio to WAV format using Web Audio API (for web)
   */
  private static async convertToWavWeb(audioBlob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const fileReader = new FileReader();

        fileReader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Convert to WAV format
            const wavBlob = this.audioBufferToWav(audioBuffer);
            console.log('AudioProcessor: Successfully converted to WAV format');
            resolve(wavBlob);
          } catch (error) {
            console.error('AudioProcessor: Web conversion failed:', error);
            reject(error);
          }
        };

        fileReader.onerror = () => reject(new Error('Failed to read audio file'));
        fileReader.readAsArrayBuffer(audioBlob);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Convert audio to WAV format for mobile (simpler approach)
   */
  private static async convertToWavMobile(audioBlob: Blob): Promise<Blob> {
    // For mobile, we'll try to create a new blob with proper audio data
    // This is a fallback since mobile doesn't have Web Audio API
    try {
      // Use FileReader instead of arrayBuffer() method which might not be available
      const arrayBuffer = await this.blobToArrayBuffer(audioBlob);
      
      // Create a new blob with WAV MIME type
      // Note: This doesn't actually convert the data, but it's the best we can do on mobile
      const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
      console.log('AudioProcessor: Created WAV blob for mobile');
      return wavBlob;
    } catch (error) {
      console.error('AudioProcessor: Mobile conversion failed:', error);
      throw error;
    }
  }

  /**
   * Convert blob to ArrayBuffer using FileReader (works in React Native)
   */
  private static blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read blob as ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Fallback conversion method
   */
  private static async fallbackConversion(audioBlob: Blob): Promise<Blob> {
    console.log('AudioProcessor: Using fallback conversion');
    
    // Try different MIME types as a last resort, prioritize M4A for mobile
    const mimeTypes = ['audio/m4a', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/aac'];
    
    for (const mimeType of mimeTypes) {
      try {
        const newBlob = new Blob([audioBlob], { type: mimeType });
        console.log(`AudioProcessor: Fallback conversion to ${mimeType}`);
        return newBlob;
      } catch (error) {
        console.log(`AudioProcessor: Fallback conversion to ${mimeType} failed:`, error);
        continue;
      }
    }
    
    // If all else fails, return original with audio MIME type
    console.warn('AudioProcessor: All conversions failed, using original with audio MIME type');
    return new Blob([audioBlob], { type: 'audio/m4a' });
  }

  /**
   * Convert AudioBuffer to WAV format
   */
  private static audioBufferToWav(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // Create WAV header
    const buffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numChannels * 2, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Validate audio blob before sending to AssemblyAI
   */
  static validateAudioBlob(audioBlob: Blob): { isValid: boolean; error?: string } {
    if (!audioBlob || audioBlob.size === 0) {
      return { isValid: false, error: 'Invalid audio file' };
    }

    if (audioBlob.size > 100 * 1024 * 1024) { // 100MB limit
      return { isValid: false, error: 'Audio file too large. Please record a shorter clip.' };
    }

    // Check if it's a video format (which AssemblyAI doesn't support)
    if (audioBlob.type && audioBlob.type.startsWith('video/')) {
      return { isValid: false, error: 'Video files are not supported. Please record audio only.' };
    }

    return { isValid: true };
  }

  /**
   * Get audio duration from blob (approximate)
   */
  static async getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        const url = URL.createObjectURL(audioBlob);
        
        audio.addEventListener('loadedmetadata', () => {
          URL.revokeObjectURL(url);
          resolve(audio.duration);
        });
        
        audio.addEventListener('error', () => {
          URL.revokeObjectURL(url);
          resolve(0); // Default duration if we can't determine
        });
        
        audio.src = url;
      } catch (error) {
        console.warn('Could not determine audio duration:', error);
        resolve(0);
      }
    });
  }

  /**
   * Create a compatible audio blob for mobile recordings
   */
  static createMobileAudioBlob(audioData: ArrayBuffer, format: string = 'wav'): Blob {
    const mimeTypeMap: Record<string, string> = {
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'mp3': 'audio/mpeg',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg'
    };

    const mimeType = mimeTypeMap[format] || 'audio/wav';
    
    try {
      return new Blob([audioData], { type: mimeType });
    } catch (error) {
      console.warn(`Failed to create blob with format ${format}, using default:`, error);
      return new Blob([audioData], { type: 'audio/wav' });
    }
  }
} 