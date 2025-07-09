import { AudioProcessor } from './audioProcessor';

export class SpeechService {
  private static validateApiKey(): void {
    const apiKey = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('AssemblyAI API key not found. Please add EXPO_PUBLIC_ASSEMBLYAI_API_KEY to your environment variables.');
    }
    if (apiKey.trim() === '' || apiKey === 'your_api_key_here') {
      throw new Error('Please set a valid AssemblyAI API key in your environment variables.');
    }
  }

  private static async transcribeWithAssemblyAI(audioBlob: Blob, targetLanguage?: string): Promise<string> {
    this.validateApiKey();
    const apiKey = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY!;
    
    try {
      // Process audio for AssemblyAI compatibility
      const processedAudioBlob = await AudioProcessor.processAudioForAssemblyAI(audioBlob);
      
      // Validate the processed audio blob
      const validation = AudioProcessor.validateAudioBlob(processedAudioBlob);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid audio file');
      }

      console.log('Uploading audio to AssemblyAI...', {
        size: processedAudioBlob.size,
        type: processedAudioBlob.type
      });

      // Step 1: Upload the audio file
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
        },
        body: processedAudioBlob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload response:', uploadResponse.status, errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.upload_url) {
        throw new Error('No upload URL returned from AssemblyAI');
      }

      const audioUrl = uploadData.upload_url;
      console.log('Audio uploaded successfully, starting transcription...');

      // Step 2: Request transcription with auto language detection only
      const transcriptRequestBody: any = {
        audio_url: audioUrl,
        language_detection: true, // Enable auto language detection
        punctuate: true,
        format_text: true,
        filter_profanity: false,
        dual_channel: false,
        speaker_labels: false
      };
      // لا ترسل أي خاصية ترجمة هنا

      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(transcriptRequestBody),
      });

      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text();
        console.error('Transcription request response:', transcriptResponse.status, errorText);
        throw new Error(`Transcription request failed: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
      }

      const transcriptData = await transcriptResponse.json();
      
      if (!transcriptData.id) {
        throw new Error('No transcript ID returned from AssemblyAI');
      }

      const transcriptId = transcriptData.id;
      console.log('Transcription requested, polling for results...', transcriptId);

      // Step 3: Poll for results
      return await this.pollForTranscriptResults(transcriptId, apiKey);
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred during transcription');
    }
  }

  private static async pollForTranscriptResults(transcriptId: string, apiKey: string): Promise<string> {
    const maxAttempts = 120; // 10 minutes max (5 second intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: {
            'authorization': apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        console.log(`Polling attempt ${attempts + 1}, status: ${result.status}`);

        if (result.status === 'completed') {
          if (!result.text || result.text.trim() === '') {
            return 'No speech detected in the recording';
          }
          return result.text.trim();
        } else if (result.status === 'error') {
          const errorMsg = result.error || 'Unknown transcription error';
          throw new Error(`Transcription failed: ${errorMsg}`);
        } else if (result.status === 'processing' || result.status === 'queued') {
          // Continue polling
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
          attempts++;
        } else {
          throw new Error(`Unexpected status: ${result.status}`);
        }
      } catch (error) {
        console.error('Polling error:', error);
        
        if (attempts >= 3) { // Allow a few retries for network issues
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    throw new Error('Transcription timeout - the recording may be too long. Please try with a shorter recording.');
  }

  static async transcribeAudio(audioBlob: Blob, targetLanguage?: string): Promise<string> {
    try {
      return await this.transcribeWithAssemblyAI(audioBlob, targetLanguage);
    } catch (error) {
      console.error('Transcription error:', error);
      
      if (error instanceof Error) {
        throw error; // Re-throw with original message
      }
      
      throw new Error('Failed to transcribe audio');
    }
  }

  // New: Real-time transcription for live translation via external server
  static async transcribeAudioLiveTranslation(audioBlob: Blob, targetLanguage?: string, sourceLanguage?: string): Promise<string> {
    try {
      // Replace with your external server URL
      const serverUrl = 'https://ai-voicesum.onrender.com/live-translate';
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('targetLanguage', targetLanguage ?? '');
      formData.append('sourceLanguage', sourceLanguage ?? '');

      const response = await fetch(serverUrl, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Live translation server error: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      if (!data.translatedText) {
        throw new Error('No translated text returned from live translation server');
      }
      return data.translatedText;
    } catch (error) {
      console.error('Live translation server error:', error);
      throw new Error('Failed to transcribe audio via live translation server');
    }
  }

  // Update: Real-time transcription uses external server for live translation
  static async transcribeAudioRealTime(audioBlob: Blob, targetLanguage?: string, sourceLanguage?: string, useLiveTranslationServer?: boolean): Promise<string> {
    try {
      if (useLiveTranslationServer) {
        // Use the new external server for live translation
        return await this.transcribeAudioLiveTranslation(audioBlob, targetLanguage, sourceLanguage);
      } else {
        // Default: use AssemblyAI
        return await this.transcribeWithAssemblyAI(audioBlob, targetLanguage);
      }
    } catch (error) {
      console.error('Real-time transcription error:', error);
      throw new Error('Failed to transcribe audio in real-time');
    }
  }

  static async summarizeText(text: string, targetLanguage?: string): Promise<string> {
    const qwenApiKey = process.env.EXPO_PUBLIC_QWEN_API_KEY;
    
    if (!qwenApiKey) {
      throw new Error('Qwen API key not found. Please add EXPO_PUBLIC_QWEN_API_KEY to your environment variables.');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for summarization');
    }

    if (text.length < 50) {
      throw new Error('Text is too short to summarize meaningfully');
    }

    const langCode = typeof targetLanguage === 'string' ? targetLanguage : '';
    let languageName = '';
    if (langCode.length > 0) {
      const langObj = SpeechService.getAvailableLanguages().find(l => l.code === langCode);
      languageName = langObj ? langObj.name : langCode;
    }

    try {
      const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenApiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that creates concise, clear summaries of spoken text. Focus on key points and maintain the original meaning. Keep summaries under 150 words.',
            },
            {
              role: 'user',
              content: `Summarize this text in a bullet-point list${languageName ? ` in ${languageName}` : ''}.
\n\n${text}`,
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Qwen API error:', response.status, errorText);
        throw new Error(`Failed to generate summary: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
        return data.choices[0].message.content.trim();
      } else {
        throw new Error('No summary generated by AI');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        throw error;
      }
      
      throw new Error('Failed to generate summary');
    }
  }

  static async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for translation');
    }

    try {
      // Use Google Translate API (free alternative)
      // إذا لم تحدد لغة مصدر، استخدم 'auto' ليكتشفها Google
      const sl = sourceLanguage || 'auto';
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Translate API error:', response.status, errorText);
        throw new Error('Failed to translate text');
      }

      const data = await response.json();
      
      // Concatenate all translated sentences
      let translatedText = '';
      if (Array.isArray(data) && Array.isArray(data[0])) {
        translatedText = data[0]
          .map((item: any) => (typeof item[0] === 'string' ? item[0] : (item[0] ? String(item[0]) : '')))
          .filter((s: string) => !!s)
          .join('');
      } else {
        translatedText = String(data[0][0][0]);
      }
      return translatedText || text; // Return original text if translation is empty
    } catch (error) {
      console.error('Translation error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        throw error;
      }
      
      throw new Error('Failed to translate text');
    }
  }

  // New method for real-time translation with caching
  private static translationCache = new Map<string, string>();
  
  static async translateTextRealTime(text: string, targetLanguage: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return '';
    }

    // Create cache key
    const cacheKey = `${text.toLowerCase().trim()}_${targetLanguage || 'en'}`;
    
    // Check cache first
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }

    try {
      const translation = await this.translateText(text, targetLanguage || 'en');
      
      // Cache the result
      this.translationCache.set(cacheKey, translation);
      
      // Limit cache size to prevent memory issues
      if (this.translationCache.size > 100) {
        const firstKey = this.translationCache.keys().next().value;
        this.translationCache.delete(firstKey);
      }
      
      return translation;
    } catch (error) {
      console.error('Real-time translation error:', error);
      return text; // Return original text if translation fails
    }
  }

  static getAvailableLanguages() {
    return [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'es', name: 'Spanish', flag: '🇪🇸' },
      { code: 'fr', name: 'French', flag: '🇫🇷' },
      { code: 'de', name: 'German', flag: '🇩🇪' },
      { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
      { code: 'it', name: 'Italian', flag: '🇮🇹' },
      { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
      { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
      { code: 'pl', name: 'Polish', flag: '🇵🇱' },
      { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
      { code: 'ru', name: 'Russian', flag: '🇷🇺' },
      { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
      { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
      { code: 'ca', name: 'Catalan', flag: '🇪🇸' },
      { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
      { code: 'az', name: 'Azerbaijani', flag: '🇦🇿' },
      { code: 'bg', name: 'Bulgarian', flag: '🇧🇬' },
      { code: 'bs', name: 'Bosnian', flag: '🇧🇦' },
      { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
      { code: 'cs', name: 'Czech', flag: '🇨🇿' },
      { code: 'da', name: 'Danish', flag: '🇩🇰' },
      { code: 'el', name: 'Greek', flag: '🇬🇷' },
      { code: 'et', name: 'Estonian', flag: '🇪🇪' },
      { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
      { code: 'fil', name: 'Filipino', flag: '🇵🇭' },
      { code: 'gl', name: 'Galician', flag: '🇪🇸' },
      { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
      { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
      { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
      { code: 'ko', name: 'Korean', flag: '🇰🇷' },
      { code: 'mk', name: 'Macedonian', flag: '🇲🇰' },
      { code: 'ms', name: 'Malay', flag: '🇲🇾' },
      { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
      { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
      { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
      { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
      { code: 'th', name: 'Thai', flag: '🇹🇭' },
      { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
      { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
      { code: 'yue', name: 'Cantonese', flag: '🇭🇰' },
    ];
  }
}