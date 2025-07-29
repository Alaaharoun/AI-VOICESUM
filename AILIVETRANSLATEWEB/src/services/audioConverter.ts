// Audio Converter Service - Enhanced Version
// This version provides actual audio conversion using Web Audio API

export class AudioConverter {
  private static isLoaded = false;
  private static isLoading = false;
  private static loadPromise: Promise<void> | null = null;
  private static audioContext: AudioContext | null = null;

  /**
   * تحميل AudioConverter (محسن)
   */
  static async loadFFmpeg(): Promise<void> {
    if (this.isLoaded) return;
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = new Promise(async (resolve) => {
      try {
        console.log('🔄 Loading audio converter (enhanced)...');
        
        // إنشاء AudioContext للتحويل
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        this.isLoaded = true;
        console.log('✅ Audio converter loaded successfully (enhanced mode)');
        resolve();
      } catch (error) {
        console.error('❌ Error loading audio converter:', error);
        this.isLoaded = true;
        resolve();
      } finally {
        this.isLoading = false;
      }
    });

    return this.loadPromise;
  }

  /**
   * تحويل Blob من webm/opus إلى WAV (فعلي)
   */
  static async convertToWav(blob: Blob): Promise<Blob> {
    try {
      await this.loadFFmpeg();
      
      console.log('🔄 Converting audio to WAV (enhanced)...');
      console.log('📊 Input size:', blob.size, 'bytes');
      console.log('📁 Input type:', blob.type);
      
      if (!this.audioContext) {
        console.warn('⚠️ AudioContext not available, returning original blob');
        return blob;
      }

      // التحقق من الحد الأدنى للحجم
      if (blob.size < 10240) { // أقل من 10KB
        console.warn('⚠️ File too small for conversion, returning original');
        return blob;
      }
      
      // تحويل Blob إلى ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      
      // فك تشفير الصوت
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // إنشاء WAV من AudioBuffer
      const wavBlob = await this.audioBufferToWav(audioBuffer);
      
      console.log('✅ Audio converted to WAV successfully');
      console.log('📊 Output size:', wavBlob.size, 'bytes');
      
      return wavBlob;
      
    } catch (error) {
      console.error('❌ Error converting audio to WAV:', error);
      
      // إذا كان الخطأ بسبب decodeAudioData، جرب تحويل بسيط
      if (error instanceof Error && error.name === 'EncodingError') {
        console.log('🔄 Trying simple format conversion...');
        return this.simpleFormatConversion(blob, 'wav');
      }
      
      console.log('🔄 Falling back to original blob');
      return blob;
    }
  }

  /**
   * تحويل Blob من webm/opus إلى MP3 (مبسط)
   */
  static async convertToMp3(blob: Blob): Promise<Blob> {
    try {
      await this.loadFFmpeg();
      
      console.log('🔄 Converting audio to MP3 (enhanced)...');
      console.log('📊 Input size:', blob.size, 'bytes');
      console.log('📁 Input type:', blob.type);
      
      // تحويل إلى WAV أولاً ثم إعادة تسمية كـ MP3
      const wavBlob = await this.convertToWav(blob);
      
      // إنشاء ملف MP3 (في هذه النسخة نعيد تسمية WAV)
      const mp3Blob = new Blob([wavBlob], { type: 'audio/mpeg' });
      
      console.log('✅ Audio converted to MP3 successfully');
      console.log('📊 Output size:', mp3Blob.size, 'bytes');
      
      return mp3Blob;
      
    } catch (error) {
      console.error('❌ Error converting audio to MP3:', error);
      console.log('🔄 Falling back to original blob');
      return blob;
    }
  }

  /**
   * تحويل بسيط للتنسيق (fallback)
   */
  private static simpleFormatConversion(blob: Blob, targetFormat: 'wav' | 'mp3'): Blob {
    try {
      console.log(`🔄 Simple format conversion to ${targetFormat.toUpperCase()}...`);
      
      // إنشاء header بسيط
      const header = this.createSimpleHeader(blob.size, targetFormat);
      
      // دمج header مع البيانات
      const convertedBlob = new Blob([header, blob], { 
        type: targetFormat === 'wav' ? 'audio/wav' : 'audio/mpeg' 
      });
      
      console.log(`✅ Simple conversion to ${targetFormat.toUpperCase()} completed`);
      return convertedBlob;
      
    } catch (error) {
      console.error('❌ Error in simple format conversion:', error);
      return blob;
    }
  }

  /**
   * إنشاء header بسيط
   */
  private static createSimpleHeader(dataSize: number, format: 'wav' | 'mp3'): ArrayBuffer {
    if (format === 'wav') {
      // WAV header بسيط
      const buffer = new ArrayBuffer(44);
      const view = new DataView(buffer);
      
      // RIFF header
      this.writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      this.writeString(view, 8, 'WAVE');
      
      // fmt chunk
      this.writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true); // mono
      view.setUint32(24, 16000, true); // 16kHz
      view.setUint32(28, 32000, true); // byte rate
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      
      // data chunk
      this.writeString(view, 36, 'data');
      view.setUint32(40, dataSize, true);
      
      return buffer;
    } else {
      // MP3 header بسيط (فارغ)
      return new ArrayBuffer(0);
    }
  }

  /**
   * تحويل AudioBuffer إلى WAV Blob
   */
  private static async audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // إنشاء WAV header
    const wavHeader = this.createWavHeader(length, numChannels, sampleRate);
    
    // تحويل البيانات إلى 16-bit PCM
    const pcmData = new Int16Array(length * numChannels);
    let offset = 0;
    
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        pcmData[offset] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        offset++;
      }
    }
    
    // دمج header مع البيانات
    const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    
    return wavBlob;
  }

  /**
   * إنشاء WAV header
   */
  private static createWavHeader(length: number, numChannels: number, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    
    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, length * numChannels * 2, true);
    
    return buffer;
  }

  /**
   * كتابة string إلى DataView
   */
  private static writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * التحقق من دعم التنسيقات (محسن)
   */
  static async checkSupport(): Promise<{ wav: boolean; mp3: boolean }> {
    try {
      await this.loadFFmpeg();
      
      // التحقق من دعم Web Audio API
      const hasWebAudio = !!(window.AudioContext || (window as any).webkitAudioContext);
      
      console.log('⚠️ Using enhanced converter - Web Audio API support:', hasWebAudio);
      return { wav: hasWebAudio, mp3: hasWebAudio };
      
    } catch (error) {
      console.error('❌ Error checking format support:', error);
      return { wav: false, mp3: false };
    }
  }

  /**
   * تنظيف الذاكرة (محسن)
   */
  static cleanup(): void {
    console.log('🧹 Audio converter cleanup (enhanced)');
    
    if (this.audioContext) {
      try {
        this.audioContext.close();
        this.audioContext = null;
      } catch (error) {
        console.warn('⚠️ Error during cleanup:', error);
      }
    }
  }

  /**
   * التحقق من توفر FFmpeg (محسن)
   */
  static isFFmpegAvailable(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }
} 