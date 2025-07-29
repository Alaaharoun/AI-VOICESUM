// Enhanced Translation Service for LiveTranslate Web
// Using Google Translate Free API with fallback options

export interface TranslationResult {
  translatedText: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  service: string;
}

export class TranslationService {
  private static cache = new Map<string, string>();
  private static lastRequestTime = 0;
  private static requestDelay = 100; // 100ms delay between requests

  /**
   * Main translation function with multiple fallback options
   */
  static async translateText(
    text: string, 
    targetLang: string, 
    sourceLang: string = 'auto'
  ): Promise<TranslationResult> {
    try {
      if (!text || !text.trim()) {
        return {
          translatedText: text,
          originalText: text,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          service: 'none'
        };
      }

      // Check cache first
      const cacheKey = `${text}-${sourceLang}-${targetLang}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return {
          translatedText: cached,
          originalText: text,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          service: 'cache'
        };
      }

      // Add rate limiting
      await this.rateLimitDelay();

      // Try Google Translate first
      try {
        const googleResult = await this.callGoogleTranslate(text, targetLang, sourceLang);
        
        // Cache successful result
        this.cache.set(cacheKey, googleResult);
        
        return {
          translatedText: googleResult,
          originalText: text,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          service: 'google'
        };
      } catch (googleError) {
        console.warn('Google Translate failed, trying alternatives:', googleError);
        
        // Try alternative Google endpoint
        try {
          const altGoogleResult = await this.callAlternativeGoogleTranslate(text, targetLang, sourceLang);
          
          this.cache.set(cacheKey, altGoogleResult);
          
          return {
            translatedText: altGoogleResult,
            originalText: text,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
            service: 'google-alt'
          };
        } catch (altError) {
          console.warn('Alternative Google Translate failed:', altError);
          
          // Try MyMemory (free service)
          try {
            const myMemoryResult = await this.callMyMemoryTranslate(text, targetLang, sourceLang);
            
            this.cache.set(cacheKey, myMemoryResult);
            
            return {
              translatedText: myMemoryResult,
              originalText: text,
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
              service: 'mymemory'
            };
          } catch (myMemoryError) {
            console.warn('MyMemory translation failed:', myMemoryError);
            
            // Final fallback - basic translation mapping
            const fallbackResult = this.getFallbackTranslation(text, targetLang, sourceLang);
            
            return {
              translatedText: fallbackResult,
              originalText: text,
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
              service: 'fallback'
            };
          }
        }
      }
    } catch (error) {
      console.error('Translation service error:', error);
      
      // Return original text if all methods fail
      return {
        translatedText: text,
        originalText: text,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        service: 'error'
      };
    }
  }

  /**
   * Google Translate Free API (Primary method)
   */
  private static async callGoogleTranslate(
    text: string, 
    targetLang: string, 
    sourceLang: string = 'auto'
  ): Promise<string> {
    try {
      const cleanText = text.trim().substring(0, 5000); // Limit text length
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(cleanText)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Google Translate failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data[0] && Array.isArray(data[0])) {
        const translatedText = data[0]
          .filter((segment: any) => segment && segment[0])
          .map((segment: any) => segment[0])
          .join('');
        
        if (translatedText && translatedText.trim()) {
          return translatedText.trim();
        }
      }
      
      throw new Error('Invalid response format from Google Translate');
    } catch (error) {
      console.error('Google Translate error:', error);
      throw error;
    }
  }

  /**
   * Alternative Google Translate endpoint
   */
  private static async callAlternativeGoogleTranslate(
    text: string, 
    targetLang: string, 
    sourceLang: string = 'auto'
  ): Promise<string> {
    try {
      const cleanText = text.trim().substring(0, 5000);
      const url = `https://translate.google.com/translate_a/single?client=webapp&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(cleanText)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://translate.google.com/',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alternative Google Translate failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data[0] && Array.isArray(data[0])) {
        const translatedText = data[0]
          .filter((segment: any) => segment && segment[0])
          .map((segment: any) => segment[0])
          .join('');
        
        if (translatedText && translatedText.trim()) {
          return translatedText.trim();
        }
      }
      
      throw new Error('Invalid response from alternative Google Translate');
    } catch (error) {
      console.error('Alternative Google Translate error:', error);
      throw error;
    }
  }

  /**
   * MyMemory free translation service
   */
  private static async callMyMemoryTranslate(
    text: string, 
    targetLang: string, 
    sourceLang: string = 'auto'
  ): Promise<string> {
    try {
      const cleanText = text.trim().substring(0, 1000); // MyMemory has smaller limit
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${sourceLang}|${targetLang}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`MyMemory translation failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.responseData && data.responseData.translatedText) {
        const translatedText = data.responseData.translatedText;
        if (translatedText && translatedText.trim() && translatedText !== cleanText) {
          return translatedText.trim();
        }
      }
      
      throw new Error('Invalid or same response from MyMemory');
    } catch (error) {
      console.error('MyMemory translation error:', error);
      throw error;
    }
  }

  /**
   * Basic fallback translation for common phrases
   */
  private static getFallbackTranslation(
    text: string, 
    targetLang: string, 
    sourceLang: string
  ): string {
    // Basic translation mappings for common phrases
    const translations: Record<string, Record<string, string>> = {
      'en': {
        'مرحبا': 'Hello',
        'شكرا': 'Thank you',
        'نعم': 'Yes',
        'لا': 'No',
        'عذرا': 'Sorry',
        'من فضلك': 'Please',
        'كيف حالك': 'How are you',
        'ما اسمك': 'What is your name',
        'أهلا وسهلا': 'Welcome',
        'مع السلامة': 'Goodbye'
      },
      'ar': {
        'Hello': 'مرحبا',
        'Thank you': 'شكرا',
        'Yes': 'نعم',
        'No': 'لا',
        'Sorry': 'عذرا',
        'Please': 'من فضلك',
        'How are you': 'كيف حالك',
        'What is your name': 'ما اسمك',
        'Welcome': 'أهلا وسهلا',
        'Goodbye': 'مع السلامة'
      },
      'fr': {
        'Hello': 'Bonjour',
        'Thank you': 'Merci',
        'Yes': 'Oui',
        'No': 'Non',
        'Sorry': 'Désolé',
        'Please': 'S\'il vous plaît',
        'How are you': 'Comment allez-vous',
        'What is your name': 'Comment vous appelez-vous',
        'Welcome': 'Bienvenue',
        'Goodbye': 'Au revoir'
      },
      'es': {
        'Hello': 'Hola',
        'Thank you': 'Gracias',
        'Yes': 'Sí',
        'No': 'No',
        'Sorry': 'Lo siento',
        'Please': 'Por favor',
        'How are you': 'Cómo estás',
        'What is your name': 'Cómo te llamas',
        'Welcome': 'Bienvenido',
        'Goodbye': 'Adiós'
      }
    };

    const targetTranslations = translations[targetLang];
    if (targetTranslations && targetTranslations[text.trim()]) {
      return targetTranslations[text.trim()];
    }

    // If no translation found, return original text
    return text;
  }

  /**
   * Rate limiting to avoid API abuse
   */
  private static async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      const delay = this.requestDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Clear translation cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  static getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Validate language code
   */
  static isValidLanguageCode(langCode: string): boolean {
    const validCodes = [
      'auto', 'en', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
      'hi', 'tr', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'hu', 'ro', 'bg',
      'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'mt', 'el', 'he', 'th', 'vi', 'id',
      'ms', 'tl', 'sw', 'am', 'yo', 'zu'
    ];
    
    return validCodes.includes(langCode);
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): Record<string, string> {
    return {
      'auto': 'Auto-detect',
      'en': 'English',
      'ar': 'Arabic',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'hi': 'Hindi',
      'tr': 'Turkish',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'pl': 'Polish',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'ro': 'Romanian',
      'bg': 'Bulgarian',
      'hr': 'Croatian',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'et': 'Estonian',
      'lv': 'Latvian',
      'lt': 'Lithuanian',
      'mt': 'Maltese',
      'el': 'Greek',
      'he': 'Hebrew',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'id': 'Indonesian',
      'ms': 'Malay',
      'tl': 'Filipino',
      'sw': 'Swahili',
      'am': 'Amharic',
      'yo': 'Yoruba',
      'zu': 'Zulu'
    };
  }
}

// Export default instance
export default TranslationService; 