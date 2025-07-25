import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Button, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DownloadHelper } from '@/utils/downloadHelper';
import { SpeechService } from '@/services/speechService';
import { Copy, Volume2, Save, Clipboard as ClipboardIcon } from 'lucide-react-native';
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
  const shouldAutoSummarize = typeof params.autoSummarize === 'string' && params.autoSummarize === 'true';
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
          // التحقق من العلامة التلقائية أو الشروط العادية
          if (shouldAutoSummarize || (!aiSummary && !summary)) {
            console.log('Auto-generating summary - shouldAutoSummarize:', shouldAutoSummarize, 'text length:', textToSummarize.trim().length);
            setTimeout(() => {
              handleGenerateSummary();
            }, 500); // Small delay to ensure UI is ready
          }
        } else if (shouldAutoSummarize) {
          console.log('Auto-summarize requested but text too short:', textToSummarize ? textToSummarize.trim().length : 0);
        }
    }
  }, [summary, transcription, translation, targetLanguage, shouldAutoSummarize, effectiveTranscription, effectiveTranslation]);

  React.useEffect(() => {
    setIsSaved(false);
  }, [aiSummary]);

  // حفظ البيانات في السياق عند استلامها من المعاملات
  React.useEffect(() => {
    if (effectiveTranscription && effectiveTranscription !== transcription) {
      console.log('Updating transcription in context from params');
      setTranscription(effectiveTranscription);
    }
    if (effectiveTranslation && effectiveTranslation !== translation) {
      console.log('Updating translation in context from params');
      setTranslation(effectiveTranslation);
    }
    if (effectiveTargetLanguage && effectiveTargetLanguage !== targetLanguage) {
      console.log('Updating target language in context from params');
      setTargetLanguage(effectiveTargetLanguage);
    }
  }, [effectiveTranscription, effectiveTranslation, effectiveTargetLanguage]);

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
      console.log('📝 [Summary] Saving summary to history...');
      
      // Check if we already have this exact content saved
      const { data: existingRecords, error: checkError } = await supabase
        .from('recordings')
        .select('id')
        .eq('user_id', user.id)
        .eq('transcription', effectiveTranscription || '')
        .eq('translation', effectiveTranslation || '')
        .eq('summary', summaryText)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking existing records:', checkError);
      }
      
      // Only save if we don't already have this exact content
      if (!existingRecords || existingRecords.length === 0) {
      const { error } = await supabase.from('recordings').insert([
        {
          user_id: user.id,
            transcription: effectiveTranscription || '',
            translation: effectiveTranslation || '',
          summary: summaryText,
          translationSummary: '',
            target_language: effectiveTargetLanguage || '',
            duration: 0, // Summary generation doesn't have duration
          created_at: new Date().toISOString(),
        }
      ]);
      
      if (error) {
          console.error('❌ [Summary] Supabase error:', error);
        throw error;
        }
        
        console.log('✅ [Summary] Summary saved to history successfully');
      } else {
        console.log('📄 [Summary] Content already exists in history, skipping save');
      }
      
      setIsSaved(true);
    } catch (e) {
      setIsSaved(false);
      console.warn('❌ [Summary] Failed to save summary to history:', e);
      // لا نعرض Alert هنا لتجنب إزعاج المستخدم
    }
  };

  const handleGenerateSummary = async () => {
    const textToSummarize = effectiveTranslation || effectiveTranscription;
    console.log('=== SUMMARY GENERATION START ===');
    console.log('effectiveTranslation:', effectiveTranslation ? effectiveTranslation.substring(0, 100) + '...' : 'null');
    console.log('effectiveTranscription:', effectiveTranscription ? effectiveTranscription.substring(0, 100) + '...' : 'null');
    console.log('textToSummarize:', textToSummarize ? textToSummarize.substring(0, 100) + '...' : 'null');
    console.log('textToSummarize length:', textToSummarize ? textToSummarize.trim().length : 0);
    
    if (!textToSummarize || textToSummarize.trim().length < 50) {
      console.log('Text too short for summary, length:', textToSummarize ? textToSummarize.trim().length : 0);
      Alert.alert('Notice', 'Text is too short to summarize. Please provide at least 50 characters.');
      return;
    }
    if (isSummarizing) {
      console.log('Already summarizing, skipping...');
      return; // تجنب التكرار
    }
    
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

  const handlePaste = async (type: string) => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        if (type === 'Transcription') {
          setTranscription(text);
        } else if (type === 'Translation') {
          setTranslation(text);
        }
        Alert.alert('Success', `${type} pasted from clipboard!`);
      } else {
        Alert.alert('Notice', 'Clipboard is empty or contains no text');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to paste from clipboard');
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
              <View style={styles.actionButtons}>
                {effectiveTranscription && (
                  <>
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
                  </>
                )}
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handlePaste('Transcription')}
                >
                  <ClipboardIcon size={16} color="#059669" />
                </TouchableOpacity>
              </View>
          </View>
          <Text style={styles.text}>
            {effectiveTranscription || 'No transcription available'}
          </Text>
        </View>
        
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Translation {effectiveTargetLanguage ? `(${effectiveTargetLanguage})` : ''}:</Text>
              <View style={styles.actionButtons}>
                {effectiveTranslation && (
                  <>
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
                  </>
                )}
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handlePaste('Translation')}
                >
                  <ClipboardIcon size={16} color="#059669" />
                </TouchableOpacity>
              </View>
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
                    onPress={async () => {
                      await saveSummaryToHistory(aiSummary);
                      if (isSaved) {
                        Alert.alert('Success', 'Summary saved to history!');
                      }
                    }}
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