import { supabase } from '@/lib/supabase';

export type TranscriptionEngine = 'azure' | 'huggingface';

export interface TranscriptionEngineConfig {
  engine: TranscriptionEngine;
  azureApiKey?: string;
  huggingFaceUrl?: string;
}

export class TranscriptionEngineService {
  private static instance: TranscriptionEngineService;
  private currentEngine: TranscriptionEngine = 'azure';

  private constructor() {}

  public static getInstance(): TranscriptionEngineService {
    if (!TranscriptionEngineService.instance) {
      TranscriptionEngineService.instance = new TranscriptionEngineService();
    }
    return TranscriptionEngineService.instance;
  }

  /**
   * Get the current transcription engine setting
   */
  async getCurrentEngine(): Promise<TranscriptionEngine> {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'transcription_engine')
        .single();
      
      if (error) {
        console.warn('Error fetching transcription engine setting:', error);
        return 'azure'; // Default to Azure
      }
      
      if (data && data.value) {
        this.currentEngine = data.value as TranscriptionEngine;
        return this.currentEngine;
      }
      
      return 'azure'; // Default to Azure
    } catch (error) {
      console.error('Error getting transcription engine:', error);
      return 'azure'; // Default to Azure
    }
  }

  /**
   * Set the transcription engine
   */
  async setEngine(engine: TranscriptionEngine): Promise<void> {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'transcription_engine', value: engine }, { onConflict: 'key' });
      
      if (error) {
        throw error;
      }
      
      this.currentEngine = engine;
    } catch (error) {
      console.error('Error setting transcription engine:', error);
      throw error;
    }
  }

  /**
   * Get the current engine configuration
   */
  async getEngineConfig(): Promise<TranscriptionEngineConfig> {
    const engine = await this.getCurrentEngine();
    
    const config: TranscriptionEngineConfig = {
      engine,
    };

    // Get Azure API key if needed
    if (engine === 'azure') {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'ASSEMBLYAI_API_KEY')
          .single();
        
        if (data && data.value) {
          config.azureApiKey = data.value;
        }
      } catch (error) {
        console.warn('Error fetching Azure API key:', error);
      }
    }

    // Get Hugging Face URL if needed
    if (engine === 'huggingface') {
      config.huggingFaceUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
    }

    return config;
  }

  /**
   * Check if the current engine is properly configured
   */
  async isEngineConfigured(): Promise<boolean> {
    const config = await this.getEngineConfig();
    
    if (config.engine === 'azure') {
      return !!(config.azureApiKey && config.azureApiKey.trim() !== '');
    }
    
    if (config.engine === 'huggingface') {
      return !!(config.huggingFaceUrl && config.huggingFaceUrl.trim() !== '');
    }
    
    return false;
  }

  /**
   * Get engine status information
   */
  async getEngineStatus(): Promise<{
    engine: TranscriptionEngine;
    configured: boolean;
    status: 'ready' | 'not_configured' | 'error';
    message: string;
  }> {
    const config = await this.getEngineConfig();
    const configured = await this.isEngineConfigured();
    
    if (!configured) {
      return {
        engine: config.engine,
        configured: false,
        status: 'not_configured',
        message: config.engine === 'azure' 
          ? 'Azure API key not configured' 
          : 'Hugging Face URL not configured'
      };
    }

    // Test the engine connectivity
    try {
      if (config.engine === 'huggingface') {
        const response = await fetch(`${config.huggingFaceUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        
        if (response.ok) {
          return {
            engine: config.engine,
            configured: true,
            status: 'ready',
            message: 'Hugging Face service is ready'
          };
        } else {
          return {
            engine: config.engine,
            configured: true,
            status: 'error',
            message: `Hugging Face service error: ${response.status}`
          };
        }
      } else {
        // For Azure, we assume it's ready if the API key is configured
        return {
          engine: config.engine,
          configured: true,
          status: 'ready',
          message: 'Azure service is ready'
        };
      }
    } catch (error) {
      return {
        engine: config.engine,
        configured: true,
        status: 'error',
        message: `Service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const transcriptionEngineService = TranscriptionEngineService.getInstance(); 