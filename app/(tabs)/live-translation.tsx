import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { useHybridAudioRecorder } from '@/hooks/useHybridAudioRecorder';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpeechService } from '@/services/speechService';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export default function LiveTranslationPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Get target language from params, fallback to Arabic if not provided
  const targetLanguageCode = (params.targetLanguage as string) || 'ar';
  const targetLanguageName = (params.languageName as string) || 'العربية';
  
  const {
    isRecording,
    recordTime,
    startRecording,
    stopRecording,
    error: recorderError,
    resetRecording,
    usingNativeRecorder,
    showSettingsButton
  } = useHybridAudioRecorder();

  const {
    isRecording: audioRecorderIsRecording,
    isProcessing: audioRecorderIsProcessing,
    startRecording: audioRecorderStartRecording,
    stopRecording: audioRecorderStopRecording,
    processAudio,
    generateSummary,
    startRealTimeTranscription,
    stopRealTimeTranscription,
  } = useAudioRecorder();

  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const processingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showStop, setShowStop] = useState(true);
  const [showSummarize, setShowSummarize] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    console.log('[LiveTranslation] Starting real-time transcription...');
    
    // Start real-time transcription with external server
    startRealTimeTranscription(
      (text) => { 
        if (isMounted) {
          console.log('[LiveTranslation] Transcription update:', text);
          setTranscription(text); 
        }
      },
      (translated) => { 
        if (isMounted) {
          console.log('[LiveTranslation] Translation update:', translated);
          setTranslation(translated); 
        }
      },
      targetLanguageCode,
      undefined, // sourceLanguage (add if available)
      true // useLiveTranslationServer
    ).catch((err: Error) => {
      console.error('Failed to start real-time transcription (live translation):', err);
      const errorMsg = err.message ? `Recording failed: ${err.message}` : 'Failed to start recording.';
      setError(errorMsg);
      Alert.alert('Recording Error', errorMsg);
    });
    return () => {
      isMounted = false;
      stopRealTimeTranscription();
    };
  }, [targetLanguageCode]);

  // Check if recording started successfully
  useEffect(() => {
    if (!audioRecorderIsRecording && !error) {
      // If recording didn't start and there's no error, show a message
      setTimeout(() => {
        if (!audioRecorderIsRecording) {
          setError('Recording failed to start. Please try again.');
        }
      }, 2000);
    }
  }, [audioRecorderIsRecording, error]);

  const handleBack = () => {
    router.back();
  };

  const handleStop = async () => {
    setShowStop(false);
    setShowSummarize(true);
    await stopRealTimeTranscription();
  };

  const handleSummarizeAndNavigate = async () => {
    setIsSummarizing(true);
    try {
      const textToSummarize = translation || transcription;
      let summary = '';
      if (textToSummarize && textToSummarize.trim().length >= 50) {
        summary = await SpeechService.summarizeText(textToSummarize, targetLanguageCode);
      }
      router.push({
        pathname: '/summary-view',
        params: {
          transcription,
          translation,
          summary,
          targetLanguage: targetLanguageName,
        },
      });
    } catch (err) {
      alert('Failed to summarize: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.header}>Live Translation</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, { backgroundColor: audioRecorderIsRecording ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.statusText}>
            {audioRecorderIsRecording ? `Recording... ${recordTime}` : 'Stopped'}
          </Text>
          <Text style={styles.recorderType}>
            {usingNativeRecorder ? '(Native)' : '(Expo)'}
          </Text>
        </View>
        {audioRecorderIsProcessing && (
          <Text style={styles.processingText}>Processing audio...</Text>
        )}
      </View>

      <Text style={styles.sectionHeader}>Live Transcription</Text>
      <ScrollView style={styles.transcriptionScroll} showsVerticalScrollIndicator={true}>
        <Text style={styles.transcriptionText}>
          {transcription || 'Speak to see live transcription...'}
        </Text>
      </ScrollView>

      <Text style={styles.sectionHeader}>Live Translation ({targetLanguageName})</Text>
      <ScrollView style={styles.translationScroll} showsVerticalScrollIndicator={true}>
        <Text style={styles.translationText}>
          {translation || 'Translation will appear here...'}
        </Text>
      </ScrollView>

      {(error || recorderError) && (
        <>
          <Text style={styles.errorText}>{error || recorderError}</Text>
          {showSettingsButton && (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => Linking.openSettings()}
              accessibilityLabel="Open app settings"
              accessibilityRole="button"
            >
              <Text style={styles.settingsButtonText}>Open App Settings</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={styles.buttonContainer}>
        {showStop && (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <Text style={styles.stopButtonText}>إيقاف</Text>
          </TouchableOpacity>
        )}
        {showSummarize && (
          <TouchableOpacity
            style={[styles.stopButton, isSummarizing && { backgroundColor: '#9CA3AF' }]}
            onPress={handleSummarizeAndNavigate}
            disabled={isSummarizing}
          >
            <Text style={styles.stopButtonText}>{isSummarizing ? 'جاري التلخيص...' : 'AI Summarize'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Back</Text>
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
    justifyContent: 'flex-start',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#374151',
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  recorderType: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  processingText: {
    fontSize: 12,
    color: '#059669',
    marginTop: 4,
    fontStyle: 'italic',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#374151',
  },
  transcriptionScroll: {
    backgroundColor: '#fffbe6',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    maxHeight: 180,
    marginBottom: 16,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  translationScroll: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    maxHeight: 220,
    marginBottom: 16,
  },
  translationText: {
    fontSize: 16,
    color: '#1F2937',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  backButton: {
    backgroundColor: '#6B7280',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  settingsButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: '#6B7280',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  stopButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 