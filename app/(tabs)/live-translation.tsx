// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراً في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, PermissionsAndroid, Clipboard, Alert } from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Buffer } from 'buffer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpeechService } from '@/services/speechService';
import { useSummary } from '@/contexts/SummaryContext';
import { ensureMicPermission } from '@/utils/permissionHelper';
import { Save } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Tts from 'react-native-tts';
import { useAuth } from '@/contexts/AuthContext';

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
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [initSpinner, setInitSpinner] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetLanguage = typeof params.targetLanguage === 'string' && params.targetLanguage.length > 0 ? params.targetLanguage : 'ar';
  const { setTranscription, setTranslation, setTargetLanguage, summary } = useSummary();
  const autoStart = Boolean(params.autoStart && params.autoStart.toString() === 'true');
  const [isSaved, setIsSaved] = useState(false);
  const { user } = useAuth();

  // إعداد خيارات التسجيل
  const audioOptions = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    wavFile: '',
  };

  // طلب إذن المايك باستخدام الدالة المشتركة
  const requestMicPermission = async () => {
    return await ensureMicPermission();
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

  async function initAll(): Promise<void> {
    setInitSpinner(true);
    setInitMessage('Preparing audio and connection...');
    setInitFailed(false);
    
    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied.');
      }
      
      AudioRecord.init(audioOptions);
      
      return new Promise<void>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        try {
          const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
          wsRef.current = ws;
          
          timeoutId = setTimeout(() => {
            setInitSpinner(false);
            setIsReady(false);
            setInitMessage('Connection timed out. Please check your internet or try again later.');
            setInitFailed(true);
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            reject(new Error('Connection timed out. Please check your internet or try again later.'));
          }, 5000); // 5 ثوانٍ للاتصال
          
          ws.onopen = () => {
            if (timeoutId) clearTimeout(timeoutId);
            setIsReady(true);
            setInitSpinner(false);
            setInitMessage(null);
            setInitFailed(false);
            resolve();
          };
          
          ws.onerror = () => {
            if (timeoutId) clearTimeout(timeoutId);
            setInitMessage('WebSocket connection error.');
            setInitSpinner(false);
            setIsReady(false);
            setInitFailed(true);
            reject(new Error('WebSocket connection error.'));
          };
          
          ws.onclose = () => {
            if (timeoutId) clearTimeout(timeoutId);
            setIsReady(false);
            setInitSpinner(false);
            reject(new Error('WebSocket connection closed.'));
          };
          
        } catch (e) {
          if (timeoutId) clearTimeout(timeoutId);
          setInitMessage('Failed to connect to server.');
          setInitSpinner(false);
          setIsReady(false);
          setInitFailed(true);
          reject(new Error('Failed to connect to server.'));
        }
      });
      
    } catch (error) {
      setInitMessage(error instanceof Error ? error.message : 'Initialization failed.');
      setInitSpinner(false);
      setIsReady(false);
      setInitFailed(true);
      throw error;
    }
  }

  // دالة لإغلاق الاتصال نهائياً (عند الخروج من التطبيق)
  const closeConnection = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.log('Error closing WebSocket:', e);
      }
      wsRef.current = null;
    }
    setIsReady(false);
    setInitSpinner(false);
    setInitMessage(null);
    setInitFailed(false);
  };

  useEffect(() => {
    return () => {
      // إغلاق الاتصال فقط عند الخروج من التطبيق
      closeConnection();
    };
  }, []);

  const startStreaming = async () => {
    if (isRecording) return;
    setLoading(true);
    setError(null);
    setPartialText('');
    setPartialTranslation('');
    setFinalTranscripts([]);
    setShowSummary(false);

    // استخدم التهيئة العامة إذا كانت جاهزة
    if (typeof window !== 'undefined' && window.__LT_AUDIO_READY && window.__LT_WS && window.__LT_WS_READY) {
      wsRef.current = window.__LT_WS;
      setIsReady(true);
      setInitSpinner(false);
      setInitMessage(null);
      setInitFailed(false);
    } else {
      // إذا لم تكن التهيئة العامة جاهزة، نفذ التهيئة المحلية
      try {
        // إذا لم يكن الاتصال جاهزاً، ابدأ التهيئة وانتظر
        if (!isReady) {
          setInitSpinner(true);
          setInitMessage('Preparing audio and connection...');
          // انتظر حتى يتم الاتصال أو فشل
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('Connection timeout. Please check your internet connection and try again.'));
            }, 5000); // 5 ثوانٍ كحد أقصى
            const checkConnection = () => {
              if (isReady) {
                clearTimeout(timeoutId);
                resolve();
              } else if (initFailed) {
                clearTimeout(timeoutId);
                reject(new Error('Connection failed. Please try again.'));
              } else {
                setTimeout(checkConnection, 100);
              }
            };
            // ابدأ التهيئة
            initAll().catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
            // ابدأ فحص الاتصال
            checkConnection();
          });
        } else {
          // الاتصال جاهز، تحقق من أن WebSocket لا يزال مفتوحاً
          if (wsRef.current && wsRef.current.readyState !== 1) {
            // إذا كان WebSocket مغلقاً، أعد التهيئة
            setInitSpinner(true);
            setInitMessage('Reconnecting to server...');
            setIsReady(false);
            await new Promise<void>((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error('Reconnection timeout. Please try again.'));
              }, 5000);
              const checkConnection = () => {
                if (isReady) {
                  clearTimeout(timeoutId);
                  resolve();
                } else if (initFailed) {
                  clearTimeout(timeoutId);
                  reject(new Error('Reconnection failed. Please try again.'));
                } else {
                  setTimeout(checkConnection, 100);
                }
              };
              initAll().catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
              });
              checkConnection();
            });
          }
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to start streaming. Please try again.');
        setIsRecording(false);
        setLoading(false);
        setInitSpinner(false);
        setInitMessage(null);
        console.error('Start streaming error:', error);
        return;
      }
    }

    // الآن الاتصال جاهز، ابدأ التسجيل
    if (wsRef.current) {
      wsRef.current.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'partial') {
            setPartialText(msg.text || '');
            setPartialTranslation(await translateText(msg.text || ''));
          } else if (msg.type === 'final') {
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
      wsRef.current.onerror = (e) => {
        setError('Connection error with server. Please check your internet connection and try again.');
        setIsRecording(false);
        setLoading(false);
        setInitSpinner(false);
        try {
          AudioRecord.stop();
        } catch (stopError) {
          console.log('Error stopping audio record:', stopError);
        }
      };
      wsRef.current.onclose = () => {
        setIsRecording(false);
        setLoading(false);
        setInitSpinner(false);
        try {
          AudioRecord.stop();
        } catch (stopError) {
          console.log('Error stopping audio record:', stopError);
        }
        setError('Connection lost. You can try starting again.');
        setShowSummary(true);
      };
    }
    setIsRecording(true);
    setLoading(false);
    setInitSpinner(false); // إعادة تعيين initSpinner عند النجاح
    AudioRecord.on('data', data => {
      const chunk = Buffer.from(data, 'base64');
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(chunk);
      }
    });
    AudioRecord.start();
  };

  const stopStreaming = () => {
    setIsRecording(false);
    setLoading(false);
    setInitSpinner(false); // إعادة تعيين initSpinner
    setInitMessage(null); // مسح رسائل التهيئة
    try {
      AudioRecord.stop();
    } catch (e) {
      console.log('Error stopping AudioRecord:', e);
      Alert.alert('Debug', 'Error stopping AudioRecord: ' + String(e));
    }
    // لا نغلق WebSocket هنا - نبقيه مفتوحاً للاستخدام المستقبلي
    // if (wsRef.current) {
    //   try {
    //     wsRef.current.close();
    //   } catch (e) {
    //     console.log('Error closing WebSocket:', e);
    //     Alert.alert('Debug', 'Error closing WebSocket: ' + String(e));
    //   }
    //   wsRef.current = null;
    // }
    // setIsReady(false); // لا نعيد تعيين isReady إلى false
    setShowSummary(true);
  };

  // نسخ النص
  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Text copied to clipboard');
  };

  // الانتقال لصفحة التلخيص
  const handleAISummary = () => {
    // مرر النصوص الأصلية والمترجمة للصفحة الجديدة عبر الـ Context
    setTranscription(finalTranscripts.map(t => t.text).join('\n'));
    setTranslation(finalTranscripts.map(t => t.translation).join('\n'));
    setTargetLanguage(targetLanguage);
    router.push({ pathname: '/(tabs)/summary-view' });
  };

  // زر إعادة المحاولة
  const handleRetryInit = async () => {
    setIsReady(false);
    setInitSpinner(false);
    setInitMessage(null);
    setInitFailed(false);
    setError(null); // مسح رسائل الخطأ السابقة
    try {
      await initAll();
    } catch (error) {
      console.error('Retry init failed:', error);
    }
  };

  // دالة لإعادة الاتصال (عند انقطاع الاتصال)
  const handleReconnect = async () => {
    setError(null);
    setInitSpinner(true);
    setInitMessage('Reconnecting to server...');
    setIsReady(false);
    setInitFailed(false);
    
    try {
      await initAll();
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
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

  // عند أول تحميل للصفحة، إذا autoStart موجود، ابدأ التهيئة والتسجيل تلقائياً
  React.useEffect(() => {
    if (autoStart) {
      startStreaming().catch((error) => {
        console.error('Auto start failed:', error);
      });
    }
    // لا تطلب صلاحية المايك إلا عند الحاجة (عند الضغط على زر التسجيل أو autoStart)
  }, [autoStart]);

  const handleSaveToHistory = async () => {
    try {
      // حفظ كل النصوص النهائية في history مع الملخص إذا كان متوفراً
      const { error } = await supabase.from('recordings').insert([
        {
          user_id: user?.id,
          transcription: finalTranscripts.map(t => t.text).join('\n'),
          translation: finalTranscripts.map(t => t.translation).join('\n'),
          summary: summary || '',
          translationSummary: '',
          target_language: targetLanguage,
          created_at: new Date().toISOString(),
        }
      ]);
      if (error) throw error;
      setIsSaved(true);
      Alert.alert('Success', 'Content saved to history!');
    } catch (e) {
      setIsSaved(false);
      console.warn('Failed to save to history', e);
      Alert.alert('Error', 'Failed to save to history');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🎙️ Live Voice Translation (Streaming)</Text>
      
      {error && error.includes('permission') && (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Microphone Permission Required</Text>
          <Text style={styles.permissionText}>
            To use live translation, please grant microphone permission:
          </Text>
          <Text style={styles.permissionSteps}>
            1. Go to your device Settings{'\n'}
            2. Find this app in the list{'\n'}
            3. Enable Microphone permission{'\n'}
            4. Return to the app and try again
          </Text>
        </View>
      )}
      
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
      {/* الرسالة الجديدة: إذا كان الاتصال جاهزاً لكن لم يبدأ التسجيل */}
      {isReady && !isRecording && !initSpinner && !loading && (
        <Text style={{ color: '#059669', fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
          We are live! Please press on Start Live Streaming button again.
        </Text>
      )}
      <TouchableOpacity
        style={[
          styles.button,
          isRecording ? styles.buttonStop : styles.buttonStart,
          (loading || initSpinner) && { opacity: 0.6 }
        ]}
        onPress={isRecording ? stopStreaming : startStreaming}
        disabled={loading || initSpinner}
      >
        {isRecording ? (
          <Text style={styles.buttonText}>Stop Streaming</Text>
        ) : (initSpinner || loading) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.buttonText}>Preparing...</Text>
            <View style={{ marginLeft: 8 }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>⏳</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.buttonText}>Start Live Streaming</Text>
        )}
      </TouchableOpacity>
      {initMessage && !isReady && (
        <Text style={{ color: '#DC2626', fontSize: 15, textAlign: 'center', marginBottom: 8 }}>{initMessage}</Text>
      )}
      {initFailed && !isReady && (
        <TouchableOpacity style={[styles.summaryButton, { backgroundColor: '#10B981', marginTop: 8 }]} onPress={handleRetryInit}>
          <Text style={styles.summaryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
      {error && error.includes('Connection lost') && (
        <TouchableOpacity style={[styles.summaryButton, { backgroundColor: '#F59E0B', marginTop: 8 }]} onPress={handleReconnect}>
          <Text style={styles.summaryButtonText}>Reconnect</Text>
        </TouchableOpacity>
      )}
      {showSummary && finalTranscripts.length > 0 && (
        <TouchableOpacity style={styles.summaryButton} onPress={handleAISummary} disabled={isSummarizing}>
          <Text style={styles.summaryButtonText}>{isSummarizing ? 'Summarizing...' : 'AI Summary'}</Text>
        </TouchableOpacity>
      )}
      {finalTranscripts.length > 0 && !isSaved && (
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 24, right: 24, backgroundColor: '#2563EB', borderRadius: 24, padding: 10, elevation: 4, zIndex: 10 }}
          onPress={handleSaveToHistory}
          accessibilityLabel="Save to history"
        >
          <Save size={22} color="#fff" />
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
  permissionCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  permissionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
    color: '#92400E',
  },
  permissionText: {
    fontSize: 14,
    color: '#92400E',
  },
  permissionSteps: {
    fontSize: 14,
    color: '#92400E',
  },
}); 