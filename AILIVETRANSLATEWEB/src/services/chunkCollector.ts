import { AudioConverter } from './audioConverter';

export interface ChunkConfig {
  maxChunks: number;
  maxSize: number; // بالبايت
  maxTime: number; // بالمللي ثانية
  targetFormat: 'wav' | 'mp3';
  minSizeForConversion: number; // الحد الأدنى للحجم قبل التحويل
}

export class ChunkCollector {
  private chunks: Blob[] = [];
  private totalSize: number = 0;
  private lastChunkTime: number = 0;
  private timeoutId: number | null = null;
  private config: ChunkConfig;
  private onChunkReady: (convertedBlob: Blob) => void;
  private originalType: string = 'audio/webm';

  constructor(
    config: ChunkConfig,
    onChunkReady: (convertedBlob: Blob) => void
  ) {
    this.config = config;
    this.onChunkReady = onChunkReady;
    this.lastChunkTime = Date.now();
  }

  /**
   * إضافة chunk جديد
   */
  async addChunk(chunk: Blob): Promise<void> {
    // التحقق من صحة البيانات
    if (!chunk || chunk.size === 0) {
      console.warn('⚠️ Empty chunk received, ignoring');
      return;
    }

    // التحقق من الحد الأدنى للحجم
    if (chunk.size < 1024) {
      console.warn('⚠️ Chunk too small, ignoring:', chunk.size, 'bytes');
      return;
    }

    // تحديد نوع الملف من أول chunk
    if (this.chunks.length === 0) {
      this.originalType = chunk.type;
      console.log(`🎵 Starting collection with type: ${this.originalType}`);
    }

    // التحقق من توافق نوع الملف
    if (chunk.type !== this.originalType) {
      console.warn(`⚠️ Chunk type mismatch: expected ${this.originalType}, got ${chunk.type}`);
    }

    // إضافة الـ chunk
    this.chunks.push(chunk);
    this.totalSize += chunk.size;
    this.lastChunkTime = Date.now();

    console.log(`📦 Chunk added: ${chunk.size} bytes, Total: ${this.totalSize} bytes, Chunks: ${this.chunks.length}`);

    // إعادة تعيين الـ timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // التحقق من شروط الإرسال
    if (this.shouldSend()) {
      await this.processChunks();
    } else {
      // تعيين timeout للإرسال التلقائي
      this.timeoutId = window.setTimeout(() => {
        this.processChunks();
      }, this.config.maxTime);
    }
  }

  /**
   * التحقق من شروط الإرسال
   */
  private shouldSend(): boolean {
    const timeSinceLastChunk = Date.now() - this.lastChunkTime;
    
    return (
      this.chunks.length >= this.config.maxChunks ||
      this.totalSize >= this.config.maxSize ||
      (this.chunks.length > 0 && timeSinceLastChunk >= this.config.maxTime)
    );
  }

  /**
   * معالجة الـ chunks المجمعة
   */
  private async processChunks(): Promise<void> {
    if (this.chunks.length === 0) return;

    try {
      console.log(`🔄 Processing ${this.chunks.length} chunks (${this.totalSize} bytes total)`);

      // إلغاء الـ timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // جمع الـ chunks في ملف كامل
      const combinedBlob = new Blob(this.chunks, { 
        type: this.originalType
      });

      console.log(`📊 Combined blob: ${combinedBlob.size} bytes, type: ${combinedBlob.type}`);

      // التحقق من الحد الأدنى للحجم قبل التحويل
      if (combinedBlob.size < this.config.minSizeForConversion) {
        console.warn(`⚠️ Combined blob too small for conversion (${combinedBlob.size} bytes), waiting for more data`);
        return;
      }

      // تحويل الصوت - فقط إذا كان الملف كبير بما فيه الكفاية
      let convertedBlob: Blob;
      
      if (this.config.targetFormat === 'wav') {
        console.log('🔄 Converting complete webm file to WAV...');
        convertedBlob = await AudioConverter.convertToWav(combinedBlob);
      } else {
        console.log('🔄 Converting complete webm file to MP3...');
        convertedBlob = await AudioConverter.convertToMp3(combinedBlob);
      }

      console.log(`✅ Audio converted to ${this.config.targetFormat.toUpperCase()}: ${convertedBlob.size} bytes`);

      // إرسال النتيجة
      this.onChunkReady(convertedBlob);

      // تنظيف
      this.reset();

    } catch (error) {
      console.error('❌ Error processing chunks:', error);
      
      // في حالة الفشل، إرسال البيانات الأصلية
      const fallbackBlob = new Blob(this.chunks, { 
        type: this.originalType
      });
      
      console.warn('⚠️ Using fallback (original format):', fallbackBlob.type);
      this.onChunkReady(fallbackBlob);
      
      this.reset();
    }
  }

  /**
   * إعادة تعيين المجمع
   */
  private reset(): void {
    this.chunks = [];
    this.totalSize = 0;
    this.lastChunkTime = Date.now();
    this.originalType = 'audio/webm';
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * تنظيف الموارد
   */
  destroy(): void {
    this.reset();
    AudioConverter.cleanup();
  }

  /**
   * الحصول على إحصائيات الحالية
   */
  getStats(): {
    chunkCount: number;
    totalSize: number;
    timeSinceLastChunk: number;
    originalType: string;
  } {
    return {
      chunkCount: this.chunks.length,
      totalSize: this.totalSize,
      timeSinceLastChunk: Date.now() - this.lastChunkTime,
      originalType: this.originalType
    };
  }
}

/**
 * إعدادات افتراضية محسنة لجمع ملفات كاملة
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxChunks: 8,        // عدد أكبر من الـ chunks لجمع ملف كامل
  maxSize: 102400,     // 100KB - ملف أكبر
  maxTime: 4000,       // 4 ثوانٍ
  targetFormat: 'wav', // التنسيق المستهدف
  minSizeForConversion: 51200 // 50KB - الحد الأدنى قبل التحويل
};

/**
 * إعدادات للأداء العالي (chunks متوسطة)
 */
export const HIGH_PERFORMANCE_CONFIG: ChunkConfig = {
  maxChunks: 6,
  maxSize: 76800,      // 75KB
  maxTime: 3000,       // 3 ثانية
  targetFormat: 'wav',
  minSizeForConversion: 38400 // 37.5KB
};

/**
 * إعدادات للاستقرار العالي (ملفات كبيرة)
 */
export const STABLE_CONFIG: ChunkConfig = {
  maxChunks: 12,
  maxSize: 153600,     // 150KB
  maxTime: 6000,       // 6 ثوانٍ
  targetFormat: 'wav',
  minSizeForConversion: 76800 // 75KB
}; 