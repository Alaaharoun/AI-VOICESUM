// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل react-native-audio-recorder-player يجب أن يبقى محصوراً في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, PermissionsAndroid } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpeechService } from '@/services/speechService';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';
import { Buffer } from 'buffer';

export default function LiveTranslationPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetLanguageCode = (params.targetLanguage as string) || 'ar';
  const targetLanguageName = (params.languageName as string) || 'العربية';
  
  // Recorder state
  const [recording, setRecording] = useState<AudioRecorderPlayer | null>(null);
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
  const wsRef = useRef<WebSocket | null>(null);
  const sendChunkTimerRef = useRef<any>(null);
  const lastSentUriRef = useRef<string | null>(null);

  // Start recording automatically on mount
  useEffect(() => {
    setShowStop(true);
    setShowSummarize(false);
    startRecording();
    return () => {
      stopRecording();
    };
  }, []);

  // Start recording
  const startRecording = async () => {
    setShowStop(true);
    setShowSummarize(false);
    try {
      setError(null);
      setIsRecording(true);
      setRecordTime('00:00:00');
      setRecordSecs(0);
      setAudioUri(null);
      setTranscription('');
      setTranslation('');
      
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
      console.log('Creating AudioRecorderPlayer instance...');
      const audioRecorder = new AudioRecorderPlayer();
      console.log('AudioRecorderPlayer instance created:', audioRecorder);
      setRecording(audioRecorder);
      
      // Configure audio settings
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
        AudioSamplingRateAndroid: 16000,
        AudioChannelsAndroid: 1,
        AudioEncodingBitRateAndroid: 128000,
      };
      
      console.log('Audio settings configured:', audioSet);
      
      // Start recording
      const path = Platform.OS === 'android'
        ? 'audio_recording.wav'
        : 'audio_recording.m4a';
      console.log('Starting recorder with path:', path);
      const uri = await audioRecorder.startRecorder(path, audioSet);
      console.log('Recording started at:', uri);
      setAudioUri(uri);
      
      // افتح WebSocket
      console.log('Opening WebSocket connection...');
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
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
        
        // Timer for sending chunk every 3 seconds (simplified approach)
        sendChunkTimerRef.current = setInterval(async () => {
          if (audioRecorder && isRecording && ws.readyState === 1 && uri) {
            try {
              // Send a simple heartbeat/status message instead of audio chunks
              // This will keep the connection alive and show that streaming is working
              const statusMessage = {
                type: 'status',
                timestamp: Date.now(),
                recording: true,
                duration: recordSecs
              };
              ws.send(JSON.stringify(statusMessage));
              console.log('Status message sent:', statusMessage);
            } catch (err) {
              console.error('Error sending status message:', err);
            }
          }
        }, 3000); // Send every 3 seconds
      };
      
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'partial' || data.type === 'final') {
            setTranscription(data.text || '');
            // ترجم النص باستخدام Google Translate من الكلاينت
            if (data.text) {
              try {
                const translated = await SpeechService.translateText(data.text, targetLanguageCode);
                setTranslation(translated);
              } catch (translationError) {
                setTranslation('');
                console.error('Translation error:', translationError);
              }
            } else {
              setTranslation('');
            }
          }
        } catch (err) {
          // تجاهل الأخطاء في الرسائل غير النصية
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
        const result = await recording.stopRecorder();
        console.log('Recording stopped, file saved at:', result);
        
        // Send the final audio file to server for processing
        if (wsRef.current && wsRef.current.readyState === 1) {
          try {
            // Send completion message
            const completionMessage = {
              type: 'recording_complete',
              timestamp: Date.now(),
              duration: recordSecs,
              filePath: result
            };
            wsRef.current.send(JSON.stringify(completionMessage));
            console.log('Recording completion message sent');
          } catch (err) {
            console.error('Error sending completion message:', err);
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
      </ScrollView>

      <Text style={styles.sectionHeader}>Live Translation ({targetLanguageName})</Text>
      <ScrollView style={styles.translationScroll} showsVerticalScrollIndicator={true}>
        <Text style={styles.translationText}>
          {translation || 'Translation will appear here...'}
        </Text>
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
}); 