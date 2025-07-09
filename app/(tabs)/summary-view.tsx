import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Button, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DownloadHelper } from '@/utils/downloadHelper';
import { SpeechService } from '@/services/speechService';

export default function SummaryView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const summary = params.summary as string || '';
  const transcription = params.transcription as string || '';
  const translation = params.translation as string || '';
  const targetLanguage = params.targetLanguage as string || '';
  const [aiSummary, setAiSummary] = React.useState(summary);
  const [isSummarizing, setIsSummarizing] = React.useState(false);

  const handleDownloadSummary = (format: 'txt' | 'rtf' | 'doc') => {
    if (!summary || summary.trim() === '') {
      Alert.alert('Notice', 'No summary available for download or the summary is empty.');
      return;
    }
    const filename = DownloadHelper.generateFilename('summary');
    DownloadHelper.downloadText(summary, filename, format);
  };

  const handleGenerateSummary = async () => {
    const textToSummarize = translation || transcription;
    if (!textToSummarize || textToSummarize.trim().length < 50) {
      Alert.alert('Notice', 'Text is too short to summarize.');
      return;
    }
    setIsSummarizing(true);
    try {
      const result = await SpeechService.summarizeText(textToSummarize, targetLanguage);
      setAiSummary(result);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>AI Summary</Text>
      <ScrollView style={[styles.section, { paddingBottom: 120 }]}>
        <Text style={styles.sectionTitle}>Original Transcription:</Text>
        <Text style={styles.text}>{transcription + '\n\n'}</Text>
        <Text style={styles.sectionTitle}>Translation {targetLanguage ? `(${targetLanguage})` : ''}:</Text>
        <Text style={styles.text}>{translation + '\n\n'}</Text>
        <Text style={styles.sectionTitle}>AI Summary:</Text>
        <Text style={styles.text}>{aiSummary + '\n\n'}</Text>
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
          <Text style={styles.extraSmallActionButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.extraSmallActionsRow}>
        <TouchableOpacity
          style={[styles.extraSmallActionButton, isSummarizing && { backgroundColor: '#9CA3AF' }]}
          onPress={handleGenerateSummary}
          disabled={isSummarizing || (!translation && !transcription)}
        >
          <Text style={styles.extraSmallActionButtonText}>
            {isSummarizing ? 'Summarizing...' : 'AI Summarize'}
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
    padding: 24,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#374151',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    minHeight: 200,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
    color: '#6366F1',
  },
  text: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  extraSmallActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
    gap: 4,
  },
  extraSmallActionButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 6,
    paddingVertical: 6,
    marginHorizontal: 2,
    alignItems: 'center',
    minWidth: 0,
    minHeight: 0,
  },
  extraSmallActionButtonText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
}); 