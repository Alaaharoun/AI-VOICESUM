// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراً في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, PermissionsAndroid } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpeechService } from '@/services/speechService';
import { Audio } from 'expo-av';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

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
  const [isTranslating, setIsTranslating] = useState(false);
  const [partialTranscription, setPartialTranscription] = useState('');
  const [partialTranslation, setPartialTranslation] = useState('');
  const [lastPartialText, setLastPartialText] = useState('');
  const [lastFinalText, setLastFinalText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showStop, setShowStop] = useState(true);
  const [showSummarize, setShowSummarize] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const recordTimerRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sendChunkTimerRef = useRef<any>(null);
  const lastSentUriRef = useRef<string | null>(null);
  const audioChunksRef = useRef<Buffer[]>([]);

  // Start recording automatically on mount
  useEffect(() => {
    setShowStop(true);
    setShowSummarize(false);
    startRecording();
    return () => {
      stopRecording();
    };
  }, []);

  // Function to read audio file and send chunks
  const sendAudioChunks = async (recording: Audio.Recording, ws: WebSocket) => {
    try {
      // Get the current recording URI
      const uri = recording.getURI();
      if (!uri || uri === lastSentUriRef.current) {
        return; // No new audio data
      }
      
      console.log('Reading audio file from:', uri);
      
      // Read the audio file
      const audioData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Send the audio buffer directly to WebSocket
      if (ws.readyState === 1) {
        ws.send(audioBuffer);
        console.log('Sent audio chunk, size:', audioBuffer.length);
        lastSentUriRef.current = uri;
      }
      
    } catch (err) {
      console.error('Error sending audio chunks:', err);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      // إذا كان هناك تسجيل نشط، أوقفه وحرره
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (e) {
          // تجاهل الخطأ إذا لم يكن هناك تسجيل نشط فعلاً
        }
        setRecording(null);
      }
      setShowStop(true);
      setShowSummarize(false);
      setError(null);
      setIsRecording(true);
      setRecordTime('00:00:00');
      setRecordSecs(0);
      setAudioUri(null);
      setTranscription('');
      setTranslation('');
      setPartialTranscription('');
      setPartialTranslation('');
      setLastPartialText('');
      setLastFinalText('');
      audioChunksRef.current = [];
      lastSentUriRef.current = null;
      
      console.log('Starting recording process...');
      
      // Request microphone permission
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Permission to access microphone is required!');
          setIsRecording(false);
          return;
        }
        console.log('Microphone permission granted');
      }
      
      // Initialize audio recorder
      console.log('Creating expo-av Recording instance...');
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      console.log('Recording instance created:', newRecording);
      setRecording(newRecording);
      
      // افتح WebSocket
      console.log('Opening WebSocket connection...');
      const wsUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_WS_URL || 'wss://ai-voicesum.onrender.com/ws';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected successfully');
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
        
        // Timer for sending audio data every 3 seconds
        sendChunkTimerRef.current = setInterval(async () => {
          if (recording && isRecording && ws.readyState === 1) {
            try {
              // Get recording status to check if we have audio data
              const status = await recording.getStatusAsync();
              console.log('Recording status:', status);
              
              if (status.isRecording && status.durationMillis > 0) {
                // Send actual audio data chunks
                await sendAudioChunks(recording, ws);
              }
            } catch (err) {
              console.error('Error sending audio chunks:', err);
            }
          }
        }, 3000); // Send every 3 seconds
      };
      
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'partial') {
            // عرض النص الجزئي أثناء الكلام
            setPartialTranscription(data.text || '');
            setLastPartialText(data.text || '');
            
            // ترجمة فورية للنص الجزئي
            if (data.text && data.text !== lastPartialText) {
              setIsTranslating(true);
              try {
                const translated = await SpeechService.translateText(data.text, targetLanguageCode);
                setPartialTranslation(translated);
                console.log('Partial translation:', translated);
              } catch (translationError) {
                setPartialTranslation('');
                console.error('Partial translation error:', translationError);
              } finally {
                setIsTranslating(false);
              }
            }
          } else if (data.type === 'final') {
            // عرض النص النهائي
            setTranscription(data.text || '');
            setLastFinalText(data.text || '');
            
            // ترجمة النص النهائي
            if (data.text && data.text !== lastFinalText) {
              setIsTranslating(true);
              try {
                const translated = await SpeechService.translateText(data.text, targetLanguageCode);
                setTranslation(translated);
                console.log('Final translation:', translated);
              } catch (translationError) {
                setTranslation('');
                console.error('Final translation error:', translationError);
              } finally {
                setIsTranslating(false);
              }
            }
            
            // مسح النصوص الجزئية بعد النص النهائي
            setPartialTranscription('');
            setPartialTranslation('');
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      };
      
      ws.onerror = (e) => {
        let errorMessage = 'WebSocket error occurred.';
        errorMessage += '\nPossible causes: network issues, server unavailable, or invalid API keys.';
        setError(errorMessage);
        console.error('WebSocket error event:', e);
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        if (sendChunkTimerRef.current) {
          clearInterval(sendChunkTimerRef.current);
          sendChunkTimerRef.current = null;
        }
      };
      
    } catch (err: any) {
      console.error('Start recording error:', err);
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
        console.log('Recording stopped, file saved at:', uri);
        setAudioUri(uri);
        
        // Send final audio chunk if WebSocket is still open
        if (wsRef.current && wsRef.current.readyState === 1) {
          try {
            await sendAudioChunks(recording, wsRef.current);
            console.log('Final audio chunk sent');
          } catch (err) {
            console.error('Error sending final audio chunk:', err);
          }
        }
        
        setRecording(null);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    } catch (err: any) {
      setError('Failed to stop recording: ' + (err?.message || err));
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
        {partialTranscription && (
          <View style={styles.partialContainer}>
            <Text style={styles.partialLabel}>Live (Partial):</Text>
            <Text style={styles.partialText}>{partialTranscription}</Text>
          </View>
        )}
      </ScrollView>

      <Text style={styles.sectionHeader}>Live Translation ({targetLanguageName})</Text>
      <ScrollView style={styles.translationScroll} showsVerticalScrollIndicator={true}>
        <Text style={styles.translationText}>
          {translation || 'Translation will appear here...'}
        </Text>
        {partialTranslation && (
          <View style={styles.partialContainer}>
            <Text style={styles.partialLabel}>Live (Partial):</Text>
            <Text style={styles.partialText}>{partialTranslation}</Text>
          </View>
        )}
        {isTranslating && (
          <View style={styles.translatingIndicator}>
            <View style={styles.translatingDot} />
            <Text style={styles.translatingText}>Translating...</Text>
          </View>
        )}
      </ScrollView>

      {isRecording && (
        <View style={styles.streamingIndicator}>
          <View style={styles.streamingDot} />
          <Text style={styles.streamingText}>Streaming audio to server...</Text>
        </View>
      )}

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
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 8,
  },
  streamingText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  partialContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  partialLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  partialText: {
    fontSize: 14,
    color: '#78350F',
    fontStyle: 'italic',
  },
  translatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  translatingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginRight: 6,
  },
  translatingText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
  },
}); 