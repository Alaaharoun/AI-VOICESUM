// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراً في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, PermissionsAndroid, Clipboard, Alert } from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Buffer } from 'buffer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpeechService } from '@/services/speechService';

// نوع العنصر في مصفوفة النصوص النهائية
type TranscriptItem = { text: string; translation: string };

export default function LiveTranslationStreaming() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [partialTranslation, setPartialTranslation] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<TranscriptItem[]>([]); // [{text, translation}]
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetLanguage = typeof params.targetLanguage === 'string' && params.targetLanguage.length > 0 ? params.targetLanguage : 'ar';

  // إعداد خيارات التسجيل
  const audioOptions = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    wavFile: '',
  };

  // طلب إذن المايك (Android)
  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone for live translation.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // ترجمة النص باستخدام SpeechService
  const translateText = async (text: string) => {
    try {
      if (!text || !targetLanguage) return text;
      return await SpeechService.translateText(text, targetLanguage);
    } catch (err) {
      return text;
    }
  };

  const startStreaming = async () => {
    setError(null);
    setPartialText('');
    setPartialTranslation('');
    setFinalTranscripts([]);
    setShowSummary(false);

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      setError('Microphone permission is required');
      return;
    }

    AudioRecord.init(audioOptions);

    // Open WebSocket
    const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsRecording(true);
      AudioRecord.on('data', data => {
        const chunk = Buffer.from(data, 'base64');
        if (ws.readyState === 1) {
          ws.send(chunk);
        }
      });
      AudioRecord.start();
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'partial') {
          setPartialText(msg.text || '');
          // ترجم النص الجزئي مؤقتاً
          setPartialTranslation(await translateText(msg.text || ''));
        } else if (msg.type === 'final') {
          // أضف النص النهائي إلى القائمة مع ترجمته
          const translation = await translateText(msg.text || '');
          setFinalTranscripts(prev => [...prev, { text: msg.text || '', translation }]);
          setPartialText('');
          setPartialTranslation('');
        } else if (msg.type === 'error') {
          setError(msg.error || 'A server error occurred');
        }
      } catch (e) {
        setError('Error processing server response');
      }
    };

    ws.onerror = (e) => {
      setError('Connection error with server');
      setIsRecording(false);
      AudioRecord.stop();
    };

    ws.onclose = () => {
      setIsRecording(false);
      AudioRecord.stop();
      setShowSummary(true);
    };
  };

  const stopStreaming = () => {
    setIsRecording(false);
    AudioRecord.stop();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setShowSummary(true);
  };

  // نسخ النص
  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Text copied to clipboard');
  };

  // الانتقال لصفحة التلخيص
  const handleAISummary = () => {
    // مرر النصوص الأصلية والمترجمة للصفحة الجديدة
    router.push({
      pathname: '/(tabs)/summary-view',
      params: {
        transcription: finalTranscripts.map(t => t.text).join('\n'),
        translation: finalTranscripts.map(t => t.translation).join('\n'),
        // يمكن تمرير بيانات إضافية إذا لزم
      },
    });
  };

  // Scroll refs for auto-scroll
  const originalScrollRef = useRef<ScrollView>(null);
  const translationScrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new text is added
  useEffect(() => {
    if (originalScrollRef.current) {
      originalScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [finalTranscripts.length, partialText]);
  useEffect(() => {
    if (translationScrollRef.current) {
      translationScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [finalTranscripts.length, partialTranslation]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🎙️ Live Voice Translation (Streaming)</Text>
      <View style={styles.columnsContainer}>
        {/* Original Texts */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Original</Text>
          <ScrollView style={styles.scrollView} ref={originalScrollRef}>
            {finalTranscripts.map((item, idx) => (
              <TouchableOpacity key={idx} onLongPress={() => copyToClipboard(item.text)}>
                <View style={styles.textCard}>
                  <Text style={styles.text}>{item.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {partialText ? (
              <View style={styles.partialCard}>
                <Text style={styles.partialText}>Partial: {partialText}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
        {/* Translations */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Translation</Text>
          <ScrollView style={styles.scrollView} ref={translationScrollRef}>
            {targetLanguage ? (
              <>
                {finalTranscripts.map((item, idx) => (
                  <TouchableOpacity key={idx} onLongPress={() => copyToClipboard(item.translation)}>
                    <View style={styles.textCard}>
                      <Text style={styles.text}>{item.translation}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {partialTranslation ? (
                  <View style={styles.partialCard}>
                    <Text style={styles.partialText}>Partial: {partialTranslation}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={{flex:1, justifyContent:'center', alignItems:'center', marginTop:24}}>
                <Text style={{color:'#DC2626', fontSize:15, textAlign:'center'}}>
                  No target language selected. Please choose a language from the main page.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, isRecording ? styles.buttonStop : styles.buttonStart]}
        onPress={isRecording ? stopStreaming : startStreaming}
      >
        <Text style={styles.buttonText}>{isRecording ? 'Stop Streaming' : 'Start Live Streaming'}</Text>
      </TouchableOpacity>
      {showSummary && finalTranscripts.length > 0 && (
        <TouchableOpacity style={styles.summaryButton} onPress={handleAISummary} disabled={isSummarizing}>
          <Text style={styles.summaryButtonText}>{isSummarizing ? 'Summarizing...' : 'AI Summary'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 12 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#374151', textAlign: 'center' },
  columnsContainer: { flexDirection: 'row', flex: 1 },
  column: { flex: 1, margin: 4, backgroundColor: '#fff', borderRadius: 10, padding: 6, elevation: 2 },
  columnHeader: { fontWeight: 'bold', fontSize: 16, marginBottom: 6, color: '#2563EB', textAlign: 'center' },
  scrollView: { flex: 1 },
  textCard: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 8, marginBottom: 6 },
  text: { fontSize: 15, color: '#1F2937' },
  partialCard: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 8, marginBottom: 6 },
  partialText: { color: '#92400E', fontSize: 14, fontStyle: 'italic' },
  error: { color: '#DC2626', fontSize: 16, marginBottom: 12, textAlign: 'center' },
  button: { padding: 16, borderRadius: 12, alignItems: 'center', marginVertical: 10 },
  buttonStart: { backgroundColor: '#10B981' },
  buttonStop: { backgroundColor: '#EF4444' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  summaryButton: { backgroundColor: '#2563EB', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  summaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
}); 