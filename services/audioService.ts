import { Platform } from 'react-native';
import AudioRecord from 'react-native-audio-record';

// واجهات موحدة
export interface AudioChunk {
  data: string;
  size: number;
}

export interface AudioService {
  init(options?: AudioOptions): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onData(callback: (chunk: AudioChunk) => void): void;
  removeAllListeners(): void;
  cleanup(): Promise<void>;
  isReady(): boolean;
}

export interface AudioOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  audioSource?: number;
  wavFile?: string;
}

// فئة Logger محسنة
class Logger {
  private static isDevelopment = __DEV__;

  static info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[AudioService] ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.warn(`[AudioService] ${message}`, ...args);
    }
  }

  static error(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.error(`[AudioService] ${message}`, ...args);
    }
  }
}

// خدمة الصوت للموبايل
class MobileAudioService implements AudioService {
  private isInitialized = false;
  private isRecording = false;
  private dataCallback?: (chunk: AudioChunk) => void;

  async init(options?: AudioOptions): Promise<void> {
    Logger.info('Initializing mobile audio service...');
    
    try {
      const defaultOptions = {
        sampleRate: options?.sampleRate || 48000, // زيادة sample rate أكثر
        channels: options?.channels || 1,
        bitsPerSample: options?.bitsPerSample || 16,
        audioSource: options?.audioSource || 6,
        wavFile: options?.wavFile || 'test.wav'
      };

      await AudioRecord.init(defaultOptions);
      this.isInitialized = true;
      Logger.info('Mobile audio service initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize mobile audio service:', error);
      throw new Error(`Mobile audio initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Mobile audio service not initialized. Please call init() first.');
    }

    Logger.info('Starting mobile audio recording...');
    
    try {
      await AudioRecord.start();
      this.isRecording = true;
      Logger.info('Mobile audio recording started');
    } catch (error) {
      Logger.error('Failed to start mobile audio recording:', error);
      throw new Error(`Failed to start mobile audio recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRecording) {
      Logger.warn('Attempted to stop recording when not recording');
      return;
    }

    Logger.info('Stopping mobile audio recording...');
    
    try {
      await AudioRecord.stop();
      this.isRecording = false;
      Logger.info('Mobile audio recording stopped, keeping data for 1 minute');
      
      // إبقاء البيانات لمدة دقيقة في الموبايل أيضاً
      setTimeout(() => {
        Logger.info('Mobile audio data cleared after 1 minute delay');
      }, 60000); // دقيقة واحدة
      
    } catch (error) {
      Logger.error('Failed to stop mobile audio recording:', error);
      throw new Error(`Failed to stop mobile audio recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  onData(callback: (chunk: AudioChunk) => void): void {
    this.dataCallback = callback;
    AudioRecord.on('data', (data: string) => {
      if (this.dataCallback) {
        this.dataCallback({
          data,
          size: data.length
        });
      }
    });
  }

  removeAllListeners(): void {
    try {
      // إزالة المستمعين بطريقة آمنة
      if (AudioRecord && typeof (AudioRecord as any).removeAllListeners === 'function') {
        (AudioRecord as any).removeAllListeners('data');
      }
    } catch (error) {
      Logger.warn('Failed to remove audio listeners:', error);
    }
    this.dataCallback = undefined;
  }

  async cleanup(): Promise<void> {
    Logger.info('Cleaning up mobile audio service...');
    
    try {
      if (this.isRecording) {
        await this.stop();
      }
      this.removeAllListeners();
      this.isInitialized = false;
      Logger.info('Mobile audio service cleaned up');
    } catch (error) {
      Logger.error('Failed to cleanup mobile audio service:', error);
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// خدمة الصوت للويب
class WebAudioService implements AudioService {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private dataCallback?: (chunk: AudioChunk) => void;
  private isInitialized = false;
  private isRecording = false;
  private mimeType: string;
  private audioChunks: Blob[] = []; // إضافة مصفوفة لتخزين البيانات المؤقتة

  constructor() {
    this.mimeType = this.getSupportedMimeType();
    Logger.info(`Using MIME type: ${this.mimeType}`);
  }

  private isSecureContext(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    
    // فحص آمن للخصائص
    const isSecure = window.isSecureContext;
    const location = window.location;
    
    if (!location) {
      return false;
    }
    
    const protocol = location.protocol;
    const hostname = location.hostname;
    
    return !!(isSecure || 
           protocol === 'https:' || 
           hostname === 'localhost' ||
           hostname === '127.0.0.1');
  }

  private getSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    throw new Error('No supported audio MIME type found');
  }

  async init(options?: AudioOptions): Promise<void> {
    Logger.info('Initializing web audio service...');
    
    if (!this.isSecureContext()) {
      const error = 'Web Audio API requires secure context (HTTPS or localhost)';
      Logger.error(error);
      throw new Error(error);
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error = 'getUserMedia is not supported in this browser';
      Logger.error(error);
      throw new Error(error);
    }

    try {
      // إنشاء AudioContext جديد بدون تنظيف سابق
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // طلب إذن المايكروفون مع إعدادات محسنة
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: options?.sampleRate || 48000, // زيادة sample rate أكثر
          channelCount: options?.channels || 1,
          echoCancellation: false, // إيقاف echo cancellation للحصول على صوت خام
          noiseSuppression: false, // إيقاف noise suppression للحصول على صوت خام
          autoGainControl: false // إيقاف auto gain للحصول على صوت خام
        }
      });

      this.isInitialized = true;
      Logger.info('Web audio service initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize web audio service:', error);
      throw new Error(`Web audio initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized || !this.stream || !this.audioContext) {
      throw new Error('Web Audio API not initialized. Please call init() first.');
    }
    
    Logger.info('Starting web audio recording...');
    
    try {
      // تنظيف البيانات القديمة قبل البدء
      this.audioChunks = [];
      
      // استئناف AudioContext إذا كان معلقاً
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        Logger.info('AudioContext resumed from suspended state');
      }
      
      // التأكد من أن AudioContext نشط
      if (this.audioContext.state !== 'running') {
        Logger.warn(`AudioContext state is: ${this.audioContext.state}`);
      }
      
      // فحص إضافي للتأكد من أن Stream لا يزال نشطاً
      const stream = this.stream;
      if (stream && stream.active === false) {
        throw new Error('Audio stream is no longer active');
      }
      
      // إنشاء MediaRecorder جديد في كل مرة
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.mimeType
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // تخزين البيانات في المصفوفة المؤقتة
          this.audioChunks.push(event.data);
          
          if (this.dataCallback && typeof this.dataCallback === 'function') {
          // تحويل Blob إلى base64
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
              this.dataCallback!({
              data: base64Data,
              size: base64Data.length
            });
          };
          reader.onerror = (error) => {
            Logger.error('FileReader error:', error);
          };
          reader.readAsDataURL(event.data);
          }
        }
      };
      
      this.mediaRecorder.onerror = (event) => {
        Logger.error('MediaRecorder error:', event);
      };
      
      this.mediaRecorder.start(5000); // إرسال بيانات كل 5000ms (5 ثوانٍ) لتجميع عينات أكبر بكثير
      this.isRecording = true;
      Logger.info('Web audio recording started with fresh MediaRecorder');
    } catch (error) {
      Logger.error('Failed to start web audio recording:', error);
      throw new Error(`Failed to start web audio recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRecording || !this.mediaRecorder) {
      Logger.warn('Attempted to stop recording when not recording');
      return;
    }

    Logger.info('Stopping web audio recording...');
    
    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // إبقاء البيانات المؤقتة لمدة دقيقة بدلاً من مسحها فورًا
      Logger.info('Web audio recording stopped, keeping chunks for 1 minute');
      
      // تنظيف البيانات بعد دقيقة
      setTimeout(() => {
        this.audioChunks = [];
        Logger.info('Audio chunks cleared after 1 minute delay');
      }, 60000); // دقيقة واحدة
      
    } catch (error) {
      Logger.error('Failed to stop web audio recording:', error);
      throw new Error(`Failed to stop web audio recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  onData(callback: (chunk: AudioChunk) => void): void {
    this.dataCallback = callback;
  }

  removeAllListeners(): void {
    this.dataCallback = undefined;
  }

  async cleanup(): Promise<void> {
    Logger.info('Cleaning up web audio service...');
    
    try {
      // إيقاف التسجيل إذا كان نشطاً
      if (this.isRecording && this.mediaRecorder && typeof this.mediaRecorder.stop === 'function') {
        await this.stop();
      }
      
      // تنظيف البيانات المؤقتة
      this.audioChunks = [];
      
      // إيقاف مسارات الصوت
      const stream = this.stream;
      if (stream && typeof stream.getTracks === 'function') {
        try {
          const tracks = stream.getTracks();
          if (tracks && Array.isArray(tracks)) {
            tracks.forEach(track => {
              if (track && typeof track.stop === 'function') {
                track.stop();
                Logger.info('Audio track stopped');
              }
            });
          }
        } catch (error) {
          Logger.warn('Failed to stop audio tracks:', error);
        }
        this.stream = null;
      }
      
      // إغلاق AudioContext
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
        Logger.info('AudioContext closed');
      }
      
      // تنظيف MediaRecorder
      this.mediaRecorder = null;
      
      this.removeAllListeners();
      this.isInitialized = false;
      Logger.info('Web audio service cleaned up completely');
    } catch (error) {
      Logger.error('Failed to cleanup web audio service:', error);
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Factory function
export function getAudioService(): AudioService {
  if (Platform.OS === 'web') {
    return new WebAudioService();
  } else {
    return new MobileAudioService();
  }
}

// دالة تحويل Base64 إلى Uint8Array للمتصفح
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// تصدير Logger للاستخدام الخارجي
export { Logger, base64ToUint8Array }; 