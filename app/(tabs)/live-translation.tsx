// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراً في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, PermissionsAndroid } from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Buffer } from 'buffer';

export default function LiveTranslationStreaming() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // إعداد خيارات التسجيل
  const audioOptions = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    wavFile: '', // لا نحتاج ملف
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

  const startStreaming = async () => {
    setError(null);
    setPartialText('');
    setFinalText('');

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
      // On each audio chunk
      AudioRecord.on('data', data => {
        const chunk = Buffer.from(data, 'base64');
        if (ws.readyState === 1) {
          ws.send(chunk);
        }
      });
      AudioRecord.start();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'partial') {
          setPartialText(msg.text || '');
        } else if (msg.type === 'final') {
          setFinalText(msg.text || '');
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
    };
  };

  const stopStreaming = () => {
    setIsRecording(false);
    AudioRecord.stop();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🎙️ Live Voice Translation (Streaming)</Text>
      <TouchableOpacity
        style={[styles.button, isRecording ? styles.buttonStop : styles.buttonStart]}
        onPress={isRecording ? stopStreaming : startStreaming}
      >
        <Text style={styles.buttonText}>{isRecording ? 'Stop Streaming' : 'Start Live Streaming'}</Text>
      </TouchableOpacity>
      <ScrollView style={styles.resultContainer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {partialText ? (
          <Text style={styles.partialText}>⏳ Partial: {partialText}</Text>
        ) : null}
        {finalText ? (
          <Text style={styles.finalText}>✅ Final: {finalText}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 24 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#374151', textAlign: 'center' },
  button: { padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  buttonStart: { backgroundColor: '#10B981' },
  buttonStop: { backgroundColor: '#EF4444' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  resultContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, minHeight: 120 },
  partialText: { color: '#92400E', fontSize: 16, marginBottom: 12 },
  finalText: { color: '#2563EB', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  error: { color: '#DC2626', fontSize: 16, marginBottom: 12, textAlign: 'center' },
}); 