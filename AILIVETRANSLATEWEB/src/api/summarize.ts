import { SummarizationService } from '../services/api';

export async function summarizeText(text: string): Promise<{ summary: string }> {
  try {
    const summary = await SummarizationService.summarizeText(text);
    return { summary };
  } catch (error) {
    console.error('Summarization API error:', error);
    throw new Error('Summarization failed');
  }
} 