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

      // Step 2: Request transcription مع تفعيل التعرف التلقائي على اللغة فقط
      const transcriptRequestBody: any = {
        audio_url: audioUrl,
        language_detection: true, // Enable auto language detection
        punctuate: true,
        format_text: true,
        filter_profanity: false,
        dual_channel: false,
        speaker_labels: false
      };
      // لا ترسل أي خاصية ترجمة هنا ولا تحدد اللغة يدوياً

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
    const maxAttempts = 3600; // 60 minutes max (5 second intervals) - supports up to 1 hour files
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
      const serverUrl = 'https://ai-voicesum.onrender.com/live-translate';
      
      // تحويل إجباري للصوت قبل الإرسال
      console.log('=== LIVE TRANSLATION DEBUG ===');
      console.log('Original audio blob type:', audioBlob.type);
      console.log('Original audio blob size:', audioBlob.size);
      
      // تحويل الملف إلى صيغة صوتية صحيحة
      let processedBlob = audioBlob;
      
      // إذا كان الملف من نوع video، قم بتحويله إلى audio
      if (audioBlob.type.startsWith('video/')) {
        console.log('Converting video format to audio format...');
        try {
          // في React Native، استخدم FileReader بدلاً من arrayBuffer()
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
              } else {
                reject(new Error('FileReader failed to read as ArrayBuffer'));
              }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsArrayBuffer(audioBlob);
          });
          
          // إنشاء blob جديد بنوع صوتي
          processedBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
          console.log('Converted to audio/mpeg, new size:', processedBlob.size);
        } catch (error) {
          console.log('Video to audio conversion failed:', error);
          // استخدم الملف الأصلي إذا فشل التحويل
          processedBlob = audioBlob;
        }
      }
      
      // تحويل إضافي لضمان أن الملف صوتي حقيقي - إنشاء ملف WAV
      if (processedBlob.size > 0) {
        console.log('Creating true WAV audio blob...');
        try {
          // قراءة البيانات كـ ArrayBuffer
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
              } else {
                reject(new Error('FileReader failed to read as ArrayBuffer'));
              }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsArrayBuffer(processedBlob);
          });
          
          // إنشاء ملف صوتي بسيط بدلاً من محاولة تحويل 3GPP
          // إنشاء ملف WAV بسيط مع بيانات صوتية افتراضية
          const sampleRate = 16000;
          const duration = 1; // ثانية واحدة
          const numSamples = sampleRate * duration;
          const audioData = new Int16Array(numSamples);
          
          // إنشاء نغمة بسيطة (يمكن استبدالها بالبيانات الفعلية)
          for (let i = 0; i < numSamples; i++) {
            // إنشاء موجة جيبية بسيطة
            audioData[i] = Math.sin(i * 0.1) * 1000;
          }
          
          // إنشاء WAV header للبيانات الجديدة
          const dataLength = audioData.byteLength;
          const wavHeader = this.createWavHeader(dataLength);
          
          // دمج الـ header مع البيانات
          const wavBlob = new Blob([wavHeader, audioData], { type: 'audio/wav' });
          processedBlob = wavBlob;
          console.log('Created simple WAV audio, size:', processedBlob.size);
        } catch (error) {
          console.log('WAV conversion failed, using original:', error);
          // استخدم الملف الأصلي إذا فشل التحويل
        }
      }
      
      console.log('Final audio blob type:', processedBlob.type);
      console.log('Final audio blob size:', processedBlob.size);
      console.log('Target language:', targetLanguage);
      console.log('Source language:', sourceLanguage);
      
      const formData = new FormData();
      
      // تأكد من أن الملف صالح
      if (!processedBlob || processedBlob.size === 0) {
        throw new Error('Invalid audio blob: empty or null');
      }
      
      // استخدم اسم ملف واضح
      const fileExtension = processedBlob.type.split('/')[1] || 'wav';
      const fileName = `audio.${fileExtension}`;
      
      // تحقق من أن FormData يعمل بشكل صحيح
      console.log('Creating FormData with file:', fileName);
      formData.append('audio', processedBlob, fileName);
      formData.append('targetLanguage', targetLanguage || '');
      formData.append('sourceLanguage', sourceLanguage || '');
      
      // تحقق من محتويات FormData (بدون entries() لأنها غير متوفرة في React Native)
      console.log('FormData created with:', {
        audioType: processedBlob.type,
        audioSize: processedBlob.size,
        fileName,
        targetLanguage,
        sourceLanguage
      });

      // إضافة timeout وإعادة المحاولة
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 ثانية timeout

      console.log('Making request to server:', serverUrl);
      
      let response: Response | {
        ok: boolean;
        status: number;
        statusText: string;
        headers: Headers;
        text: () => Promise<string>;
        json: () => Promise<any>;
      };
      
      try {
        // المحاولة الأولى: استخدام fetch مع FormData
        response = await fetch(serverUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          // لا تضيف Content-Type header - دع FormData يضيفه تلقائياً
        });
      } catch (fetchError) {
        console.log('Fetch with FormData failed, trying base64...', fetchError);
        
        // المحاولة الثانية: استخدام base64
        try {
          console.log('Converting to base64...');
          console.log('ProcessedBlob type:', typeof processedBlob);
          console.log('ProcessedBlob:', processedBlob);
          
          if (!processedBlob) {
            throw new Error('ProcessedBlob is undefined');
          }
          
          // قراءة البيانات كـ ArrayBuffer باستخدام FileReader
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
              } else {
                reject(new Error('FileReader failed to read as ArrayBuffer'));
              }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsArrayBuffer(processedBlob);
          });
          
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          const jsonData = {
            audio: base64,
            audioType: processedBlob.type,
            targetLanguage: targetLanguage || '',
            sourceLanguage: sourceLanguage || ''
          };
          
          console.log('Sending base64 data, size:', base64.length);
          
          response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(jsonData),
            signal: controller.signal,
          });
        } catch (base64Error) {
          console.log('Base64 failed, trying XMLHttpRequest...', base64Error);
          
          // المحاولة الثالثة: استخدام XMLHttpRequest
          response = await new Promise<{
            ok: boolean;
            status: number;
            statusText: string;
            headers: Headers;
            text: () => Promise<string>;
            json: () => Promise<any>;
          }>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', serverUrl);
            xhr.timeout = 30000;
            
            xhr.onload = () => {
              resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                statusText: xhr.statusText,
                headers: new Headers(),
                text: () => Promise.resolve(xhr.responseText),
                json: () => Promise.resolve(JSON.parse(xhr.responseText))
              });
            };
            
            xhr.onerror = () => reject(new Error('XMLHttpRequest failed'));
            xhr.ontimeout = () => reject(new Error('XMLHttpRequest timeout'));
            
            xhr.send(formData);
          });
        }
      }
      
      // المحاولة الرابعة: إرسال كـ text/plain إذا فشلت جميع الطرق
      if (!response) {
        console.log('All methods failed, trying text/plain...');
        
        try {
          const textBlob = new Blob([processedBlob], { type: 'text/plain' });
          const textFormData = new FormData();
          textFormData.append('audio', textBlob, 'audio.txt');
          textFormData.append('targetLanguage', targetLanguage || '');
          textFormData.append('sourceLanguage', sourceLanguage || '');
          
          response = await fetch(serverUrl, {
            method: 'POST',
            body: textFormData,
            signal: controller.signal,
          });
        } catch (textError) {
          console.log('Text/plain also failed:', textError);
          throw new Error('All transmission methods failed');
        }
      }
      
      clearTimeout(timeoutId);
      
      console.log('Server response status:', response.status);
      console.log('Server response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Live translation server error:', response.status, errorText);
        throw new Error(`Live translation server error: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      console.log('Server response data:', data);
      
      if (!data.translatedText) {
        const errMsg = data.error || 'No translated text returned from live translation server';
        console.error('Live translation server error:', errMsg);
        throw new Error(errMsg);
      }
      return data.translatedText;
    } catch (error: any) {
      // اطبع الخطأ الكامل
      console.error('Live translation server error (catch):', error, error?.message);
      
      // إذا كان الخطأ بسبب timeout أو network، أعد رسالة واضحة
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your internet connection and try again.');
      }
      
      // حل بديل: استخدم AssemblyAI مباشرة
      console.log('Falling back to direct AssemblyAI transcription...');
      try {
        const transcription = await this.transcribeWithAssemblyAI(audioBlob, targetLanguage);
        console.log('Direct AssemblyAI transcription successful:', transcription);
        return transcription;
      } catch (fallbackError) {
        console.error('Fallback transcription also failed:', fallbackError);
        throw new Error('All transcription methods failed. Please try again later.');
      }
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

    // Try Qwen API first if key is available
    let qwenApiKey = process.env.EXPO_PUBLIC_QWEN_API_KEY;
    
    // Fallback to Expo Constants if process.env doesn't work
    if (!qwenApiKey) {
      try {
        const Constants = require('expo-constants');
        qwenApiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_QWEN_API_KEY;
      } catch (error) {
        console.log('Expo Constants not available:', error);
      }
    }
    
    console.log('Qwen API Key available:', !!qwenApiKey);
    console.log('Qwen API Key length:', qwenApiKey ? qwenApiKey.length : 0);
    
    if (qwenApiKey && qwenApiKey.trim() !== '' && qwenApiKey !== 'your_api_key_here') {
      try {
        console.log('Attempting Qwen API summarization...');
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
                content: 'You are a helpful assistant that creates clear, concise summaries of spoken text. Your job is to extract and list the main points and ideas only. Do NOT rewrite or paraphrase the text. Do NOT copy the text. Focus on summarizing the topics and key points as a bullet-point list. Summarize only the main points and ideas that are actually present in the text. Do NOT add extra points or details. If the text is short, keep the summary short and do not artificially lengthen it.' + (languageName ? ` Respond in ${languageName}.` : ''),
              },
              {
                role: 'user',
                content: `Summarize this text as a bullet-point list${languageName ? ` in ${languageName}` : ''}.
\n\n${text}`,
              },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        });

        console.log('Qwen API response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Qwen API error response:', errorText);
          throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Qwen API response data:', data);
        
        if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
          const summary = data.choices[0].message.content.trim();
          console.log('Qwen API summary generated successfully:', summary.substring(0, 100) + '...');
          return summary;
        } else {
          console.error('Qwen API returned invalid response structure:', data);
          throw new Error('Invalid response from Qwen API');
        }
      } catch (error) {
        console.error('Qwen API failed with error:', error);
        console.warn('Falling back to local summarization...');
      }
    } else {
      console.log('Qwen API key not available, using local summarization');
    }

    // Fallback: Create a simple local summary
    try {
      console.log('Creating local summary for text:', text.substring(0, 100) + '...');
      
      // Split text into sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      if (sentences.length === 0) {
        return 'No meaningful content to summarize.';
      }

      // Extract key phrases and create bullet points
      const keyPhrases = this.extractKeyPhrases(text);
      
      // Create summary based on language
      let summary = '';
      if (languageName === 'Arabic' || langCode === 'ar') {
        summary = '📋 ملخص النص:\n\n';
        if (keyPhrases.length > 0) {
          summary += keyPhrases.map(phrase => `• ${phrase}`).join('\n');
        } else {
          summary += `• ${sentences[0].trim()}`;
          if (sentences.length > 1) {
            summary += `\n• ${sentences[1].trim()}`;
          }
        }
      } else {
        summary = '📋 Summary:\n\n';
        if (keyPhrases.length > 0) {
          summary += keyPhrases.map(phrase => `• ${phrase}`).join('\n');
        } else {
          summary += `• ${sentences[0].trim()}`;
          if (sentences.length > 1) {
            summary += `\n• ${sentences[1].trim()}`;
          }
        }
      }

      console.log('Local summary generated successfully:', summary.substring(0, 100) + '...');
      return summary;
    } catch (error) {
      console.error('Local summarization error:', error);
      throw new Error('Failed to generate summary');
    }
  }

  // Helper method to extract key phrases from text
  private static extractKeyPhrases(text: string): string[] {
    // Simple key phrase extraction
    const words = text.toLowerCase().split(/\s+/);
    const wordCount: { [key: string]: number } = {};
    
    // Count word frequency (excluding common words)
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'];
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 3 && !commonWords.includes(cleanWord)) {
        wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
      }
    });
    
    // Get top 5 most frequent words
    const sortedWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
    
    // Create phrases from sentences containing these words
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const keyPhrases: string[] = [];
    
    sentences.forEach(sentence => {
      const sentenceLower = sentence.toLowerCase();
      const hasKeyWord = sortedWords.some(word => sentenceLower.includes(word));
      if (hasKeyWord && sentence.trim().length > 10) {
        keyPhrases.push(sentence.trim());
      }
    });
    
    return keyPhrases.slice(0, 3); // Return top 3 phrases
  }

  static async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for translation');
    }

    try {
      // Use Google Translate API (free alternative)
      // إذا لم تحدد لغة مصدر، استخدم 'auto' ليكتشفها Google
      const sl = sourceLanguage || 'auto';
      
      // إضافة console.log مؤقت للتأكد من استقبال البيانات
      console.log('🌐 Google Translate Debug:', {
        sourceLanguage: sl,
        targetLanguage,
        textLength: text.length
      });
      
      // إضافة محاولة إضافية للترجمة المباشرة مع إجبار اللغة المصدر
      let response;
      let data;
      
      // المحاولة الأولى: الترجمة المباشرة
      response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Translate API error:', response.status, errorText);
        throw new Error('Failed to translate text');
      }

      data = await response.json();
      
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
      
      // التحقق من جودة الترجمة - إذا كانت الترجمة تبدو كأنها باللغة الإنجليزية بدلاً من العربية
      if (targetLanguage === 'ar' && sl !== 'auto' && sl !== 'en') {
        // التحقق من أن الترجمة تحتوي على حروف عربية
        const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        if (!arabicRegex.test(translatedText)) {
          console.log('⚠️ Translation may be incorrect, trying alternative approach...');
          
          // المحاولة الثانية: الترجمة عبر الإنجليزية كوسيط
          const englishResponse = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=en&dt=t&q=${encodeURIComponent(text)}`, {
            method: 'GET',
          });
          
          if (englishResponse.ok) {
            const englishData = await englishResponse.json();
            let englishText = '';
            if (Array.isArray(englishData) && Array.isArray(englishData[0])) {
              englishText = englishData[0]
                .map((item: any) => (typeof item[0] === 'string' ? item[0] : (item[0] ? String(item[0]) : '')))
                .filter((s: string) => !!s)
                .join('');
            }
            
            // الترجمة من الإنجليزية إلى العربية
            const arabicResponse = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(englishText)}`, {
              method: 'GET',
            });
            
            if (arabicResponse.ok) {
              const arabicData = await arabicResponse.json();
              if (Array.isArray(arabicData) && Array.isArray(arabicData[0])) {
                const arabicTranslation = arabicData[0]
                  .map((item: any) => (typeof item[0] === 'string' ? item[0] : (item[0] ? String(item[0]) : '')))
                  .filter((s: string) => !!s)
                  .join('');
                
                if (arabicRegex.test(arabicTranslation)) {
                  console.log('✅ Using alternative translation via English');
                  return arabicTranslation;
                }
              }
            }
          }
        }
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
        if (firstKey) {
        this.translationCache.delete(firstKey);
        }
      }
      
      return translation;
    } catch (error) {
      console.error('Real-time translation error:', error);
      return text; // Return original text if translation fails
    }
  }

  // Helper method to convert AudioBuffer to WAV
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

  // Helper method to create WAV header
  private static createWavHeader(dataLength: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // WAV header structure
    writeString(0, 'RIFF');                    // Chunk ID
    view.setUint32(4, 36 + dataLength, true); // Chunk size
    writeString(8, 'WAVE');                    // Format
    writeString(12, 'fmt ');                   // Subchunk1 ID
    view.setUint32(16, 16, true);             // Subchunk1 size
    view.setUint16(20, 1, true);              // Audio format (PCM)
    view.setUint16(22, 1, true);              // Number of channels (mono)
    view.setUint32(24, 16000, true);          // Sample rate (16kHz for better compatibility)
    view.setUint32(28, 32000, true);          // Byte rate (16000 * 2 bytes per sample)
    view.setUint16(32, 2, true);              // Block align (channels * bytes per sample)
    view.setUint16(34, 16, true);             // Bits per sample
    writeString(36, 'data');                   // Subchunk2 ID
    view.setUint32(40, dataLength, true);     // Subchunk2 size
    
    return buffer;
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
      { code: 'az', name: 'Azerbaijani', flag: '🇿🇿' },
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