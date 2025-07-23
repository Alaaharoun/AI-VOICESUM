import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Button, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DownloadHelper } from '@/utils/downloadHelper';
import { SpeechService } from '@/services/speechService';
import { Copy, Volume2, Save } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Tts from 'react-native-tts';
import { useSummary } from '@/contexts/SummaryContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { franc } from 'franc';

export default function SummaryView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { summary, setSummary, transcription, setTranscription, translation, setTranslation, targetLanguage, setTargetLanguage } = useSummary();
  const effectiveTranscription = typeof params.transcription === 'string' && params.transcription.length > 0 ? params.transcription : transcription;
  const effectiveTranslation = typeof params.translation === 'string' && params.translation.length > 0 ? params.translation : translation;
  const effectiveSummary = typeof params.summary === 'string' && params.summary.length > 0 ? params.summary : summary;
  const effectiveTargetLanguage = typeof params.targetLanguage === 'string' && params.targetLanguage.length > 0 ? params.targetLanguage : targetLanguage;
  const [aiSummary, setAiSummary] = React.useState(effectiveSummary);
  const [isSummarizing, setIsSummarizing] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const { user } = useAuth();
  const [isSaved, setIsSaved] = React.useState(false);

  const languageMap: Record<string, string> = {
    'eng': 'en-US',
    'ara': 'ar-SA',
    'fra': 'fr-FR',
    'spa': 'es-ES',
    // أضف المزيد حسب الحاجة
  };

  React.useEffect(() => {
    // إنشاء تلخيص تلقائياً إذا لم يكن موجوداً وكان هناك نص للتلخيص
    if (!aiSummary && !isSummarizing && (effectiveTranslation || effectiveTranscription)) {
      const textToSummarize = effectiveTranslation || effectiveTranscription;
      if (textToSummarize && textToSummarize.trim().length >= 50) {
        handleGenerateSummary();
      }
    }
  }, [summary, transcription, translation, targetLanguage]);

  React.useEffect(() => {
    setIsSaved(false);
  }, [aiSummary]);

  const handleDownloadSummary = (format: 'txt' | 'rtf' | 'doc') => {
    const textToDownload = aiSummary || summary;
    if (!textToDownload || textToDownload.trim() === '') {
      Alert.alert('Notice', 'No summary available for download or the summary is empty.');
      return;
    }
    const filename = DownloadHelper.generateFilename('summary');
    DownloadHelper.downloadText(textToDownload, filename, format);
  };

  const saveSummaryToHistory = async (summaryText: string) => {
    if (!user) {
      console.log('No user available, skipping history save');
      return;
    }
    
    if (!summaryText || summaryText.trim().length === 0) {
      console.log('Empty summary text, skipping history save');
      return;
    }
    
    try {
      console.log('Saving summary to history...');
      const { error } = await supabase.from('recordings').insert([
        {
          user_id: user.id,
          transcription: effectiveTranscription,
          translation: effectiveTranslation,
          summary: summaryText,
          translationSummary: '',
          target_language: effectiveTargetLanguage,
          created_at: new Date().toISOString(),
        }
      ]);
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      setIsSaved(true);
      console.log('Summary saved to history successfully');
      // لا نعرض Alert هنا لتجنب إزعاج المستخدم
    } catch (e) {
      setIsSaved(false);
      console.warn('Failed to save summary to history:', e);
      // لا نعرض Alert هنا لتجنب إزعاج المستخدم
    }
  };

  const handleGenerateSummary = async () => {
    const textToSummarize = effectiveTranslation || effectiveTranscription;
    if (!textToSummarize || textToSummarize.trim().length < 50) {
      Alert.alert('Notice', 'Text is too short to summarize. Please provide at least 50 characters.');
      return;
    }
    if (isSummarizing) return; // تجنب التكرار
    
    setIsSummarizing(true);
    console.log('=== SUMMARY GENERATION DEBUG ===');
    console.log('Text to summarize:', textToSummarize.substring(0, 100) + '...');
    console.log('Target language:', effectiveTargetLanguage);
    console.log('Text length:', textToSummarize.length);
    
    try {
      const result = await SpeechService.summarizeText(textToSummarize, effectiveTargetLanguage);
      console.log('Summary generation completed successfully');
      console.log('Result length:', result ? result.length : 0);
      console.log('Result preview:', result ? result.substring(0, 100) + '...' : 'null');
      
      if (result && result.trim().length > 0) {
        // أولاً: حفظ التلخيص في state
        setAiSummary(result);
        setSummary(result);
        console.log('Summary saved to state successfully');
        
        // ثانياً: حفظ في التاريخ (بدون انتظار)
        saveSummaryToHistory(result).catch(error => {
          console.warn('Failed to save to history, but summary is still available:', error);
        });
        
        console.log('Summary generation and state update completed');
      } else {
        console.error('Generated summary is empty or null');
        throw new Error('Generated summary is empty');
      }
    } catch (err) {
      console.error('=== SUMMARY GENERATION ERROR ===');
      console.error('Error type:', typeof err);
      console.error('Error message:', err instanceof Error ? err.message : 'Unknown error');
      console.error('Full error:', err);
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate summary.';
      Alert.alert('Summary Error', errorMessage);
      
      // Set a fallback message
      setAiSummary('❌ Failed to generate summary. Please try again or check your internet connection.');
    } finally {
      setIsSummarizing(false);
      console.log('Summary generation process completed');
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Success', `${type} copied to clipboard!`);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const [speakingText, setSpeakingText] = React.useState<string | null>(null);

  const handleSpeakToggle = async (text: string, type: string, lang?: string) => {
    if (speakingText === text && isSpeaking) {
      Tts.stop();
      setIsSpeaking(false);
      setSpeakingText(null);
      return;
    }
    if (isSpeaking) {
      Tts.stop();
      setIsSpeaking(false);
      setSpeakingText(null);
    }
    if (!text || text.trim() === '') {
      Alert.alert('Notice', 'No text to speak');
      return;
    }
    setIsSpeaking(true);
    setSpeakingText(text);
    try {
      let speechLang = 'en-US';
      if (type === 'transcription') {
        // استخدم franc لتخمين اللغة
        const francCode = franc(text);
        speechLang = languageMap[francCode] || 'en-US';
      } else if (type === 'translation' || type === 'summary') {
        // استخدم اللغة المختارة من المنسدلة
        if (effectiveTargetLanguage === 'Arabic') speechLang = 'ar-SA';
        else if (effectiveTargetLanguage === 'French') speechLang = 'fr-FR';
        else if (effectiveTargetLanguage === 'Spanish') speechLang = 'es-ES';
        else speechLang = 'en-US';
      }
      Tts.setDefaultLanguage(speechLang);
      Tts.speak(text, {
        iosVoiceId: '',
        rate: 0.9,
        androidParams: {
          KEY_PARAM_PAN: 0,
          KEY_PARAM_VOLUME: 0.5,
          KEY_PARAM_STREAM: 'STREAM_MUSIC',
        },
      });
      Tts.addEventListener('tts-finish', () => {
        setIsSpeaking(false);
        setSpeakingText(null);
      });
      Tts.addEventListener('tts-cancel', () => {
        setIsSpeaking(false);
        setSpeakingText(null);
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to speak text');
      setIsSpeaking(false);
      setSpeakingText(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🤖 AI Summary</Text>
      <ScrollView style={[styles.section, { paddingBottom: 120 }]} contentContainerStyle={{flexGrow:1}} showsVerticalScrollIndicator={true} automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled">
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Original Transcription:</Text>
            {effectiveTranscription && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleCopy(effectiveTranscription, 'Transcription')}
                >
                  <Copy size={16} color="#2563EB" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleSpeakToggle(effectiveTranscription, 'transcription')}
                >
                  <Volume2 size={16} color={(isSpeaking && speakingText === effectiveTranscription) ? '#DC2626' : '#2563EB'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={styles.text}>
            {effectiveTranscription || 'No transcription available'}
          </Text>
        </View>
        
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Translation {effectiveTargetLanguage ? `(${effectiveTargetLanguage})` : ''}:</Text>
            {effectiveTranslation && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleCopy(effectiveTranslation, 'Translation')}
                >
                  <Copy size={16} color="#8B5CF6" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleSpeakToggle(effectiveTranslation, 'translation')}
                >
                  <Volume2 size={16} color={(isSpeaking && speakingText === effectiveTranslation) ? '#DC2626' : '#8B5CF6'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={styles.text}>
            {effectiveTranslation || 'No translation available'}
          </Text>
        </View>
        
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>AI Summary:</Text>
            {aiSummary && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleCopy(aiSummary, 'Summary')}
                >
                  <Copy size={16} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleSpeakToggle(aiSummary, 'summary')}
                >
                  <Volume2 size={16} color={(isSpeaking && speakingText === aiSummary) ? '#DC2626' : '#10B981'} />
                </TouchableOpacity>
                {aiSummary && (
                  <TouchableOpacity
                    style={[styles.actionButton, { marginLeft: 4 }]} 
                    onPress={() => saveSummaryToHistory(aiSummary)}
                    accessibilityLabel="Save summary to history"
                  >
                    <Save size={16} color={isSaved ? "#10B981" : "#2563EB"} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          <Text style={[styles.text, {paddingRight: 2, lineHeight: 26}]}> 
            {isSummarizing ? '🤖 Generating AI summary...' : (aiSummary || 'No summary available. Click "AI Summarize" to generate one.')}
          </Text>
        </View>
        
        {!effectiveTranscription && !effectiveTranslation && (
          <Text style={[styles.text, { color: '#EF4444', fontStyle: 'italic' }]}>No data available. Please go back and record some audio first.</Text>
        )}
      </ScrollView>
      
      <View style={styles.extraSmallActionsRow}>
        <TouchableOpacity style={styles.extraSmallActionButton} onPress={() => handleDownloadSummary('txt')}>
          <Text style={styles.extraSmallActionButtonText}>.TXT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.extraSmallActionButton} onPress={() => handleDownloadSummary('rtf')}>
          <Text style={styles.extraSmallActionButtonText}>.RTF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.extraSmallActionButton} onPress={() => handleDownloadSummary('doc')}>
          <Text style={styles.extraSmallActionButtonText}>.DOC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.extraSmallActionButton} onPress={() => router.back()}>
          <Text style={styles.extraSmallActionButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.extraSmallActionsRow}>
        <TouchableOpacity
          style={[styles.extraSmallActionButton, isSummarizing && { backgroundColor: '#9CA3AF' }]}
          onPress={handleGenerateSummary}
          disabled={isSummarizing || (!effectiveTranslation && !effectiveTranscription)}
        >
          <Text style={styles.extraSmallActionButtonText}>
            {isSummarizing ? '🤖 Summarizing...' : (aiSummary ? '🔄 Regenerate Summary' : '🤖 AI Summarize')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#374151',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#6366F1',
    fontSize: 18,
  },
  text: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
    lineHeight: 24,
  },
  extraSmallActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  extraSmallActionButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 3,
    alignItems: 'center',
    minWidth: 0,
    minHeight: 0,
  },
  extraSmallActionButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    padding: 6,
  },
}); 