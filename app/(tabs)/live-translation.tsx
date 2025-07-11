// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل react-native-audio-recorder-player يجب أن يبقى محصوراً في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpeechService } from '@/services/speechService';

export default function LiveTranslationPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetLanguageCode = (params.targetLanguage as string) || 'ar';
  const targetLanguageName = (params.languageName as string) || 'العربية';
  
  // Recorder state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Transcription/translation state
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showStop, setShowStop] = useState(true);
  const [showSummarize, setShowSummarize] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const recordTimerRef = useRef<any>(null);
  const sendChunkTimerRef = useRef<any>(null);
  const lastSentUriRef = useRef<string | null>(null);

  // Start recording automatically on mount
  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
    };
  }, []);

  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      setIsRecording(true);
      setRecordTime('00:00:00');
      setRecordSecs(0);
      setAudioUri(null);
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access microphone is required!');
        setIsRecording(false);
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      // Timer for UI
      let seconds = 0;
      recordTimerRef.current = setInterval(() => {
        if (!isRecording) {
          if (recordTimerRef.current) clearInterval(recordTimerRef.current);
          return;
        }
        seconds++;
        setRecordSecs(seconds * 1000);
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        setRecordTime(`${mins}:${secs}:00`);
      }, 1000);
      // Timer for sending chunk every 2 seconds
      sendChunkTimerRef.current = setInterval(() => {
        if (rec && isRecording) {
          sendCurrentChunk(rec);
        }
      }, 2000);
    } catch (err: any) {
      setError('Failed to start recording: ' + (err?.message || err));
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (sendChunkTimerRef.current) {
        clearInterval(sendChunkTimerRef.current);
        sendChunkTimerRef.current = null;
      }
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri);
        setRecording(null);
        if (uri) {
          await sendCurrentChunk({ getURI: () => uri }); // أرسل chunk أخير
        }
      }
    } catch (err: any) {
      setError('Failed to stop recording: ' + (err?.message || err));
    }
  };

  // دالة إرسال chunk صوتي حالي
  const sendCurrentChunk = async (recObj: { getURI: () => string | null }) => {
    try {
      const uri = recObj.getURI();
      if (!uri || uri === lastSentUriRef.current) return; // لا تكرر الإرسال لنفس الملف
      lastSentUriRef.current = uri;
      // Read file as base64
      const response = await fetch('file://' + uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        if (!base64Audio) {
          setError('Failed to read audio file');
          return;
        }
        // Send to server
        const serverUrl = 'https://ai-voicesum.onrender.com/live-translate';
        const res = await fetch(serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64Audio,
            audioType: 'audio/mp3',
            targetLanguage: targetLanguageCode,
            sourceLanguage: undefined,
          }),
        });
        const data = await res.json();
        setTranscription(data.transcription || '');
        // ترجم النص باستخدام Google Translate من الكلاينت
        if (data.transcription) {
          try {
            const translated = await SpeechService.translateText(data.transcription, targetLanguageCode);
            setTranslation(translated);
          } catch (translationError) {
            setTranslation('');
            console.error('Translation error:', translationError);
          }
        } else {
          setTranslation('');
        }
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      setError('Failed to send audio: ' + (err?.message || err));
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleStop = async () => {
    setShowStop(false);
    setShowSummarize(true);
    await stopRecording();
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
        pathname: '/(tabs)/summary-view',
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
          <View style={[styles.statusIndicator, { backgroundColor: isRecording ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.statusText}>
            {isRecording ? `Recording... ${recordTime}` : 'Stopped'}
          </Text>
        </View>
        {isProcessing && (
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

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {showStop && (
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.stopButtonText}>Stop Recording</Text>
        </TouchableOpacity>
      )}
      {showSummarize && (
        <TouchableOpacity style={styles.summarizeButton} onPress={handleSummarizeAndNavigate} disabled={isSummarizing}>
          <Text style={styles.summarizeButtonText}>{isSummarizing ? 'Summarizing...' : 'AI Summary'}</Text>
        </TouchableOpacity>
      )}
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
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
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
  summarizeButton: {
    backgroundColor: '#6B7280',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  summarizeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 