// API Services for LiveTranslate Web

// Transcription Services
export class TranscriptionService {
  private static async callFasterWhisper(audioBlob: Blob, sourceLanguage?: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    
    // Add language parameter if specified
    if (sourceLanguage && sourceLanguage !== 'auto') {
      formData.append('language', sourceLanguage);
    }
    
    const response = await fetch(`${import.meta.env.VITE_FASTER_WHISPER_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Faster Whisper API error:', response.status, errorText);
      throw new Error(`Faster Whisper transcription failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.text || result.transcription || '';
  }

  private static async callAzureSpeech(audioBlob: Blob, sourceLanguage?: string): Promise<string> {
    // Azure Speech implementation
    const language = sourceLanguage && sourceLanguage !== 'auto' ? sourceLanguage : 'en-US';
    const response = await fetch(`https://${import.meta.env.VITE_AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/speechtotext/v3.0/transcriptions`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': import.meta.env.VITE_AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav',
      },
      body: audioBlob,
    });
    
    if (!response.ok) {
      throw new Error('Azure Speech transcription failed');
    }
    
    const result = await response.json();
    return result.DisplayText || '';
  }

  static async transcribeAudio(audioBlob: Blob, engine: 'faster-whisper' | 'azure' = 'faster-whisper', sourceLanguage?: string): Promise<string> {
    try {
      if (engine === 'faster-whisper') {
        return await this.callFasterWhisper(audioBlob, sourceLanguage);
      } else {
        return await this.callAzureSpeech(audioBlob, sourceLanguage);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}

// Translation Services - Using Google Translate API
export class TranslationService {
  static async translateText(text: string, targetLang: string, service: 'google' | 'libre' = 'google', sourceLang?: string): Promise<string> {
    try {
      console.log(`🌍 Starting Google translation: "${text}" from ${sourceLang || 'auto'} to ${targetLang}`);
      
      // Use Google Translate API
      const result = await this.callGoogleTranslate(text, targetLang, sourceLang);
      
      console.log(`✅ Google translation successful: "${result}"`);
      return result;
    } catch (error) {
      console.error('❌ Google translation error:', error);
      
      // Fallback: return original text
      console.log('🔄 Fallback: returning original text');
      return text;
    }
  }

  // Google Translate API method
  private static async callGoogleTranslate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    try {
      // Use Google Translate API endpoint
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang || 'auto'}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Google Translate API returns an array where the first element contains translation segments
      if (data && data[0] && Array.isArray(data[0])) {
        const translatedText = data[0]
          .map((segment: any) => segment[0])
          .filter(Boolean)
          .join('');
        
        return translatedText;
      }
      
      throw new Error('Invalid response format from Google Translate API');
      
    } catch (error) {
      console.error('❌ Google Translate API error:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  private static async callLibreTranslate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    // Fallback to Google Translate
    return this.callGoogleTranslate(text, targetLang, sourceLang);
  }
}

// Summarization Services
export class SummarizationService {
  static async summarizeText(text: string): Promise<string> {
    try {
      // Try to use a CORS-friendly approach or skip if CORS issues
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || 'sk-demo'}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes text. Provide a concise summary of the given text.'
            },
            {
              role: 'user',
              content: `Please summarize this text: ${text}`
            }
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        // If OpenAI fails, try Qwen with CORS handling
        return await this.fallbackSummarization(text);
      }
      
      const result = await response.json();
      return result.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('Summarization error:', error);
      // Return a simple summary instead of failing
      return this.createSimpleSummary(text);
    }
  }

  static async summarizeTextWithPrompt(prompt: string): Promise<string> {
    try {
      // Try to use a CORS-friendly approach or skip if CORS issues
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || 'sk-demo'}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an intelligent AI assistant specialized in creating comprehensive and well-structured summaries. You excel at understanding context, identifying key points, and presenting information in a clear, professional manner.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        // If OpenAI fails, try Qwen with CORS handling
        return await this.fallbackSummarizationWithPrompt(prompt);
      }
      
      const result = await response.json();
      return result.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('Enhanced summarization error:', error);
      // Return a simple summary instead of failing
      const textMatch = prompt.match(/Text to summarize: (.+)/);
      const text = textMatch ? textMatch[1] : '';
      return this.createSimpleSummary(text);
    }
  }

  private static async fallbackSummarization(text: string): Promise<string> {
    try {
      // Try Qwen API with proper CORS handling
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_QWEN_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that summarizes text. Provide a concise summary of the given text.'
              },
              {
                role: 'user',
                content: `Please summarize this text: ${text}`
              }
            ]
          },
          parameters: {
            max_tokens: 150,
            temperature: 0.7,
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Qwen API failed');
      }
      
      const result = await response.json();
      return result.output?.text || result.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('Fallback summarization failed:', error);
      return this.createSimpleSummary(text);
    }
  }

  private static async fallbackSummarizationWithPrompt(prompt: string): Promise<string> {
    try {
      // Try Qwen API with enhanced prompt
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_QWEN_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'system',
                content: 'You are an intelligent AI assistant specialized in creating comprehensive and well-structured summaries. You excel at understanding context, identifying key points, and presenting information in a clear, professional manner.'
              },
              {
                role: 'user',
                content: prompt
              }
            ]
          },
          parameters: {
            max_tokens: 300,
            temperature: 0.7,
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Qwen API failed');
      }
      
      const result = await response.json();
      return result.output?.text || result.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('Enhanced fallback summarization failed:', error);
      const textMatch = prompt.match(/Text to summarize: (.+)/);
      const text = textMatch ? textMatch[1] : '';
      return this.createSimpleSummary(text);
    }
  }

  private static createSimpleSummary(text: string): string {
    // Create a simple summary by taking the first few sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const summary = sentences.slice(0, 2).join('. ') + '.';
    return summary || 'Summary not available';
  }
}

// File Upload Services
export class FileUploadService {
  static async uploadToAssemblyAI(audioBlob: Blob): Promise<string> {
    try {
      // First, upload the file
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': import.meta.env.VITE_ASSEMBLYAI_API_KEY,
        },
        body: audioBlob,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('File upload failed');
      }
      
      const uploadResult = await uploadResponse.json();
      const audioUrl = uploadResult.upload_url;
      
      // Then, start transcription
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': import.meta.env.VITE_ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: audioUrl,
        }),
      });
      
      if (!transcriptResponse.ok) {
        throw new Error('Transcription request failed');
      }
      
      const transcriptResult = await transcriptResponse.json();
      return transcriptResult.id;
    } catch (error) {
      console.error('AssemblyAI upload error:', error);
      throw error;
    }
  }

  static async getTranscriptionStatus(transcriptId: string): Promise<any> {
    try {
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': import.meta.env.VITE_ASSEMBLYAI_API_KEY,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get transcription status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get transcription status error:', error);
      throw error;
    }
  }
} 