// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراى في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LanguageSelector } from '../../components/LanguageSelector';
import { SpeechService } from '../../services/speechService';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { getAudioService } from '../../services/audioService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TranscriptionItem {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
}

const Logger = {
  info: (message: string, ...args: any[]) => console.log(`[LiveTranslation] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[LiveTranslation] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[LiveTranslation] ${message}`, ...args)
};

// دالة تحويل Base64 إلى Uint8Array للمتصفح
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function LiveTranslationScreen() {
  const { user, serverConnectionStatus, initializeServerConnection } = useAuth();
  const { targetLanguage, languageName, sourceLanguage, sourceLanguageName } = useLocalSearchParams<{
    targetLanguage: string;
    languageName: string;
    sourceLanguage: string;
    sourceLanguageName: string;
  }>();

  // Use shared language context - this is the source of truth
  const { 
    selectedSourceLanguage, 
    selectedTargetLanguage, 
    setSelectedSourceLanguage, 
    setSelectedTargetLanguage 
  } = useLanguage();

  // State management (other states)
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // استخدام حالة الاتصال من AuthContext بدلاً من الحالة المحلية
  const connectionStatus = serverConnectionStatus;
  
  // Real-time translation state (always enabled now)
  const isRealTimeMode = true; // Always enabled
  const [realTimeTranscription, setRealTimeTranscription] = useState<string>('');
  const [realTimeTranslation, setRealTimeTranslation] = useState<string>('');
  const [showSummaryButton, setShowSummaryButton] = useState(false);
  
  // Current session display state - keeps the latest transcription/translation visible
  const [currentSessionText, setCurrentSessionText] = useState<{
    original: string;
    translation: string;
  }>({ original: '', translation: '' });

  // Refs
  const audioServiceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChunksRef = useRef<Uint8Array[]>([]); // قائمة مؤقتة للـchunks
  const wsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // timeout للـWebSocket
  const lastActivityRef = useRef<number>(Date.now()); // آخر نشاط للـWebSocket
  const chunkBufferRef = useRef<Uint8Array[]>([]); // buffer لتجميع الـchunks
  const chunkBufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // timeout لتجميع الـchunks
  const maxBufferTimeRef = useRef<number>(10000); // أقصى وقت للتجميع (10 ثوانٍ للاختبار)
  const scrollViewRef = useRef<ScrollView>(null); // ref for auto-scroll
  const isConnectingRef = useRef<boolean>(false); // منع الاتصالات المتعددة

  // Initialize languages from route params if provided, otherwise use context values
  useEffect(() => {
    const languages = SpeechService.getAvailableLanguages();
    
    // Only update context if we have new values from navigation params
    if (targetLanguage && (!selectedTargetLanguage || selectedTargetLanguage.code !== targetLanguage)) {
      const targetLang = languages.find(lang => lang.code === targetLanguage) || languages[0];
      setSelectedTargetLanguage(targetLang);
      Logger.info('🎯 Updated target language from params:', targetLang);
    }
    
    if (sourceLanguage && (!selectedSourceLanguage || selectedSourceLanguage.code !== sourceLanguage)) {
      const sourceLang = languages.find(lang => lang.code === sourceLanguage) || { code: 'auto', name: 'Auto Detect', flag: '🌐' };
      setSelectedSourceLanguage(sourceLang);
      Logger.info('🎯 Updated source language from params:', sourceLang);
    }
  }, [targetLanguage, sourceLanguage, selectedTargetLanguage, selectedSourceLanguage, setSelectedTargetLanguage, setSelectedSourceLanguage]);

  // Auto-scroll to bottom when new transcriptions are added
  useEffect(() => {
    if (transcriptions.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcriptions]);

  // Auto-scroll for real-time transcription updates
  useEffect(() => {
    if (isRecording && realTimeTranscription && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [realTimeTranscription, isRecording]);

  // Helper function to convert language codes to Azure format
  const convertToAzureLanguage = (langCode: string): string => {
    // فقط اللغات المدعومة من Azure Speech Service
    const azureLanguageMap: { [key: string]: string } = {
      'ar': 'ar-SA', 'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
      'it': 'it-IT', 'pt': 'pt-BR', 'ru': 'ru-RU', 'ja': 'ja-JP', 'ko': 'ko-KR',
      'zh': 'zh-CN', 'tr': 'tr-TR', 'nl': 'nl-NL', 'pl': 'pl-PL', 'sv': 'sv-SE',
      'da': 'da-DK', 'no': 'no-NO', 'fi': 'fi-FI', 'cs': 'cs-CZ', 'sk': 'sk-SK',
      'hu': 'hu-HU', 'ro': 'ro-RO', 'bg': 'bg-BG', 'hr': 'hr-HR', 'sl': 'sl-SI',
      'et': 'et-EE', 'lv': 'lv-LV', 'lt': 'lt-LT', 'el': 'el-GR', 'he': 'he-IL',
      'th': 'th-TH', 'vi': 'vi-VN', 'id': 'id-ID', 'ms': 'ms-MY', 'fil': 'fil-PH',
      'hi': 'hi-IN', 'bn': 'bn-IN', 'ur': 'ur-PK', 'fa': 'fa-IR', 'uk': 'uk-UA'
    };
    
    const azureCode = azureLanguageMap[langCode];
    if (!azureCode) {
      Logger.warn(`Unsupported language code: ${langCode}, defaulting to ar-SA`);
      return 'ar-SA';
    }
    
    Logger.info(`Language conversion: ${langCode} → ${azureCode}`);
    return azureCode;
  };

  // Initialize component - only clear old data, no audio service initialization
  useEffect(() => {
    const clearOldData = async () => {
      // تنظيف AsyncStorage من أي بيانات قديمة - فقط في الموبايل
      if (Platform.OS !== 'web') {
        try {
          await AsyncStorage.removeItem('audio_cache');
          await AsyncStorage.removeItem('transcription_cache');
          await AsyncStorage.removeItem('translation_cache');
          Logger.info('Cleared AsyncStorage cache');
        } catch (error) {
          Logger.error('Failed to clear AsyncStorage:', error);
        }
      }
    };
    
    // تنظيف شامل للبيانات القديمة عند بدء التطبيق
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    
    Logger.info('App started - clearing old data only');
    
    // تنظيف AsyncStorage - فقط في الموبايل
    clearOldData();
    
    Logger.info('Cleared all old data on app start');
    
    // تهيئة الصوت تلقائياً عند تحميل الصفحة
    const initializeAudioOnLoad = async () => {
      try {
        Logger.info('🎵 Auto-initializing audio service on page load...');
        await initAll();
        Logger.info('✅ Audio service auto-initialized successfully');
      } catch (error) {
        Logger.error('❌ Failed to auto-initialize audio service:', error);
        // لا نضع error هنا لأن المستخدم قد لا يحتاج للصوت فوراً
      }
    };
    
    // تهيئة الصوت بعد ثانيتين من تحميل الصفحة
    const audioInitTimer = setTimeout(initializeAudioOnLoad, 2000);
    
    // Cleanup on unmount only
    return () => {
      Logger.info('🔄 Component unmounting, performing cleanup...');
      clearTimeout(audioInitTimer);
      cleanup();
    };
  }, []);

  const initAll = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      Logger.info('🎵 Initializing audio service...');
      
      // إنشاء خدمة صوت جديدة
      const audioService = getAudioService();
      
      // Configure audio service for Azure Speech SDK compatibility
      const audioConfig = {
        sampleRate: 16000, // Azure Speech SDK expects 16kHz
        channels: 1, // Mono
        bitsPerSample: 16, // 16-bit
        encoding: 'pcm_s16le' // Linear PCM 16-bit little-endian
      };
      
      await audioService.init(audioConfig);
      audioServiceRef.current = audioService;
      
      setIsReady(true);
      Logger.info('✅ Audio service initialized successfully with Azure-compatible settings:', audioConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('❌ Failed to initialize audio service:', errorMessage);
      setError(`فشل في تهيئة الصوت: ${errorMessage}`);
      throw error; // إعادة رمي الخطأ لمعالجته في startStreaming
    } finally {
      setIsInitializing(false);
    }
  };

  const cleanup = () => {
    Logger.info('🧹 Starting comprehensive cleanup...');
    
    // إعادة تعيين حالة الاتصال
    isConnectingRef.current = false;
    
    // إيقاف خدمة الصوت
    if (audioServiceRef.current && isReady) {
      try {
        audioServiceRef.current.stop();
        Logger.info('✅ Audio service stopped');
      } catch (error) {
        Logger.error('❌ Error stopping audio service:', error);
      }
    }
    
    // إغلاق WebSocket بشكل صحيح مع status code مناسب
    if (wsRef.current) {
      try {
        const ws = wsRef.current;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Client cleanup - preventing parallel connections');
          Logger.info('✅ WebSocket closed with proper status code');
        }
        wsRef.current = null;
      } catch (error) {
        Logger.error('❌ Error closing WebSocket:', error);
      }
    }
    
    // تنظيف جميع المؤقتات
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
      translationTimeoutRef.current = null;
    }
    if (wsTimeoutRef.current) {
      clearTimeout(wsTimeoutRef.current);
      wsTimeoutRef.current = null;
    }
    if (chunkBufferTimeoutRef.current) {
      clearTimeout(chunkBufferTimeoutRef.current);
      chunkBufferTimeoutRef.current = null;
    }
    
    // تنظيف البيانات المؤقتة
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    
    // تنظيف المراجع
    pendingChunksRef.current = [];
    chunkBufferRef.current = [];
    isConnectingRef.current = false;
    
    // تنظيف AsyncStorage - فقط في الموبايل
    if (Platform.OS !== 'web') {
      AsyncStorage.removeItem('audio_cache').catch(() => {});
      AsyncStorage.removeItem('transcription_cache').catch(() => {});
      AsyncStorage.removeItem('translation_cache').catch(() => {});
    }
    
    Logger.info('✅ Complete cleanup performed - all connections closed');
  };

  // دالة لإدارة timeout الـWebSocket
  const manageWebSocketTimeout = () => {
    // إلغاء الـtimeout السابق
    if (wsTimeoutRef.current) {
      clearTimeout(wsTimeoutRef.current);
    }
    
    // تحديث آخر نشاط
    lastActivityRef.current = Date.now();
    
    // تعيين timeout جديد (5 دقائق)
    wsTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('WebSocket timeout reached, closing connection');
        wsRef.current.close(1000, 'Timeout - no activity');
      }
    }, 300000); // 5 دقائق
  };

  // دالة لتجميع وإرسال الـchunks
  const sendBufferedChunks = () => {
    Logger.info(`[sendBufferedChunks] Called with ${chunkBufferRef.current.length} chunks in buffer`);
    
    if (chunkBufferRef.current.length === 0) {
      Logger.warn(`[sendBufferedChunks] No chunks to send`);
      return;
    }
    
    // دمج جميع الـchunks في chunk واحد كبير
    const totalSize = chunkBufferRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedChunk = new Uint8Array(totalSize);
    
    let offset = 0;
    chunkBufferRef.current.forEach((chunk, index) => {
      Logger.info(`[sendBufferedChunks] Combining chunk ${index + 1}: ${chunk.byteLength} bytes at offset ${offset}`);
      combinedChunk.set(chunk, offset);
      offset += chunk.byteLength;
    });
    
    // Validate the combined chunk for Azure Speech SDK
    const durationSeconds = totalSize / (16000 * 2); // 16kHz, 16-bit = 2 bytes per sample
    Logger.info(`[sendBufferedChunks] 🚀 SENDING COMBINED CHUNK:
      - Total size: ${combinedChunk.byteLength} bytes
      - From ${chunkBufferRef.current.length} chunks
      - Estimated duration: ${durationSeconds.toFixed(2)}s
      - Sample rate validation: ${totalSize % 2 === 0 ? '✅ Valid' : '❌ Invalid (not 16-bit aligned)'}`);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(combinedChunk);
        manageWebSocketTimeout();
        Logger.info(`[sendBufferedChunks] ✅ Combined chunk sent successfully to Azure Speech SDK`);
      } catch (sendError) {
        Logger.error(`[sendBufferedChunks] ❌ Failed to send chunk:`, sendError);
        pendingChunksRef.current.push(combinedChunk);
        Logger.warn(`[sendBufferedChunks] ⚠️ Chunk stored in pending queue due to send error`);
      }
    } else {
      pendingChunksRef.current.push(combinedChunk);
      const wsState = wsRef.current?.readyState;
      const wsStateText = wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : wsState === 3 ? 'CLOSED' : 'UNKNOWN';
      Logger.warn(`[sendBufferedChunks] ⚠️ WebSocket not ready (state: ${wsState}/${wsStateText}), combined chunk stored in pending queue`);
    }
    
    // تفريغ الـbuffer
    chunkBufferRef.current = [];
    Logger.info(`[sendBufferedChunks] Buffer cleared`);
  };

  // Initialize WebSocket connection
  const initializeWebSocket = async () => {
    try {
      // منع الاتصالات المتعددة المتزامنة
      if (isConnectingRef.current) {
        Logger.warn('⚠️ Connection already in progress, skipping to prevent parallel connections');
        return;
      }
      
      // إذا كان الاتصال مفتوح بالفعل، لا نحتاج لإنشاء جديد
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('✅ WebSocket already connected, skipping initialization');
        return;
      }
      
      // إغلاق أي اتصال موجود قبل إنشاء جديد
      if (wsRef.current) {
        Logger.info('🔄 Closing existing WebSocket before creating new one');
        try {
          if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
            wsRef.current.close(1000, 'Creating new connection');
          }
          wsRef.current = null;
        } catch (error) {
          Logger.error('❌ Error closing existing WebSocket:', error);
        }
        
        // انتظار قصير للتأكد من إغلاق الاتصال
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // تنظيف البيانات المؤقتة فقط (بدون AsyncStorage)
      pendingChunksRef.current = [];
      chunkBufferRef.current = [];
      if (chunkBufferTimeoutRef.current) {
        clearTimeout(chunkBufferTimeoutRef.current);
        chunkBufferTimeoutRef.current = null;
      }
      
      isConnectingRef.current = true;
      
      Logger.info('🚀 Creating new WebSocket connection to prevent parallel requests...');
      // استخدام السيرفر على Render
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      ws.onopen = () => {
        Logger.info('✅ WebSocket connected successfully');
        isConnectingRef.current = false; // إعادة تعيين حالة الاتصال
        setError(null);
        
        // بدء إدارة الـtimeout
        manageWebSocketTimeout();
        
        // إرسال الـchunks المؤقتة إذا وجدت
        if (pendingChunksRef.current.length > 0) {
          Logger.info(`Sending ${pendingChunksRef.current.length} pending chunks`);
          pendingChunksRef.current.forEach((chunk, index) => {
            ws.send(chunk);
            Logger.info(`Sent pending chunk ${index + 1}/${pendingChunksRef.current.length} (${chunk.byteLength} bytes)`);
          });
          pendingChunksRef.current = []; // تفريغ القائمة
        }
        
        // تم حذف تنظيف AsyncStorage هنا
        // if (Platform.OS !== 'web') {
        //   AsyncStorage.removeItem('audio_cache').catch(() => {});
        //   AsyncStorage.removeItem('transcription_cache').catch(() => {});
        //   AsyncStorage.removeItem('translation_cache').catch(() => {});
        //   Logger.info('WebSocket opened and cache cleared');
        // }
        
        // Validate and prepare language codes
        const supportedLanguages = SpeechService.getAvailableLanguages().map(lang => lang.code);
        
        // Get source and target languages
        const sourceLang = selectedSourceLanguage?.code || 'auto';
        const targetLang = selectedTargetLanguage?.code || 'en';
        
        // For Azure, convert to Azure format or use auto detection
        const azureSourceLang = sourceLang === 'auto' ? null : convertToAzureLanguage(sourceLang);
        const azureTargetLang = convertToAzureLanguage(targetLang);
        
        // Validate target language only (source is auto)
        if (!supportedLanguages.includes(targetLang)) {
          Logger.error('Unsupported target language:', targetLang);
          setError(`Unsupported target language: ${targetLang}`);
          return;
        }
        
        Logger.info('Language configuration - Source:', sourceLang, '→', azureSourceLang, 'Target:', targetLang, '→', azureTargetLang);
        
        // Send initialization message with simplified configuration
        const initMessage = {
          type: 'init',
          language: azureSourceLang, // null for auto detection, specific language code otherwise
          targetLanguage: azureTargetLang,
          clientSideTranslation: true,
          realTimeMode: isRealTimeMode,
          autoDetection: sourceLang === 'auto', // True only when auto detection is selected
          audioConfig: {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            encoding: 'pcm_s16le'
          }
        };
        
        ws.send(JSON.stringify(initMessage));
        Logger.info('Init message sent with auto detection:', initMessage);
      };
      
      ws.onmessage = async (event) => {
        try {
          // تحديث الـtimeout عند استقبال رسائل
          manageWebSocketTimeout();
          
          Logger.info('Raw server reply:', event.data);
          const data = JSON.parse(event.data);
          Logger.info('Parsed message:', data.type, data);
          
          if (data.type === 'transcription' || data.type === 'final') {
            if (data.text && data.text.trim()) {
              // تجنب إضافة نفس النص مرتين
              const isDuplicate = transcriptions.some(item => 
                item.originalText === data.text
              );
              
              if (isDuplicate) {
                Logger.warn('Skipping duplicate transcription:', data.text);
                return;
              }
              
              Logger.info('Processing transcription:', data.text);
              
              if (isRealTimeMode) {
                // NEW: Update real-time transcription
                setRealTimeTranscription(data.text);
                
                // Update current session text to keep it visible
                setCurrentSessionText(prev => ({
                  ...prev,
                  original: data.text
                }));
                
                // تجنب إضافة نفس النص في التاريخ إذا كان موجوداً
                const isDuplicate = transcriptions.some(item => 
                  item.originalText === data.text
                );
                
                if (!isDuplicate) {
                  // إضافة النص الجديد إلى التاريخ
                  const newItem: TranscriptionItem = {
                    id: Date.now().toString(),
                    originalText: data.text,
                    translatedText: '',
                    timestamp: new Date()
                  };
                  setTranscriptions(prev => [...prev, newItem]);
                }
                
                // Also translate in real-time mode
                try {
                  Logger.info('Real-time translating:', data.text, 'to:', selectedTargetLanguage?.code);
                  const translatedText = await SpeechService.translateText(
                    data.text, 
                    selectedTargetLanguage?.code || 'ar',
                    selectedSourceLanguage?.code
                  );
                  
                  Logger.info('Real-time translation result:', translatedText);
                  setRealTimeTranslation(translatedText);
                  
                  // Update current session translation
                  setCurrentSessionText(prev => ({
                    ...prev,
                    translation: translatedText
                  }));
                } catch (translationError) {
                  Logger.error('Real-time translation failed:', translationError);
                  setRealTimeTranslation(data.text); // Fallback to original
                  
                  // Update current session translation with fallback
                  setCurrentSessionText(prev => ({
                    ...prev,
                    translation: data.text
                  }));
                }
              } else {
                // Traditional mode: add to transcriptions list
                const newItem: TranscriptionItem = {
                  id: Date.now().toString(),
                  originalText: data.text,
                  translatedText: '',
                  timestamp: new Date()
                };
                
                setTranscriptions(prev => [...prev, newItem]);
                
                // Translate the text
                try {
                  Logger.info('Translating text:', data.text, 'to:', selectedTargetLanguage?.code);
                  const translatedText = await SpeechService.translateText(
                    data.text, 
                    selectedTargetLanguage?.code || 'ar',
                    selectedSourceLanguage?.code
                  );
                  
                  Logger.info('Translation result:', translatedText);
                  
                  setTranscriptions(prev => 
                    prev.map(item => 
                      item.id === newItem.id 
                        ? { ...item, translatedText } 
                        : item
                    )
                  );
                } catch (translationError) {
                  Logger.error('Translation failed:', translationError);
                  
                  // Set original text as fallback
                  setTranscriptions(prev => 
                    prev.map(item => 
                      item.id === newItem.id 
                        ? { ...item, translatedText: data.text } 
                        : item
                    )
                  );
                }
              }
            } else {
              Logger.warn('Received empty transcription text');
            }
          } else if (data.type === 'status') {
            Logger.info('Server status:', data.message);
            // يمكن إضافة مؤشر حالة هنا إذا لزم الأمر
          } else if (data.type === 'error') {
            Logger.error('Server error:', data.error);
            Logger.error('Full error details:', data);
            setError(`خطأ في السيرفر: ${data.error}`);
          }
        } catch (error) {
          Logger.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        Logger.error('❌ WebSocket error event:', error);
        Logger.error('WebSocket error details:', {
          readyState: ws.readyState,
          url: ws.url,
          protocol: ws.protocol
        });
        isConnectingRef.current = false; // إعادة تعيين حالة الاتصال
        setError('فشل في الاتصال بالخادم - Concurrent connections may be exceeded');
      };
      
      ws.onclose = (event) => {
        Logger.info('🔌 WebSocket disconnected', event.code, event.reason);
        isConnectingRef.current = false; // إعادة تعيين حالة الاتصال
        
        // فقط إعادة الاتصال للأخطاء غير المتوقعة وليس لتجاوز حد الاتصالات
        if (event.code !== 1000 && event.code !== 1011 && isRecording && !isConnectingRef.current) {
          Logger.info('🔄 Attempting to reconnect after unexpected disconnect...');
          setTimeout(() => {
            if (isRecording && !isConnectingRef.current) {
              initializeWebSocket();
            }
          }, 3000); // زيادة وقت الانتظار لتجنب الاتصالات السريعة
        } else if (event.code === 1011) {
          Logger.warn('⚠️ Server terminated connection - likely due to concurrent limit');
          setError('Server connection limit reached. Please wait before reconnecting.');
        }
      };
      
      wsRef.current = ws;
    } catch (error) {
      Logger.error('❌ Failed to initialize WebSocket:', error);
      isConnectingRef.current = false; // إعادة تعيين حالة الاتصال في حالة الخطأ
      setError('Failed to connect - please check your internet connection');
      throw error;
    }
  };

  const startStreaming = async () => {
    if (isRecording) {
      Logger.warn('Already recording');
      return;
    }
    
    try {
      Logger.info('🎙️ Starting audio streaming...');
      setShowSummaryButton(false); // Hide summary button when starting new recording
      
      // 1. تأكد أن السيرفر متصل
      if (connectionStatus !== 'connected') {
        Logger.info('Server not connected, initializing connection...');
        await initializeServerConnection();
        // انتظار قصير للتأكد من الاتصال
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 2. إذا لم يكن AudioService جاهزًا، هيئه
      if (!isReady) {
        Logger.info('Audio service not ready, initializing...');
        setIsInitializing(true);
        try {
          await initAll();
        } catch (error) {
          Logger.error('Failed to initialize audio service:', error);
          setError('فشل في تهيئة الصوت. يرجى المحاولة مرة أخرى.');
          setIsInitializing(false);
          return;
        }
      }
      
      // 3. إنشاء WebSocket connection إذا لم يكن موجوداً
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        Logger.info('Creating WebSocket connection...');
        await initializeWebSocket();
        // انتظار قصير للتأكد من الاتصال
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // إزالة المستمعين القديمة لتجنب التراكم
      audioServiceRef.current.removeAllListeners();
      
      // Start audio recording with fresh data
      await audioServiceRef.current.start();
      
      // Set up audio data callback
      audioServiceRef.current.onData((chunk: any) => {
        // طباعة معلومات الـchunk للتشخيص
        const chunkSize = chunk.size || 0;
        const timestamp = Date.now();
        
        // Calculate expected chunk size for 16kHz, 16-bit, mono PCM
        // For 100ms chunks: 16000 samples/sec * 0.1 sec * 2 bytes/sample = 3200 bytes
        const expectedChunkSize = Math.floor(16000 * 0.1 * 2); // ~3200 bytes for 100ms
        
        Logger.info(`[onData] 🎵 Audio chunk received - Size: ${chunkSize} bytes, Time: ${timestamp}, Expected: ~${expectedChunkSize} bytes (100ms @ 16kHz)`);
        
        // تجاهل الـchunks الصغيرة جداً (صمت) - عتبة محدثة للـ16kHz
        if (chunkSize < 1600) { // ~50ms worth of audio at 16kHz
          Logger.warn(`[onData] ⏭️ Skipping small chunk (${chunkSize} bytes) - likely silence`);
          return;
        }
        
        // تحويل البيانات إلى binary
        let raw: Uint8Array;
        try {
          raw = base64ToUint8Array(chunk.data);
          Logger.info(`[onData] ✅ Successfully converted chunk to Uint8Array: ${raw.byteLength} bytes`);
          
          // Validate audio data format (basic check)
          if (raw.byteLength % 2 !== 0) {
            Logger.warn(`[onData] ⚠️ Audio chunk size not aligned to 16-bit samples: ${raw.byteLength} bytes`);
          }
          
        } catch (error) {
          Logger.error('[onData] ❌ Failed to convert chunk to binary:', error);
          return;
        }
        
        // إضافة الـchunk إلى الـbuffer
        chunkBufferRef.current.push(raw);
        Logger.info(`[onData] 📦 Added chunk to buffer. Buffer now has ${chunkBufferRef.current.length} chunks`);
        
        // تحديد استراتيجية الإرسال بناءً على حجم البيانات - إرسال مستمر بدون timeout
        const bufferSize = chunkBufferRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const targetBufferSize = 32000; // ~1 second of 16kHz 16-bit mono audio (تقليل الحجم للاستجابة الأسرع)
        
        // إرسال البيانات فوراً عند الوصول للحجم المطلوب (بدون timeout)
        if (bufferSize >= targetBufferSize) {
          Logger.info(`[onData] 🚀 Buffer size reached target (${bufferSize}/${targetBufferSize} bytes), sending immediately`);
          sendBufferedChunks();
          return;
        }
        
        // إلغاء الـtimeout السابق للتجميع
        if (chunkBufferTimeoutRef.current) {
          clearTimeout(chunkBufferTimeoutRef.current);
          Logger.info(`[onData] ⏰ Cleared previous buffer timeout`);
        }
        
        // لا نستخدم timeout في الترجمة الفورية - فقط إرسال مباشر أو عند الإيقاف
        if (!isRealTimeMode) {
          // للتسجيل العادي فقط - استخدام timeout
          const bufferTimeout = 2000; // 2 seconds for regular recording
          chunkBufferTimeoutRef.current = setTimeout(() => {
            Logger.info(`[onData] ⏰ Buffer timeout reached (${bufferTimeout}ms), calling sendBufferedChunks`);
            sendBufferedChunks();
          }, bufferTimeout);
          
          Logger.info(`[onData] ⏰ Set buffer timeout for regular mode: ${bufferTimeout}ms (buffer size: ${bufferSize}/${targetBufferSize} bytes)`);
        } else {
          Logger.info(`[onData] 🔴 Real-time mode: No timeout, buffer will be sent only on size target or stop (buffer size: ${bufferSize}/${targetBufferSize} bytes)`);
        }
      });
      
      setIsRecording(true);
      setError(null);
      
      // تنظيف الـbuffer عند بدء التسجيل
      chunkBufferRef.current = [];
      Logger.info('[startStreaming] 🧹 Cleared chunk buffer for new recording session');
      
      // إلغاء أي timeout موجود من جلسة سابقة
      if (chunkBufferTimeoutRef.current) {
        clearTimeout(chunkBufferTimeoutRef.current);
        chunkBufferTimeoutRef.current = null;
        Logger.info('[startStreaming] ⏰ Cleared any existing buffer timeout');
      }
      
      // NEW: Clear real-time data when starting (but keep current session text)
      if (isRealTimeMode) {
        setRealTimeTranscription('');
        setRealTimeTranslation('');
        Logger.info('[startStreaming] 🔴 Real-time mode: Cleared real-time data for new recording (keeping current session text)');
      }
      
      Logger.info(`[startStreaming] ✅ Live streaming started successfully (Real-time mode: ${isRealTimeMode})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to start streaming:', errorMessage);
      setError(`فشل في بدء التسجيل: ${errorMessage}`);
      setIsRecording(false);
    }
  };

  const stopStreaming = async () => {
    try {
      Logger.info('Stopping audio streaming...');
      
      // إرسال أي chunks متبقية في الـbuffer قبل الإيقاف
      if (chunkBufferRef.current.length > 0) {
        Logger.info(`[stopStreaming] 📤 Sending remaining ${chunkBufferRef.current.length} chunks before stopping`);
        sendBufferedChunks();
      }
      
      if (audioServiceRef.current && isReady) {
        await audioServiceRef.current.stop();
        Logger.info('Audio service stopped');
      }
      
      // تنظيف الـbuffer بعد الإرسال
      chunkBufferRef.current = [];
      Logger.info('[stopStreaming] 🧹 Buffer cleared after sending remaining chunks');
      
      // تنظيف القائمة المؤقتة
      pendingChunksRef.current = [];
      Logger.info('Pending chunks cleared');
      
      // إلغاء أي timeout موجود
      if (chunkBufferTimeoutRef.current) {
        clearTimeout(chunkBufferTimeoutRef.current);
        chunkBufferTimeoutRef.current = null;
        Logger.info('Buffer timeout cleared');
      }
      
      // إلغاء الـtimeout الحالي
      if (wsTimeoutRef.current) {
        clearTimeout(wsTimeoutRef.current);
        Logger.info('WebSocket timeout cleared');
      }
      
      // تنظيف AsyncStorage بعد الإيقاف - فقط في الموبايل
      if (Platform.OS !== 'web') {
        try {
          await AsyncStorage.removeItem('audio_cache');
          await AsyncStorage.removeItem('transcription_cache');
          await AsyncStorage.removeItem('translation_cache');
          Logger.info('Cleared AsyncStorage after stopping');
        } catch (error) {
          Logger.error('Failed to clear AsyncStorage after stopping:', error);
        }
      }
      
      setIsRecording(false);
      
      // إبقاء الاتصال مفتوحًا لمدة دقيقة إضافية للحصول على النتائج النهائية
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('Keeping WebSocket connection open for 1 minute to receive final results');
        
        // تعيين timeout جديد لإغلاق الاتصال بعد دقيقة
        wsTimeoutRef.current = setTimeout(() => {
          if (wsRef.current) {
            Logger.info('Closing WebSocket connection after 1 minute timeout');
            wsRef.current.close();
          }
        }, 60000); // دقيقة واحدة
      }
      
      // NEW: Save real-time transcription to history if exists and update current session
      if (isRealTimeMode && realTimeTranscription) {
        // تجنب إضافة نفس النص مرتين
        const isDuplicate = transcriptions.some(item => 
          item.originalText === realTimeTranscription
        );
        
        if (!isDuplicate) {
          Logger.info('Saving real-time transcription to history:', realTimeTranscription);
          const newItem: TranscriptionItem = {
            id: Date.now().toString(),
            originalText: realTimeTranscription,
            translatedText: realTimeTranslation,
            timestamp: new Date()
          };
          setTranscriptions(prev => [...prev, newItem]);
        }
        
        // Update current session text with the final transcription/translation
        setCurrentSessionText({
          original: realTimeTranscription,
          translation: realTimeTranslation
        });
        
        // Clear real-time text for next recording session
        setRealTimeTranscription('');
        setRealTimeTranslation('');
      }
      
      Logger.info('Audio streaming stopped successfully. Final buffer cleared only once at stop.');
      
      // Auto-save to database when recording ends
      setTimeout(async () => {
        if (transcriptions.length > 0 || realTimeTranscription) {
          try {
            // جمع جميع النصوص للحفظ
            let allOriginalText = '';
            let allTranslatedText = '';
            
            // إضافة النص المباشر
            if (realTimeTranscription && realTimeTranscription.trim()) {
              allOriginalText += realTimeTranscription.trim();
              if (realTimeTranslation && realTimeTranslation.trim()) {
                allTranslatedText += realTimeTranslation.trim();
              }
            }
            
            // إضافة النصوص التاريخية
            transcriptions.forEach((item) => {
              if (item.originalText && item.originalText.trim()) {
                if (allOriginalText) allOriginalText += '\n\n';
                allOriginalText += item.originalText.trim();
              }
              if (item.translatedText && item.translatedText.trim()) {
                if (allTranslatedText) allTranslatedText += '\n\n';
                allTranslatedText += item.translatedText.trim();
              }
            });
            
            // حفظ في قاعدة البيانات
            if (allOriginalText || allTranslatedText) {
              Logger.info('Auto-saving session to database...');
              await addToHistory({
                transcription: allOriginalText,
                translation: allTranslatedText,
                summary: '',
                translationSummary: '',
                created_at: new Date().toISOString(),
              });
              Logger.info('Session saved to database successfully');
            }
          } catch (error) {
            Logger.error('Failed to auto-save session:', error);
          }
          
          Logger.info('Showing AI Summary button');
          setShowSummaryButton(true);
        }
      }, 1000); // Wait 1 second for any final transcriptions
      
    } catch (error) {
      Logger.error('Failed to stop streaming:', error);
    }
  };

  const handleTargetLanguageChange = (newTargetLanguage: Language) => {
    // Update shared context - this will sync back to the main app
    setSelectedTargetLanguage(newTargetLanguage);
    Logger.info('🔄 Target language changed and synced to main app:', newTargetLanguage);
    
    // تنظيف AsyncStorage عند تغيير اللغة - فقط في الموبايل
    if (Platform.OS !== 'web') {
      AsyncStorage.removeItem('audio_cache').catch(() => {});
      AsyncStorage.removeItem('transcription_cache').catch(() => {});
      AsyncStorage.removeItem('translation_cache').catch(() => {});
      Logger.info('Cleared AsyncStorage on language change');
    }
    
    // Retranslate existing transcriptions
    Promise.all(
      transcriptions.map(async (item) => {
        try {
          const newTranslatedText = await SpeechService.translateText(
            item.originalText,
            newTargetLanguage.code,
            selectedSourceLanguage?.code
          );
          return { ...item, translatedText: newTranslatedText };
        } catch (error) {
          Logger.error('Failed to retranslate item:', error);
          return item;
        }
      })
    ).then(retranslated => {
      setTranscriptions(retranslated);
    });
    
    // NEW: Retranslate real-time content
    if (isRealTimeMode && realTimeTranscription) {
      SpeechService.translateText(
        realTimeTranscription,
        newTargetLanguage.code,
        selectedSourceLanguage?.code
      ).then(newTranslatedText => {
        Logger.info('Real-time retranslation result:', newTranslatedText);
        setRealTimeTranslation(newTranslatedText);
      }).catch(error => {
        Logger.error('Failed to retranslate real-time content:', error);
      });
    }
    
    // Notify server of language update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const sourceLang = selectedSourceLanguage && selectedSourceLanguage.code !== 'auto' ? selectedSourceLanguage.code : 'ar';
      const azureSourceLang = convertToAzureLanguage(sourceLang);
      const azureTargetLang = convertToAzureLanguage(newTargetLanguage.code);
      
      const languageUpdateMessage = {
        type: 'language_update',
        sourceLanguage: azureSourceLang,
        targetLanguage: azureTargetLang,
        clientSideTranslation: true
      };
      wsRef.current.send(JSON.stringify(languageUpdateMessage));
      
      Logger.info('Language update message sent and cache cleared');
    }
  };

  // Real-time mode is now always enabled, no toggle needed
  
  const navigateToSummary = () => {
    Logger.info('User chose to navigate to summary page');
    
    // جمع جميع النصوص الأصلية والمترجمة
    let allOriginalText = '';
    let allTranslatedText = '';
    
    // إضافة النص المباشر إذا كان موجوداً
    if (realTimeTranscription && realTimeTranscription.trim()) {
      allOriginalText += realTimeTranscription.trim();
      if (realTimeTranslation && realTimeTranslation.trim()) {
        allTranslatedText += realTimeTranslation.trim();
      }
    }
    
    // إضافة النصوص التاريخية
    transcriptions.forEach((item, index) => {
      if (item.originalText && item.originalText.trim()) {
        if (allOriginalText) allOriginalText += '\n\n';
        allOriginalText += item.originalText.trim();
      }
      if (item.translatedText && item.translatedText.trim()) {
        if (allTranslatedText) allTranslatedText += '\n\n';
        allTranslatedText += item.translatedText.trim();
      }
    });
    
    Logger.info('Navigating to summary with data:', {
      originalLength: allOriginalText.length,
      translationLength: allTranslatedText.length,
      targetLanguage: selectedTargetLanguage?.name,
      originalPreview: allOriginalText.substring(0, 100),
      translationPreview: allTranslatedText.substring(0, 100)
    });
    
    if (!allOriginalText && !allTranslatedText) {
      Logger.warn('No text data available for summary');
      Alert.alert('Notice', 'No transcription or translation data available for summary. Please record some audio first.');
      return;
    }
    
    // التنقل مع تمرير البيانات
    router.push({
      pathname: '/summary-view',
      params: {
        transcription: allOriginalText,
        translation: allTranslatedText,
        targetLanguage: selectedTargetLanguage?.name || '',
        autoSummarize: 'true' // علامة لبدء التلخيص التلقائي
      }
    });
  };

  const dismissSummaryButton = () => {
    setShowSummaryButton(false);
    Logger.info('Summary button dismissed by user');
  };

  // دالة لحفظ النتائج في history (جدول recordings)
  const addToHistory = async (record: {
    transcription?: string;
    translation?: string;
    summary?: string;
    translationSummary?: string;
    created_at: string;
  }) => {
    try {
      if (!user) {
        Logger.warn('No user available, skipping history save');
        return;
      }
      
      Logger.info('📝 addToHistory called with:', { user_id: user.id, ...record });
      const { error } = await supabase.from('recordings').insert([
        {
          user_id: user.id,
          transcription: record.transcription || '',
          translation: record.translation || '',
          summary: record.summary || '',
          translationSummary: record.translationSummary || '',
          target_language: selectedTargetLanguage?.name || '',
          created_at: record.created_at,
        }
      ]);
      
      if (error) {
        Logger.error('❌ Supabase error:', error);
        throw error;
      }
      
      Logger.info('✅ Successfully saved to history');
    } catch (e) {
      Logger.warn('❌ Failed to save to history', e);
      // Don't throw error to avoid disrupting the flow
    }
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    setCurrentSessionText({ original: '', translation: '' });
    setShowSummaryButton(false); // Hide summary button when clearing
    
    // تنظيف AsyncStorage أيضاً - فقط في الموبايل
    if (Platform.OS !== 'web') {
      AsyncStorage.removeItem('audio_cache').catch(() => {});
      AsyncStorage.removeItem('transcription_cache').catch(() => {});
      AsyncStorage.removeItem('translation_cache').catch(() => {});
    }
    
    Logger.info('Cleared all transcriptions, current session text, and cache');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Translation</Text>
      
      {/* Language selectors - both source and target */}
      <View style={styles.languageSection}>
        {/* Source Language selector */}
        <View style={styles.languageSelector}>
          <Text style={styles.sectionLabel}>From (Source Language):</Text>
          <LanguageSelector
            selectedLanguage={selectedSourceLanguage}
            onSelectLanguage={setSelectedSourceLanguage}
            disabled={isRecording}
            title="Select Source Language"
            subtitle="Choose the language you will speak"
          />
        </View>
        
        {/* Target Language selector */}
        <View style={styles.languageSelector}>
          <Text style={styles.sectionLabel}>To (Target Language):</Text>
          <LanguageSelector
            selectedLanguage={selectedTargetLanguage}
            onSelectLanguage={handleTargetLanguageChange}
            disabled={isRecording}
            title="Select Target Language"
            subtitle="Choose the language you want to translate to"
          />
        </View>
      </View>
      
      {/* Connection status indicator */}
      <View style={styles.connectionStatusContainer}>
        {connectionStatus === 'connecting' && (
          <View style={[styles.statusIndicator, styles.connectingIndicator]}>
            <Text style={[styles.statusIndicatorText, styles.connectingIndicatorText]}>
              Connecting
            </Text>
          </View>
        )}
        
        {connectionStatus === 'connected' && (
          <View style={[styles.statusIndicator, styles.connectedIndicator]}>
            <Text style={[styles.statusIndicatorText, styles.connectedIndicatorText]}>
              {isRecording ? 'Recording' : 'Live'}
            </Text>
          </View>
        )}
        
        {connectionStatus === 'disconnected' && (
          <View style={[styles.statusIndicator, styles.disconnectedIndicator]}>
            <Text style={[styles.statusIndicatorText, styles.disconnectedIndicatorText]}>
              Offline
            </Text>
          </View>
        )}
      </View>
      
      {/* Live Translation Display - Expanded to take most screen space */}
      <View style={[styles.translationDisplay, isRecording && styles.translationDisplayRecording]}>
        <View style={[styles.translationCard, isRecording && styles.translationCardRecording]}>
          <ScrollView ref={scrollViewRef} style={styles.mainContainer}>
            
            {/* Show empty state when no content at all */}
            {transcriptions.length === 0 && !isRecording && !currentSessionText.original && (
              <Text style={styles.emptyText}>
                Start recording to see live translation!
              </Text>
            )}
            
            {/* Current session display - shows latest transcription/translation */}
            {(isRecording || currentSessionText.original) && (
              <View style={[styles.liveMainSection, isRecording && styles.liveMainSectionRecording]}>
                <View style={[styles.sideBySideContainer, isRecording && styles.sideBySideContainerRecording]}>
                  <View style={[styles.originalColumn, isRecording && styles.originalColumnRecording]}>
                    <Text style={styles.columnTitle}>Original</Text>
                    <Text style={[styles.liveStreamingText, isRecording && styles.liveStreamingTextRecording]}>
                      {isRecording ? (realTimeTranscription || 'Listening...') : (currentSessionText.original || 'No text available')}
                    </Text>
                  </View>
                  <View style={[styles.translationColumn, isRecording && styles.translationColumnRecording]}>
                    <Text style={styles.columnTitle}>Translation</Text>
                    <Text style={[styles.liveStreamingText, isRecording && styles.liveStreamingTextRecording]}>
                      {isRecording ? (realTimeTranslation || 'Translating...') : (currentSessionText.translation || 'No translation available')}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            {/* Previous transcriptions history - show when there are previous transcriptions */}
            {transcriptions.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>📋 Previous Transcriptions</Text>
                {transcriptions.slice(-3).map((item) => (
                  <View key={item.id} style={styles.historyMainItem}>
                    <View style={styles.originalMainBox}>
                      <Text style={styles.mainBoxTitle}>Original</Text>
                      <Text style={styles.historyMainText}>{item.originalText}</Text>
                    </View>
                    <View style={styles.translationMainBox}>
                      <Text style={styles.mainBoxTitle}>Translation</Text>
                      <Text style={styles.historyMainText}>{item.translatedText}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
          </ScrollView>
        </View>
      </View>
      
      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {/* Connection lost warning */}
      {connectionStatus === 'disconnected' && !isRecording && (
        <View style={styles.connectionWarningContainer}>
          <Text style={styles.connectionWarningText}>
            ⚠️ Connection lost. Please reconnect to continue using live translation.
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            (isInitializing || !selectedTargetLanguage) && styles.disabledButton
          ]}
          onPress={isRecording ? stopStreaming : startStreaming}
          disabled={isInitializing || !selectedTargetLanguage}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? 'Stop Live Streaming' : 'Start Live Streaming'}
          </Text>
        </TouchableOpacity>
        
        {transcriptions.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearTranscriptions}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* AI Summary button - shows after recording ends */}
      {showSummaryButton && !isRecording && (
        <View style={styles.summaryButtonContainer}>
          <TouchableOpacity style={styles.summaryButton} onPress={navigateToSummary}>
            <Text style={styles.summaryButtonText}>🤖 AI Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={dismissSummaryButton}>
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Reconnect button - show when connection is lost */}
      {connectionStatus === 'disconnected' && !isRecording && (
        <View style={styles.reconnectContainer}>
          <TouchableOpacity 
            style={styles.reconnectButton} 
            onPress={() => {
              Logger.info('🔄 User requested reconnection...');
              setError(null);
              // إعادة الاتصال بالسيرفر
              initializeServerConnection();
            }}
            disabled={isConnectingRef.current}
          >
            <Text style={styles.reconnectButtonText}>
              {isConnectingRef.current ? 'Connecting...' : 'Reconnect'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Status message for initialization */}
      {!isReady && !isInitializing && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {Platform.OS === 'web' 
              ? 'Audio service will be ready shortly...' 
              : 'سيتم تهيئة الصوت قريباً...'
            }
          </Text>
          <TouchableOpacity 
            style={[styles.reconnectButton, { marginTop: 10, alignSelf: 'center' }]} 
            onPress={async () => {
              try {
                setIsInitializing(true);
                setError(null);
                await initAll();
              } catch (error) {
                Logger.error('Manual audio initialization failed:', error);
                setError('فشل في تهيئة الصوت. يرجى المحاولة مرة أخرى.');
              } finally {
                setIsInitializing(false);
              }
            }}
          >
            <Text style={styles.reconnectButtonText}>
              {Platform.OS === 'web' ? 'Initialize Audio Now' : 'تهيئة الصوت الآن'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Status message while initializing */}
      {isInitializing && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {Platform.OS === 'web' 
              ? 'Setting up audio service...' 
              : 'جاري إعداد خدمة الصوت...'
            }
          </Text>
        </View>
      )}
      
      {/* Status message when ready */}
      {isReady && !isRecording && (
        <View style={[styles.statusContainer, { backgroundColor: '#e8f5e8', borderLeftColor: '#4caf50' }]}>
          <Text style={[styles.statusText, { color: '#2e7d32' }]}>
            {Platform.OS === 'web' 
              ? 'Audio service ready - you can start recording!' 
              : 'الصوت جاهز - يمكنك البدء في التسجيل!'
            }
          </Text>
        </View>
      )}
      

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  languageSection: {
    marginBottom: 10,
  },
  languageSelector: {
    marginBottom: 8,
  },
  connectionStatusContainer: {
    width: 80,
    alignItems: 'center',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  connectingIndicator: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  connectedIndicator: {
    backgroundColor: '#e8f5e8',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  disconnectedIndicator: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  statusIndicatorText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  connectingIndicatorText: {
    color: '#e65100',
  },
  connectedIndicatorText: {
    color: '#2e7d32',
  },
  disconnectedIndicatorText: {
    color: '#c62828',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    margin: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  recordButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  statusText: {
    color: '#1976d2',
    fontSize: 14,
    textAlign: 'center',
  },

  reconnectContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  reconnectButton: {
    backgroundColor: '#ff9800',
    padding: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  reconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  connectionWarningContainer: {
    backgroundColor: '#fff3cd',
    padding: 12,
    margin: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  connectionWarningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  // New styles for improved design
  translationDisplay: {
    flex: 1,
    marginVertical: 5,
  },
  translationDisplayRecording: {
    flex: 1.2, // زيادة المساحة عندما يكون التسجيل مفعلاً
  },
  translationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    margin: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 450, // زيادة الارتفاع الإجمالي للبطاقة
  },
  translationCardRecording: {
    minHeight: 550, // زيادة أكبر للارتفاع عندما يكون التسجيل مفعلاً
  },
  liveSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  originalBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    minHeight: 80,
  },
  translationBox: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
    minHeight: 80,
  },
  boxTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  liveText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    fontWeight: '500',
  },
  historyContainer: {
    maxHeight: 300,
  },
  historyItem: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 10,
  },
  historyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // AI Summary button styles
  summaryButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  summaryButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  summaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dismissButton: {
    backgroundColor: '#ff9800',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Horizontal layout styles
  horizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftBox: {
    flex: 1,
    marginRight: 8,
  },
  rightBox: {
    flex: 1,
    marginLeft: 8,
  },
  // New unified styles for single view
  mainContainer: {
    flex: 1,
    padding: 3,
  },
  liveMainSection: {
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#4caf50',
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    marginHorizontal: 2,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 400, // زيادة الارتفاع عندما يكون التسجيل مفعلاً
  },
  liveMainSectionRecording: {
    minHeight: 500, // زيادة أكبر للارتفاع عندما يكون التسجيل مفعلاً
    padding: 15, // زيادة التباعد الداخلي
  },
  liveContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  originalMainBox: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 6,
    borderLeftColor: '#2196f3',
    minHeight: 100,
  },
  translationMainBox: {
    backgroundColor: '#f0f8ff',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 6,
    borderLeftColor: '#4caf50',
    minHeight: 100,
  },
  mainBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  liveMainText: {
    fontSize: 18,
    color: '#333',
    lineHeight: 26,
    fontWeight: '600',
    minHeight: 50,
  },
  historySection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  historySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  historyMainItem: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  historyMainText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    minHeight: 40,
  },

  sideBySideContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 5,
    minHeight: 350, // زيادة الارتفاع للعمودين
  },
  sideBySideContainerRecording: {
    minHeight: 450, // زيادة أكبر للارتفاع عندما يكون التسجيل مفعلاً
  },
  originalColumn: {
    flex: 1,
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 10,
    marginRight: 3,
    minHeight: 350, // زيادة الارتفاع
    borderWidth: 1,
    borderColor: '#90caf9',
    shadowColor: '#2196f3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  originalColumnRecording: {
    minHeight: 450, // زيادة أكبر للارتفاع عندما يكون التسجيل مفعلاً
    padding: 15, // زيادة التباعد الداخلي
  },
  translationColumn: {
    flex: 1,
    backgroundColor: '#f3e5f5',
    borderRadius: 12,
    padding: 10,
    marginLeft: 3,
    minHeight: 350, // زيادة الارتفاع
    borderWidth: 1,
    borderColor: '#ce93d8',
    shadowColor: '#9c27b0',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  translationColumnRecording: {
    minHeight: 450, // زيادة أكبر للارتفاع عندما يكون التسجيل مفعلاً
    padding: 15, // زيادة التباعد الداخلي
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  liveStreamingText: {
    fontSize: 16,
    color: '#1976d2',
    lineHeight: 24,
    textAlign: 'left',
    minHeight: 300, // زيادة الارتفاع للنص
    fontWeight: '500',
  },
  liveStreamingTextRecording: {
    minHeight: 400, // زيادة أكبر للارتفاع عندما يكون التسجيل مفعلاً
    fontSize: 18, // زيادة حجم الخط قليلاً
  },

}); 