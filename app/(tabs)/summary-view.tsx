import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Button, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DownloadHelper } from '@/utils/downloadHelper';
import { SpeechService } from '@/services/speechService';
import { Copy, Volume2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';

export default function SummaryView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const summary = params.summary as string || '';
  const transcription = params.transcription as string || '';
  const translation = params.translation as string || '';
  const targetLanguage = params.targetLanguage as string || '';
  const [aiSummary, setAiSummary] = React.useState(summary);
  const [isSummarizing, setIsSummarizing] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  React.useEffect(() => {
    console.log('SummaryView - Received params:', {
      summary: summary ? summary.substring(0, 50) + '...' : 'empty',
      transcription: transcription ? transcription.substring(0, 50) + '...' : 'empty',
      translation: translation ? translation.substring(0, 50) + '...' : 'empty',
      targetLanguage,
    });
    
    // إنشاء تلخيص تلقائياً إذا لم يكن موجوداً وكان هناك نص للتلخيص
    if (!aiSummary && !isSummarizing && (translation || transcription)) {
      const textToSummarize = translation || transcription;
      if (textToSummarize && textToSummarize.trim().length >= 50) {
        handleGenerateSummary();
      }
    }
  }, [summary, transcription, translation, targetLanguage]);

  const handleDownloadSummary = (format: 'txt' | 'rtf' | 'doc') => {
    const textToDownload = aiSummary || summary;
    if (!textToDownload || textToDownload.trim() === '') {
      Alert.alert('Notice', 'No summary available for download or the summary is empty.');
      return;
    }
    const filename = DownloadHelper.generateFilename('summary');
    DownloadHelper.downloadText(textToDownload, filename, format);
  };

  const handleGenerateSummary = async () => {
    const textToSummarize = translation || transcription;
    if (!textToSummarize || textToSummarize.trim().length < 50) {
      Alert.alert('Notice', 'Text is too short to summarize. Please provide at least 50 characters.');
      return;
    }
    if (isSummarizing) return; // تجنب التكرار
    
    setIsSummarizing(true);
    try {
      console.log('Generating summary for:', textToSummarize.substring(0, 100) + '...');
      const result = await SpeechService.summarizeText(textToSummarize, targetLanguage);
      console.log('Summary generated:', result ? result.substring(0, 100) + '...' : 'empty');
      setAiSummary(result);
    } catch (err) {
      console.error('Summary generation error:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setIsSummarizing(false);
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
    // إذا كان نفس النص يتحدث حالياً، أوقفه
    if (speakingText === text && isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      setSpeakingText(null);
      return;
    }

    // إذا كان نص آخر يتحدث، أوقفه أولاً
    if (isSpeaking) {
      Speech.stop();
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
      // تحديد اللغة بناءً على نوع النص
      let speechLang = 'en';
      if (type === 'translation' && targetLanguage === 'Arabic') {
        speechLang = 'ar';
      } else if (type === 'transcription') {
        // للنص الأساسي، نحاول تحديد اللغة من النص نفسه
        const arabicRegex = /[\u0600-\u06FF]/;
        speechLang = arabicRegex.test(text) ? 'ar' : 'en';
      }

      console.log(`Speaking ${type} in language: ${speechLang}`);
      
      await Speech.speak(text, {
        language: speechLang,
        rate: 0.9,
        pitch: 1.0,
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingText(null);
        },
        onError: (error) => {
          console.error('Speech error:', error);
          setIsSpeaking(false);
          setSpeakingText(null);
        }
      });
    } catch (err) {
      console.error('Speech error:', err);
      Alert.alert('Error', 'Failed to speak text');
      setIsSpeaking(false);
      setSpeakingText(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🤖 AI Summary</Text>
      <ScrollView style={[styles.section, { paddingBottom: 120 }]}>
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Original Transcription:</Text>
            {transcription && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleCopy(transcription, 'Transcription')}
                >
                  <Copy size={16} color="#2563EB" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleSpeakToggle(transcription, 'transcription')}
                >
                  <Volume2 size={16} color={(isSpeaking && speakingText === transcription) ? '#DC2626' : '#2563EB'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={styles.text}>
            {transcription || 'No transcription available'}
          </Text>
        </View>
        
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Translation {targetLanguage ? `(${targetLanguage})` : ''}:</Text>
            {translation && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleCopy(translation, 'Translation')}
                >
                  <Copy size={16} color="#8B5CF6" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleSpeakToggle(translation, 'translation')}
                >
                  <Volume2 size={16} color={(isSpeaking && speakingText === translation) ? '#DC2626' : '#8B5CF6'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={styles.text}>
            {translation || 'No translation available'}
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
              </View>
            )}
          </View>
          <Text style={styles.text}>
            {isSummarizing ? 'Generating summary...' : (aiSummary || 'No summary available. Click "AI Summarize" to generate one.')}
          </Text>
        </View>
        
        {!transcription && !translation && (
          <Text style={[styles.text, { color: '#EF4444', fontStyle: 'italic' }]}>
            No data available. Please go back and record some audio first.
          </Text>
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
          disabled={isSummarizing || (!translation && !transcription)}
        >
          <Text style={styles.extraSmallActionButtonText}>
            {isSummarizing ? 'Summarizing...' : (aiSummary ? 'Regenerate Summary' : 'AI Summarize')}
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