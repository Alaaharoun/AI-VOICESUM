import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { FileText, Sparkles, Languages, Download, FileDown, Bot, Zap } from 'lucide-react-native';
import { DownloadHelper } from '@/utils/downloadHelper';

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
  if (!transcription && !isProcessing) {
    return null;
  }

  const handleDownloadTranscription = (format: 'txt' | 'rtf' | 'doc') => {
    const filename = DownloadHelper.generateFilename('transcription');
    DownloadHelper.downloadText(transcription, filename, format);
  };

  const handleDownloadSummary = (format: 'txt' | 'rtf' | 'doc') => {
    if (!summary) return;
    const filename = DownloadHelper.generateFilename('summary');
    DownloadHelper.downloadText(summary, filename, format);
  };

  const handleDownloadTranslation = (format: 'txt' | 'rtf' | 'doc') => {
    if (!translation) return;
    const filename = DownloadHelper.generateFilename('translation');
    DownloadHelper.downloadText(translation, filename, format);
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
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => showDownloadMenu('summary')}
                >
                  <FileDown size={18} color="#10B981" />
                </TouchableOpacity>
              )}
            </View>
            {isProcessing && !summary ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Generating summary...</Text>
              </View>
            ) : (
              <Text style={styles.summaryText}>{summary}</Text>
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
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => showDownloadMenu('summary')}
                >
                  <FileDown size={18} color="#8B5CF6" />
                </TouchableOpacity>
              )}
            </View>
            {isProcessing && !translationSummary ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Generating translation summary...</Text>
              </View>
            ) : (
              <Text style={styles.summaryText}>{translationSummary}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: 600,
  },
  scrollView: {
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 20,
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
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
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
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
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
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 24,
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
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  translationText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 24,
  },
  realTimeTranslationText: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  translationScroll: {
    maxHeight: 180,
    marginBottom: 8,
  },
});