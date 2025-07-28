// Simple logger utility
const Logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
};

import { transcriptionEngineService } from './transcriptionEngineService';

interface ConnectionStatus {
  isConnected: boolean;
  engine: string;
  latency: number;
  lastPing: number;
  error?: string;
}

export class EarlyConnectionService {
  private static instance: EarlyConnectionService;
  private connectionStatus: Map<string, ConnectionStatus> = new Map();
  private pingIntervals: Map<string, any> = new Map();
  private keepAliveConnections: Map<string, any> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): EarlyConnectionService {
    if (!EarlyConnectionService.instance) {
      EarlyConnectionService.instance = new EarlyConnectionService();
    }
    return EarlyConnectionService.instance;
  }

  /**
   * تهيئة الاتصال المبكر للمحرك الحالي فقط
   */
  async initializeEarlyConnections(): Promise<void> {
    if (this.isInitialized) {
      Logger.info('[EarlyConnection] Already initialized, skipping...');
      return;
    }

    Logger.info('[EarlyConnection] 🚀 Initializing early connections...');
    
    try {
      // الحصول على المحرك الحالي أولاً
      const currentEngine = await transcriptionEngineService.getCurrentEngine();
      Logger.info(`[EarlyConnection] Current engine detected: ${currentEngine}`);
      
      // تهيئة الاتصال المبكر للمحرك الحالي فقط
      if (currentEngine === 'huggingface') {
        await this.initializeHuggingFaceConnection();
      } else if (currentEngine === 'azure') {
        await this.initializeAzureConnection();
      } else {
        Logger.warn(`[EarlyConnection] Unknown engine: ${currentEngine}, skipping early connection`);
      }
      
      this.isInitialized = true;
      Logger.info('[EarlyConnection] ✅ Early connections initialized successfully');
    } catch (error) {
      Logger.error('[EarlyConnection] ❌ Failed to initialize early connections:', error);
    }
  }

  /**
   * تهيئة الاتصال المبكر لـ Hugging Face
   */
  private async initializeHuggingFaceConnection(): Promise<void> {
    try {
      Logger.info('[EarlyConnection] 🔗 Initializing Hugging Face early connection...');
      
      // التحقق من جاهزية سيرفر Hugging Face
      const startTime = Date.now();
      const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health', {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        this.connectionStatus.set('huggingface', {
          isConnected: true,
          engine: 'huggingface',
          latency,
          lastPing: Date.now(),
        });
        
        Logger.info(`[EarlyConnection] ✅ Hugging Face connection established (latency: ${latency}ms)`);
        
        // بدء ping دوري
        this.startPingInterval('huggingface');
        
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      Logger.warn('[EarlyConnection] ⚠️ Hugging Face early connection failed:', error);
      this.connectionStatus.set('huggingface', {
        isConnected: false,
        engine: 'huggingface',
        latency: -1,
        lastPing: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * تهيئة الاتصال المبكر لـ Azure
   */
  private async initializeAzureConnection(): Promise<void> {
    try {
      Logger.info('[EarlyConnection] 🔗 Initializing Azure early connection...');
      
      // إنشاء WebSocket مبكر لـ Azure
      const wsUrl = 'wss://ai-voicesum.onrender.com/ws';
      const startTime = Date.now();
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Azure WebSocket connection timeout'));
        }, 10000);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          const latency = Date.now() - startTime;
          
          this.connectionStatus.set('azure', {
            isConnected: true,
            engine: 'azure',
            latency,
            lastPing: Date.now(),
          });
          
          // حفظ الاتصال للاستخدام اللاحق
          this.keepAliveConnections.set('azure', ws);
          
          Logger.info(`[EarlyConnection] ✅ Azure WebSocket connection established (latency: ${latency}ms)`);
          
          // إرسال رسالة تهيئة بسيطة
          const initMessage = {
            type: 'init',
            language: 'ar-SA',
            targetLanguage: 'en-US',
            clientSideTranslation: true,
            realTimeMode: true,
            autoDetection: true,
            audioConfig: {
              sampleRate: 16000,
              channels: 1,
              bitsPerSample: 16,
              encoding: 'pcm_s16le'
            }
          };
          
          ws.send(JSON.stringify(initMessage));
          
          // بدء ping دوري
          this.startPingInterval('azure');
          
          resolve();
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          Logger.warn('[EarlyConnection] ⚠️ Azure WebSocket connection failed:', error);
          this.connectionStatus.set('azure', {
            isConnected: false,
            engine: 'azure',
            latency: -1,
            lastPing: Date.now(),
            error: 'WebSocket connection failed',
          });
          reject(error);
        };
        
        ws.onclose = () => {
          Logger.info('[EarlyConnection] 🔌 Azure WebSocket connection closed');
          this.connectionStatus.set('azure', {
            isConnected: false,
            engine: 'azure',
            latency: -1,
            lastPing: Date.now(),
            error: 'Connection closed',
          });
        };
      });
    } catch (error) {
      Logger.warn('[EarlyConnection] ⚠️ Azure early connection failed:', error);
      this.connectionStatus.set('azure', {
        isConnected: false,
        engine: 'azure',
        latency: -1,
        lastPing: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * بدء ping دوري للمحرك المحدد
   */
  private startPingInterval(engine: string): void {
    // إيقاف ping سابق إذا كان موجوداً
    this.stopPingInterval(engine);
    
    const interval = setInterval(async () => {
      await this.pingEngine(engine);
    }, 30000); // كل 30 ثانية
    
    this.pingIntervals.set(engine, interval);
    Logger.info(`[EarlyConnection] Started ping interval for ${engine} (30s)`);
  }

  /**
   * إيقاف ping دوري للمحرك المحدد
   */
  private stopPingInterval(engine: string): void {
    const interval = this.pingIntervals.get(engine);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(engine);
      Logger.info(`[EarlyConnection] Stopped ping interval for ${engine}`);
    }
  }

  /**
   * إرسال ping للمحرك المحدد
   */
  private async pingEngine(engine: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (engine === 'huggingface') {
        // ping لـ Hugging Face عبر HTTP
        const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health', {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
          const latency = Date.now() - startTime;
          this.updateConnectionStatus(engine, true, latency);
          Logger.info(`[EarlyConnection] 🏓 Hugging Face ping successful (${latency}ms)`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } else if (engine === 'azure') {
        // ping لـ Azure عبر WebSocket
        const ws = this.keepAliveConnections.get('azure');
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          const latency = Date.now() - startTime;
          this.updateConnectionStatus(engine, true, latency);
          Logger.info(`[EarlyConnection] 🏓 Azure ping successful (${latency}ms)`);
        } else {
          throw new Error('WebSocket not ready');
        }
      }
    } catch (error) {
      this.updateConnectionStatus(engine, false, -1, error instanceof Error ? error.message : 'Ping failed');
      Logger.warn(`[EarlyConnection] ⚠️ ${engine} ping failed:`, error);
    }
  }

  /**
   * تحديث حالة الاتصال
   */
  private updateConnectionStatus(engine: string, isConnected: boolean, latency: number, error?: string): void {
    const currentStatus = this.connectionStatus.get(engine);
    if (currentStatus) {
      currentStatus.isConnected = isConnected;
      currentStatus.latency = latency;
      currentStatus.lastPing = Date.now();
      if (error) {
        currentStatus.error = error;
      } else {
        delete currentStatus.error;
      }
    }
  }

  /**
   * التحقق من جاهزية المحرك الحالي
   */
  async isCurrentEngineReady(): Promise<boolean> {
    try {
      const currentEngine = await transcriptionEngineService.getCurrentEngine();
      const status = this.connectionStatus.get(currentEngine);
      return status?.isConnected || false;
    } catch (error) {
      Logger.warn('[EarlyConnection] Error checking current engine readiness:', error);
      return false;
    }
  }

  /**
   * الحصول على WebSocket جاهز لـ Azure
   */
  getAzureWebSocket(): WebSocket | null {
    const ws = this.keepAliveConnections.get('azure');
    return ws && ws.readyState === WebSocket.OPEN ? ws : null;
  }

  /**
   * الحصول على إحصائيات الاتصال
   */
  getConnectionStats(): Record<string, ConnectionStatus> {
    const stats: Record<string, ConnectionStatus> = {};
    this.connectionStatus.forEach((status, engine) => {
      stats[engine] = { ...status };
    });
    return stats;
  }

  /**
   * إعادة تهيئة الاتصال للمحرك المحدد
   */
  async reconnectEngine(engine: string): Promise<void> {
    Logger.info(`[EarlyConnection] 🔄 Reconnecting ${engine}...`);
    
    // إيقاف الاتصال الحالي
    this.stopPingInterval(engine);
    const ws = this.keepAliveConnections.get(engine);
    if (ws) {
      ws.close();
      this.keepAliveConnections.delete(engine);
    }
    
    // إعادة الاتصال
    if (engine === 'huggingface') {
      await this.initializeHuggingFaceConnection();
    } else if (engine === 'azure') {
      await this.initializeAzureConnection();
    }
  }

  /**
   * تنظيف جميع الاتصالات
   */
  cleanup(): void {
    Logger.info('[EarlyConnection] 🧹 Cleaning up all connections...');
    
    // إيقاف جميع ping intervals
    this.pingIntervals.forEach((interval, engine) => {
      clearInterval(interval);
    });
    this.pingIntervals.clear();
    
    // إغلاق جميع WebSocket connections
    this.keepAliveConnections.forEach((ws, engine) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.keepAliveConnections.clear();
    
    // إعادة تعيين الحالة
    this.connectionStatus.clear();
    this.isInitialized = false;
    
    Logger.info('[EarlyConnection] ✅ Cleanup completed');
  }
} 