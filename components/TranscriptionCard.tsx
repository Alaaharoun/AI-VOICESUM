import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { FileText, Sparkles, Languages, Download, FileDown, Bot, Zap, Volume2, Copy } from 'lucide-react-native';
import { DownloadHelper } from '@/utils/downloadHelper';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import * as IntentLauncher from 'expo-intent-launcher';

interface TranscriptionCardProps {
  transcription: string;
  summary?: string;
  translation?: string;
  translationSummary?: string;
  targetLanguage?: { name: string; flag: string } | null;
  isProcessing?: boolean;
  onGenerateSummary?: () => void;
  onGenerateTranslationSummary?: () => void;
  isRealTime?: boolean;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  realTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  realTimeBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#8B5CF6',
    marginLeft: 2,
  },
  downloadButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  transcriptionText: {
    fontSize: 17,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 26,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  realTimeTranscriptionText: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  summaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  summaryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
    marginLeft: 6,
  },
  summaryText: {
    color: '#374151',
    fontSize: 17,
    fontFamily: 'Inter-Regular',
    lineHeight: 26,
    fontStyle: 'italic',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  translationText: {
    fontSize: 17,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 26,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  realTimeTranslationText: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  translationScroll: {
    maxHeight: 350,
    marginBottom: 8,
  },
  speakButton: {
    marginLeft: 0,
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 2,
  },
  copyButton: {
    marginLeft: 0,
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 2,
  },
  summaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 4,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  smallActionButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    minWidth: 0,
  },
  smallActionButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});

export function TranscriptionCard({ 
  transcription, 
  summary, 
  translation,
  translationSummary,
  targetLanguage,
  isProcessing = false,
  onGenerateSummary,
  onGenerateTranslationSummary,
  isRealTime = false
}: TranscriptionCardProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const handleSpeakToggle = async (text: string, lang?: string) => {
    if (!text) return;
    if (isSpeaking || speakingRef.current) {
      Speech.stop();
      setIsSpeaking(false);
      speakingRef.current = false;
      return;
    }
    let language = lang || 'en';
    const voices = await Speech.getAvailableVoicesAsync();
    const hasVoice = voices.some(v => v.language.startsWith(language));
    if (!hasVoice) {
      Alert.alert(
        'Not Supported',
        `Sorry, this language (${language}) is not supported for speech on your device. Please check your system TTS settings.`,
        [
          { text: 'OK', style: 'cancel' },
          // On Android, open TTS settings directly using expo-intent-launcher
          ...(Platform.OS === 'android' ? [
            { text: 'Go to TTS Settings', onPress: () => {
                try {
                  IntentLauncher.startActivityAsync('android.settings.TTS_SETTINGS');
                } catch (e) {
                  // fallback: open app settings if TTS intent fails
                  Linking.openSettings();
                }
              }
            }
          ] : [])
        ]
      );
      return;
    }
    setIsSpeaking(true);
    speakingRef.current = true;
    Speech.speak(text, {
      language,
      onDone: () => {
        setIsSpeaking(false);
        speakingRef.current = false;
      },
      onStopped: () => {
        setIsSpeaking(false);
        speakingRef.current = false;
      }
    });
  };

  const handleDownloadTranscription = (format: 'txt' | 'rtf' | 'doc') => {
    const filename = DownloadHelper.generateFilename('transcription');
    DownloadHelper.downloadText(transcription, filename, format);
  };

  const handleDownloadSummary = (format: 'txt' | 'rtf' | 'doc') => {
    console.log('handleDownloadSummary called', { summary, format });
    if (!summary || summary.trim() === '') {
      Alert.alert('Notice', 'No summary available for download or the summary is empty.');
      return;
    }
    const filename = DownloadHelper.generateFilename('summary');
    DownloadHelper.downloadText(summary, filename, format);
  };

  const handleDownloadTranslation = (format: 'txt' | 'rtf' | 'doc') => {
    if (!translation) return;
    const filename = DownloadHelper.generateFilename('translation');
    DownloadHelper.downloadText(translation, filename, format);
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Text copied to clipboard!');
  };

  const showDownloadMenu = (type: 'transcription' | 'summary' | 'translation') => {
    Alert.alert(
      'Download Format',
      'Choose the format for your download:',
      [
        {
          text: 'Text (.txt)',
          onPress: () => {
            if (type === 'transcription') handleDownloadTranscription('txt');
            else if (type === 'summary') handleDownloadSummary('txt');
            else if (type === 'translation') handleDownloadTranslation('txt');
          }
        },
        {
          text: 'Rich Text (.rtf)',
          onPress: () => {
            if (type === 'transcription') handleDownloadTranscription('rtf');
            else if (type === 'summary') handleDownloadSummary('rtf');
            else if (type === 'translation') handleDownloadTranslation('rtf');
          }
        },
        {
          text: 'Word Document (.html)',
          onPress: () => {
            if (type === 'transcription') handleDownloadTranscription('doc');
            else if (type === 'summary') handleDownloadSummary('doc');
            else if (type === 'translation') handleDownloadTranslation('doc');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  if (summary && !isProcessing) {
    console.log('Rendering summary:', summary);
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Transcription Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <FileText size={20} color="#374151" />
              <Text style={styles.sectionTitle}>Original Transcription</Text>
              {isRealTime && (
                <View style={styles.realTimeBadge}>
                  <Zap size={12} color="#8B5CF6" />
                  <Text style={styles.realTimeBadgeText}>LIVE</Text>
                </View>
              )}
            </View>
            {transcription && !isProcessing && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => showDownloadMenu('transcription')}
              >
                <Download size={18} color="#2563EB" />
              </TouchableOpacity>
            )}
            {transcription && !isProcessing && (
              <>
                <TouchableOpacity style={styles.speakButton} onPress={() => handleSpeakToggle(transcription)}>
                  <Volume2 size={18} color={isSpeaking ? '#DC2626' : '#2563EB'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(transcription)}>
                  <Copy size={18} color="#374151" />
                </TouchableOpacity>
              </>
            )}
          </View>
          {isProcessing && !transcription ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Transcribing audio...</Text>
            </View>
          ) : (
            <View>
              <Text style={[
                styles.transcriptionText,
                isRealTime && styles.realTimeTranscriptionText
              ]}>
                {transcription}
              </Text>
              {transcription && !summary && !isProcessing && onGenerateSummary && !isRealTime && (
                <TouchableOpacity
                  style={styles.summaryButton}
                  onPress={onGenerateSummary}
                >
                  <Bot size={16} color="#10B981" />
                  <Text style={styles.summaryButtonText}>Generate AI Summary</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Summary Section */}
        {(summary || (isProcessing && transcription && !isRealTime)) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Sparkles size={20} color="#10B981" />
                <Text style={[styles.sectionTitle, { color: '#10B981' }]}>AI Summary (Original)</Text>
              </View>
              {summary && !isProcessing && (
                <View style={styles.summaryActionsRow}>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => showDownloadMenu('summary')}
                >
                    <FileDown size={16} color="#10B981" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.speakButton} onPress={() => handleSpeakToggle(summary || '')}>
                    <Volume2 size={16} color={isSpeaking ? '#DC2626' : '#10B981'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(summary || '')}>
                    <Copy size={16} color="#374151" />
                </TouchableOpacity>
                </View>
              )}
            </View>
            {isProcessing && !summary ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Generating summary...</Text>
              </View>
            ) : (
              <>
              <Text style={styles.summaryText}>{summary}</Text>
                <View style={styles.summaryActionsRow}>
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() => showDownloadMenu('summary')}
                  >
                    <FileDown size={16} color="#10B981" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.speakButton} onPress={() => handleSpeakToggle(summary || '')}>
                    <Volume2 size={16} color={isSpeaking ? '#DC2626' : '#10B981'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(summary || '')}>
                    <Copy size={16} color="#374151" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Translation Section */}
        {(translation || (isProcessing && targetLanguage)) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Languages size={20} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: '#8B5CF6' }]}>Translation {targetLanguage && `(${targetLanguage.flag} ${targetLanguage.name})`}</Text>
                {isRealTime && translation && (
                  <View style={styles.realTimeBadge}>
                    <Zap size={12} color="#8B5CF6" />
                    <Text style={styles.realTimeBadgeText}>LIVE</Text>
                  </View>
                )}
              </View>
              {translation && !isProcessing && (
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => showDownloadMenu('translation')}
                >
                  <Download size={18} color="#8B5CF6" />
                </TouchableOpacity>
              )}
              {translation && !isProcessing && (
                <>
                  <TouchableOpacity style={styles.speakButton} onPress={() => handleSpeakToggle(translation, targetLanguage?.name === 'Arabic' ? 'ar' : undefined)}>
                    <Volume2 size={18} color={isSpeaking ? '#DC2626' : '#8B5CF6'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(translation)}>
                    <Copy size={18} color="#374151" />
                  </TouchableOpacity>
                </>
              )}
            </View>
            {isProcessing && !translation ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>
                  {isRealTime ? 'Translating in real-time...' : 'Translating text...'}
                </Text>
              </View>
            ) : (
              <View>
                <ScrollView style={styles.translationScroll} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  <Text style={[
                    styles.translationText,
                    isRealTime && styles.realTimeTranslationText
                  ]}>
                    {translation}
                  </Text>
                </ScrollView>
                {translation && !isProcessing && onGenerateTranslationSummary && !isRealTime && (
                  <TouchableOpacity
                    style={styles.summaryButton}
                    onPress={onGenerateTranslationSummary}
                  >
                    <Bot size={16} color="#8B5CF6" />
                    <Text style={[styles.summaryButtonText, { color: '#8B5CF6' }]}>Generate AI Summary (Translated)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Translation Summary Section */}
        {(translationSummary || (isProcessing && translation && onGenerateTranslationSummary)) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Sparkles size={20} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: '#8B5CF6' }]}>AI Summary (Translated)</Text>
              </View>
              {translationSummary && !isProcessing && (
                <View style={styles.summaryActionsRow}>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => showDownloadMenu('summary')}
                >
                    <FileDown size={16} color="#8B5CF6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.speakButton} onPress={() => handleSpeakToggle(translationSummary || '', targetLanguage?.name === 'Arabic' ? 'ar' : undefined)}>
                    <Volume2 size={16} color={isSpeaking ? '#DC2626' : '#8B5CF6'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(translationSummary || '')}>
                    <Copy size={16} color="#374151" />
                </TouchableOpacity>
                </View>
              )}
            </View>
            {isProcessing && !translationSummary ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Generating translation summary...</Text>
              </View>
            ) : (
              <>
              <Text style={styles.summaryText}>{translationSummary}</Text>
                <View style={styles.summaryActionsRow}>
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() => showDownloadMenu('summary')}
                  >
                    <FileDown size={16} color="#8B5CF6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.speakButton} onPress={() => handleSpeakToggle(translationSummary || '', targetLanguage?.name === 'Arabic' ? 'ar' : undefined)}>
                    <Volume2 size={16} color={isSpeaking ? '#DC2626' : '#8B5CF6'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(translationSummary || '')}>
                    <Copy size={16} color="#374151" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Bottom Actions (if summary exists) */}
        {summary && !isProcessing && (
          <View style={styles.bottomActionsRow}>
            <TouchableOpacity style={styles.smallActionButton} onPress={() => showDownloadMenu('summary')}>
              <Text style={styles.smallActionButtonText}>Download (.TXT)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallActionButton} onPress={() => showDownloadMenu('summary')}>
              <Text style={styles.smallActionButtonText}>Download (.RTF)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallActionButton} onPress={() => showDownloadMenu('summary')}>
              <Text style={styles.smallActionButtonText}>Download (.DOC)</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Back to Home button if needed */}
        {onGenerateSummary && (
          <View style={styles.bottomActionsRow}>
            <TouchableOpacity style={styles.smallActionButton} onPress={onGenerateSummary}>
              <Text style={styles.smallActionButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}