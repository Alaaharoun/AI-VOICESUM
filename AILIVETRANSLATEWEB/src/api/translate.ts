import { TranslationService } from '../services/api';

export async function translateText(text: string, targetLang: string): Promise<{ translation: string }> {
  try {
    const translation = await TranslationService.translateText(text, targetLang);
    return { translation };
  } catch (error) {
    console.error('Translation API error:', error);
    throw new Error('Translation failed');
  }
} 