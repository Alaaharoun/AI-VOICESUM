// Real-time Streaming Service for Transcription and Translation
import { getServerConfig, checkServerHealth } from '../config/servers';
import { ChunkCollector, DEFAULT_CHUNK_CONFIG } from './chunkCollector';

export class StreamingService {
  private isConnected = false;
  private onTranscriptionUpdate: ((text: string) => void) | null = null;
  private onTranslationUpdate: ((text: string) => void) | null = null;
  private currentTranscription = '';
  private currentTranslation = '';
  private audioBuffer: Blob[] = [];
  private bufferTimeout: number | null = null;
  private engine: string = 'faster-whisper';
  private sourceLanguage: string = 'auto';
  private targetLanguage: string = 'en';
  private isStreaming = false;
  private processingQueue: Promise<void>[] = [];
  private maxConcurrentRequests = 2; // زيادة الطلبات المتزامنة مع الحفاظ على الاستقرار
  private chunkCollector: ChunkCollector | null = null;

  constructor() {
    this.isConnected = false;
    this.currentTranscription = '';
    this.currentTranslation = '';
    this.audioBuffer = [];
    this.isStreaming = false;
  }

  async connect(
    sourceLanguage: string, 
    targetLanguage: string, 
    engine: string,
    onTranscriptionUpdate: (text: string) => void,
    onTranslationUpdate: (text: string) => void
  ) {
    try {
      console.log('🔧 Initializing REST streaming service...');
      
      this.onTranscriptionUpdate = onTranscriptionUpdate;
      this.onTranslationUpdate = onTranslationUpdate;
      this.currentTranscription = '';
      this.currentTranslation = '';
      this.engine = engine;
      this.sourceLanguage = sourceLanguage;
      this.targetLanguage = targetLanguage;
      this.isStreaming = true;
      
      // Clear any existing buffers and timeouts
      this.audioBuffer = [];
      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
        this.bufferTimeout = null;
      }
      
      // Initialize chunk collector
      this.chunkCollector = new ChunkCollector(
        DEFAULT_CHUNK_CONFIG,
        (convertedBlob) => this.processConvertedAudio(convertedBlob)
      );
      
      // Check server health
      const serverConfig = getServerConfig(this.engine, true);
      console.log(`🔍 Checking server health: ${serverConfig.name}`);
      const isHealthy = await checkServerHealth(serverConfig);
      
      if (!isHealthy) {
        console.warn(`⚠️ Server ${serverConfig.name} is not healthy, trying fallback`);
        const localConfig = getServerConfig(this.engine, false);
        const localHealthy = await checkServerHealth(localConfig);
        if (!localHealthy) {
          throw new Error('No healthy servers available');
        }
      }
      
      this.isConnected = true;
      console.log('✅ REST streaming service connected successfully');
      
    } catch (error) {
      console.error('❌ Error connecting to REST streaming service:', error);
      throw new Error('Failed to connect to streaming service');
    }
  }

  sendAudioChunk(audioChunk: Blob) {
    if (!this.isStreaming || !this.isConnected) {
      console.warn('⚠️ Streaming not active, ignoring audio chunk');
      return;
    }

    // التحقق من صحة البيانات الصوتية
    if (!audioChunk || audioChunk.size === 0) {
      console.warn('⚠️ Empty audio chunk received, ignoring');
      return;
    }

    // التحقق من الحد الأدنى للحجم (1KB)
    if (audioChunk.size < 1024) {
      console.warn('⚠️ Audio chunk too small, ignoring:', audioChunk.size, 'bytes');
      return;
    }

    // إرسال الـ chunk إلى المجمع
    if (this.chunkCollector) {
      this.chunkCollector.addChunk(audioChunk);
    } else {
      console.warn('⚠️ Chunk collector not initialized, using fallback');
      // Fallback إلى النظام القديم
      this.audioBuffer.push(audioChunk);
      
      if (this.audioBuffer.length >= 5) {
        this.processAudioBuffer();
      } else if (!this.bufferTimeout) {
        this.bufferTimeout = window.setTimeout(() => {
          this.processAudioBuffer();
        }, 3000);
      }
    }
  }

  private async processAudioBuffer() {
    if (this.audioBuffer.length === 0) return;
    
    // Clear timeout
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    
    // Limit concurrent requests and add delay if needed
    if (this.processingQueue.length >= this.maxConcurrentRequests) {
      console.warn('⚠️ Too many concurrent requests, skipping chunk');
      return;
    }
    
    // Add delay to prevent overwhelming the server
    if (this.processingQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // زيادة التأخير بشكل كبير
    }
    
    // التحقق من أن البيانات الصوتية صالحة
    const totalSize = this.audioBuffer.reduce((sum, chunk) => sum + chunk.size, 0);
    if (totalSize < 10240) { // زيادة الحد الأدنى للحجم (10KB)
      console.warn('⚠️ Total audio buffer too small, waiting for more data');
      return;
    }
    
    // التحقق من صحة البيانات قبل الجمع
    if (this.audioBuffer.length === 0) {
      console.warn('⚠️ No audio chunks to process');
      return;
    }

    // التحقق من أن جميع الأجزاء لها نفس التنسيق
    const firstType = this.audioBuffer[0]?.type;
    const allSameType = this.audioBuffer.every(chunk => chunk.type === firstType);
    
    if (!allSameType) {
      console.warn('⚠️ Audio chunks have different types, using first type');
    }

    // Combine audio chunks with original format
    const combinedBlob = new Blob(this.audioBuffer, { type: firstType || 'audio/webm' });
    this.audioBuffer = []; // Clear buffer
    
    // التحقق من حجم البيانات المجمعة
    if (combinedBlob.size < 10240) { // أقل من 10KB
      console.warn('⚠️ Combined audio too small, skipping:', combinedBlob.size, 'bytes');
      return;
    }
    
    // Process audio
    const processPromise = this.processAudioChunk(combinedBlob);
    this.processingQueue.push(processPromise);
    
    // Remove from queue when done
    processPromise.finally(() => {
      const index = this.processingQueue.indexOf(processPromise);
      if (index > -1) {
        this.processingQueue.splice(index, 1);
      }
    });
  }

  private async processAudioChunk(audioBlob: Blob) {
    try {
      const serverConfig = getServerConfig(this.engine, true);
      
      // تحديد نوع الملف واسمه بناءً على النوع الفعلي
      const originalType = audioBlob.type;
      let fileName: string;
      let fileType: string;
      
      // إذا كان الملف من ChunkCollector، فهو محول بالفعل
      if (originalType.includes('wav')) {
        fileName = 'audio.wav';
        fileType = 'audio/wav';
        console.log('✅ Using pre-converted WAV file');
      } else if (originalType.includes('mp3')) {
        fileName = 'audio.mp3';
        fileType = 'audio/mpeg';
      } else if (originalType.includes('webm')) {
        // إذا كان webm ولم يتم تحويله مسبقاً، نحوله الآن
        try {
          console.log('🔄 Converting webm to wav before sending...');
          const { AudioConverter } = await import('./audioConverter');
          
          // Check if blob is valid before conversion
          if (!audioBlob || audioBlob.size < 100) {
            throw new Error('Audio blob too small or invalid');
          }
          
          const wavBlob = await AudioConverter.convertToWav(audioBlob);
          fileName = 'audio.wav';
          fileType = 'audio/wav';
          audioBlob = wavBlob; // استخدام الملف المحول
          console.log('✅ Webm converted to wav successfully');
        } catch (conversionError) {
          console.warn('⚠️ Failed to convert webm to wav, using original:', conversionError);
          fileName = 'audio.webm';
          fileType = originalType;
        }
      } else {
        fileName = 'audio.wav';
        fileType = 'audio/wav';
      }
      
      const audioFile = new File([audioBlob], fileName, { type: fileType });
      
      const formData = new FormData();
      formData.append('file', audioFile);
      
      // إضافة معاملات إضافية إذا كانت مطلوبة
      if (this.sourceLanguage !== 'auto') {
        formData.append('language', this.sourceLanguage);
      }
      
      console.log('📤 Sending audio chunk to server...');
      console.log('📊 Audio size:', audioBlob.size, 'bytes');
      console.log('🌐 Source language:', this.sourceLanguage);
      console.log('🎯 Target language:', this.targetLanguage);
      console.log('📁 Original type:', audioBlob.type);
      console.log('📁 File type:', audioFile.type);
      console.log('📁 File name:', audioFile.name);
      
      // محاولة الخادم البعيد مع retry
      let success = false;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (!success && retryCount < maxRetries) {
        try {
          const response = await fetch(serverConfig.httpUrl, {
            method: 'POST',
            body: formData,
          });
          
          console.log('📡 Response status:', response.status, response.statusText);
          
          if (response.ok) {
            const data = await response.json();
            console.log('📄 Response data:', data);
            
            if (data.transcription || data.text) {
              const transcription = data.transcription || data.text;
              this.currentTranscription = transcription;
              this.onTranscriptionUpdate?.(transcription);
              console.log('🎤 REST transcription received:', transcription);
              
              // Translate the transcription
              if (transcription.trim()) {
                await this.translateText(transcription);
              }
              success = true;
            } else {
              console.warn('⚠️ No transcription in response:', data);
              retryCount++;
            }
          } else {
            // محاولة قراءة رسالة الخطأ
            let errorMessage = response.statusText;
            let errorData = null;
            try {
              errorData = await response.text();
              console.log('❌ Error response:', errorData);
              errorMessage = errorData;
            } catch (e) {
              console.log('❌ Could not read error response');
            }
            
            console.warn(`⚠️ REST transcription failed (attempt ${retryCount + 1}/${maxRetries}):`, response.status, errorMessage);
            
            // تحليل نوع الخطأ
            if (errorData && errorData.includes('InvalidDataError')) {
              console.error('🔍 Audio format issue detected. Original type:', audioBlob.type);
            }
            retryCount++;
            
            // انتظار قبل المحاولة التالية مع زيادة تدريجية
            if (retryCount < maxRetries) {
              const delay = 1000 * (retryCount + 1); // 1s, 2s, 3s
              console.log(`⏳ Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (error) {
          console.error(`❌ Network error (attempt ${retryCount + 1}/${maxRetries}):`, error);
          retryCount++;
          
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // إذا فشل الخادم البعيد، جرب الخادم المحلي
      if (!success) {
        console.log('🔄 All remote server attempts failed, trying local server...');
        await this.tryLocalServer(audioBlob);
      }
      
    } catch (error) {
      console.error('❌ Error processing audio chunk:', error);
    }
  }

  private async tryLocalServer(audioBlob: Blob) {
    try {
      const localConfig = getServerConfig(this.engine, false);
      
      // استخدام نفس منطق التحويل كما في الخادم البعيد
      const originalType = audioBlob.type;
      let fileName: string;
      let fileType: string;
      let processedBlob = audioBlob;
      
      if (originalType.includes('wav')) {
        fileName = 'audio.wav';
        fileType = 'audio/wav';
      } else if (originalType.includes('mp3')) {
        fileName = 'audio.mp3';
        fileType = 'audio/mpeg';
      } else if (originalType.includes('webm')) {
        // تحويل webm إلى wav للخادم المحلي أيضاً
        try {
          console.log('🔄 Converting webm to wav for local server...');
          const { AudioConverter } = await import('./audioConverter');
          
          // Check if blob is valid before conversion
          if (!audioBlob || audioBlob.size < 100) {
            throw new Error('Audio blob too small or invalid');
          }
          
          processedBlob = await AudioConverter.convertToWav(audioBlob);
          fileName = 'audio.wav';
          fileType = 'audio/wav';
          console.log('✅ Webm converted to wav for local server');
        } catch (conversionError) {
          console.warn('⚠️ Failed to convert webm to wav for local server:', conversionError);
          fileName = 'audio.webm';
          fileType = originalType;
        }
      } else {
        fileName = 'audio.wav';
        fileType = 'audio/wav';
      }
      
      try {
        const audioFile = new File([processedBlob], fileName, { type: fileType });
        const formData = new FormData();
        formData.append('file', audioFile);
        
        if (this.sourceLanguage !== 'auto') {
          formData.append('language', this.sourceLanguage);
        }
        
        console.log(`🔄 Trying local server with ${fileName}:`, localConfig.httpUrl);
        
        const response = await fetch(localConfig.httpUrl, {
          method: 'POST',
          body: formData,
          // إضافة timeout للخادم المحلي
          signal: AbortSignal.timeout(5000) // 5 ثوانٍ timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.transcription || data.text) {
            const transcription = data.transcription || data.text;
            this.currentTranscription = transcription;
            this.onTranscriptionUpdate?.(transcription);
            console.log(`🎤 Local server transcription received (${fileName}):`, transcription);
            
            if (transcription.trim()) {
              await this.translateText(transcription);
            }
            return; // نجح، توقف عن المحاولة
          }
        } else {
          console.warn(`⚠️ Local server failed with ${fileName}:`, response.status, response.statusText);
          
          // محاولة قراءة رسالة الخطأ من الخادم المحلي
          try {
            const errorText = await response.text();
            console.log(`❌ Local server error details:`, errorText);
          } catch (e) {
            console.log(`❌ Could not read local server error response`);
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`⏰ Local server timeout with ${fileName}`);
        } else {
          console.error(`❌ Error with ${fileName}:`, error);
        }
      }
      
      console.warn('⚠️ All local server attempts failed');
      
      // إذا فشل كل شيء، أرسل رسالة للمستخدم
      this.onTranscriptionUpdate?.('⚠️ Unable to process audio. Please try again.');
      
    } catch (error) {
      console.error('❌ Error with local server fallback:', error);
      this.onTranscriptionUpdate?.('⚠️ Unable to process audio. Please try again.');
    }
  }

  /**
   * معالجة الصوت المحول من ChunkCollector
   */
  private async processConvertedAudio(convertedBlob: Blob): Promise<void> {
    try {
      console.log('🔄 Processing converted audio blob:', convertedBlob.size, 'bytes');
      
      // Limit concurrent requests
      if (this.processingQueue.length >= this.maxConcurrentRequests) {
        console.warn('⚠️ Too many concurrent requests, skipping converted audio');
        return;
      }
      
      // Process the converted audio
      const processPromise = this.processAudioChunk(convertedBlob);
      this.processingQueue.push(processPromise);
      
      // Remove from queue when done
      processPromise.finally(() => {
        const index = this.processingQueue.indexOf(processPromise);
        if (index > -1) {
          this.processingQueue.splice(index, 1);
        }
      });
      
    } catch (error) {
      console.error('❌ Error processing converted audio:', error);
    }
  }

  private async translateText(text: string) {
    if (!text.trim()) return;
    
    try {
      // Import the enhanced translation service
      const { TranslationService } = await import('./translationService');
      
      const result = await TranslationService.translateText(
        text,
        this.targetLanguage,
        this.sourceLanguage
      );
      
      this.currentTranslation = result.translatedText;
      this.onTranslationUpdate?.(result.translatedText);
      console.log('🌍 Translation completed:', result.translatedText);
    } catch (error) {
      console.error('❌ Error in translation:', error);
    }
  }

  stopStreaming() {
    console.log('🛑 Stopping REST streaming service...');
    this.isStreaming = false;
    
    // Clear any pending timeouts
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    
    // Clear audio buffer
    this.audioBuffer = [];
    
    console.log('✅ REST streaming service stopped');
  }

  disconnect() {
    console.log('🔌 Disconnecting REST streaming service...');
    
    this.isStreaming = false;
    this.isConnected = false;
    
    // Clear any pending timeouts
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    
    // Clear audio buffer
    this.audioBuffer = [];
    
    // Cleanup chunk collector
    if (this.chunkCollector) {
      this.chunkCollector.destroy();
      this.chunkCollector = null;
    }
    
    console.log('✅ REST streaming service disconnected');
  }

  isConnectedStatus() {
    return this.isConnected;
  }

  getCurrentTranscription() {
    return this.currentTranscription;
  }

  getCurrentTranslation() {
    return this.currentTranslation;
  }
} 