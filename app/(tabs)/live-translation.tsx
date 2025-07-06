import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useRouter } from 'expo-router';

export default function LiveTranslationPage() {
  const router = useRouter();
  const {
    stopRealTimeTranscription,
    isRecording,
    isProcessing,
    startRealTimeTranscription
  } = useAudioRecorder();

  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Start real-time transcription on mount
    startRealTimeTranscription(
      (t) => setTranscription(t),
      (tr) => setTranslation(tr),
      undefined // TODO: pass target language if needed
    ).catch((err) => {
      setError(err.message || 'Failed to start real-time transcription.');
    });
    return () => {
      stopRealTimeTranscription();
    };
  }, []);

  const handleStop = async () => {
    await stopRealTimeTranscription();
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Live Transcription</Text>
      <ScrollView style={styles.transcriptionScroll} showsVerticalScrollIndicator={true}>
        <Text style={styles.transcriptionText}>{transcription || 'Speak to see live transcription...'}</Text>
      </ScrollView>
      <Text style={styles.header}>Live Translation</Text>
      <ScrollView style={styles.translationScroll} showsVerticalScrollIndicator={true}>
        <Text style={styles.translationText}>{translation || 'Translation will appear here...'}</Text>
      </ScrollView>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
        <Text style={styles.stopButtonText}>Stop</Text>
      </TouchableOpacity>
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
  stopButton: {
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  stopButtonText: {
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
}); 