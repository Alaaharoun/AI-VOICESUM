// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراى في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert, Pressable, Animated } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useLocalSearchParams, router } from 'expo-router';
import { LanguageSelector } from '../../components/LanguageSelector';
import { SpeechService } from '../../services/speechService';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { getAudioService } from '../../services/audioService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { transcriptionEngineService } from '../../services/transcriptionEngineService';
import { EarlyConnectionService } from '../../services/earlyConnectionService';
import { StreamingService } from '../../services/streamingService';

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

export default function LiveTranslationWidthScreen() {
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
  
  // CRASH PREVENTION: Add state to prevent multiple simultaneous operations
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  
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
  const translationScrollViewRef = useRef<ScrollView>(null); // ref for translation auto-scroll
  const isConnectingRef = useRef<boolean>(false); // منع الاتصالات المتعددة
  const isTranslatingRef = useRef<Set<string>>(new Set()); // منع الترجمة المتعددة لنفس النص

  // Streaming service ref
  const streamingServiceRef = useRef<StreamingService | null>(null);

  // Add a ref to track the last Azure transcription text
  const lastAzureTextRef = useRef<string>('');

  // Add a ref to track the current accumulated transcription
  const currentAccumulatedTextRef = useRef<string>('');

  // Animated values for interactive design
  const headerHeight = useRef(new Animated.Value(1)).current; // 1 = normal, 0 = hidden
  const contentHeight = useRef(new Animated.Value(1)).current; // 1 = normal, 1.5 = expanded
  const languageOpacity = useRef(new Animated.Value(1)).current; // 1 = visible, 0 = hidden

  // إضافة ref لخدمة الاتصال المبكر
  const earlyConnectionServiceRef = useRef<EarlyConnectionService | null>(null);

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      Logger.info('🔄 Component unmounting - cleaning up resources');
      
      // Stop recording if active
      if (isRecording) {
        stopStreaming();
      }
      
      // Keep WebSocket connection open for 1 minute for potential return
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('🔗 Keeping WebSocket connection open for 1 minute for potential return');
        
        // Set timeout to close connection after 1 minute
        const closeTimeout = setTimeout(() => {
          if (wsRef.current) {
            Logger.info('🔗 Closing WebSocket connection after 1 minute timeout');
            wsRef.current.close(1000, 'Component unmounting - timeout');
            wsRef.current = null;
          }
        }, 60000); // 1 minute
        
        // Store the timeout reference for potential cleanup
        wsTimeoutRef.current = closeTimeout;
      }
      
      // Clear other timeouts
      if (chunkBufferTimeoutRef.current) {
        clearTimeout(chunkBufferTimeoutRef.current);
      }
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
      
      // Clear buffers
      chunkBufferRef.current = [];
      pendingChunksRef.current = [];
      
      Logger.info('✅ Cleanup completed - WebSocket kept open for 1 minute');
    };
  }, [isRecording]);

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
    if (transcriptions.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        translationScrollViewRef.current?.scrollToEnd({ animated: true });
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
  // Initialize streaming service
  const initializeStreamingService = async () => {
    try {
      Logger.info('Initializing streaming service...');
      
      streamingServiceRef.current = new StreamingService();
      await streamingServiceRef.current.connect(
        selectedSourceLanguage?.code || 'auto',
        selectedTargetLanguage?.code || 'en',
        await transcriptionEngineService.getCurrentEngine(),
        (transcriptionText: string) => {
          Logger.info('Real-time transcription received:', transcriptionText);
          setRealTimeTranscription(transcriptionText);
          setCurrentSessionText(prev => ({
            ...prev,
            original: transcriptionText
          }));
        },
        (translationText: string) => {
          Logger.info('Real-time translation received:', translationText);
          setRealTimeTranslation(translationText);
          setCurrentSessionText(prev => ({
            ...prev,
            translation: translationText
          }));
        }
      );
      
      Logger.info('Streaming service initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize streaming service:', error);
      setError('فشل في تهيئة خدمة الترجمة المباشرة');
    }
  };

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
    // CRASH PREVENTION: Prevent multiple simultaneous initializations
    if (isInitializing) {
      Logger.warn('⚠️ Audio service initialization already in progress');
      return;
    }
    
    try {
      setIsInitializing(true);
      setError(null);
      
      Logger.info('🎵 Initializing audio service...');
      
      // تهيئة خدمة الاتصال المبكر
      earlyConnectionServiceRef.current = EarlyConnectionService.getInstance();
      
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
      
      // التحقق من جاهزية المحرك الحالي عبر خدمة الاتصال المبكر
      const isEngineReady = await earlyConnectionServiceRef.current.isCurrentEngineReady();
      Logger.info(`[initAll] Current engine ready: ${isEngineReady}`);
      
      // Initialize WebSocket connection only if engine is Azure
      const engine = await transcriptionEngineService.getCurrentEngine();
      if (engine === 'azure') {
        Logger.info('Azure engine detected, checking pre-established connection...');
        
        // التحقق من وجود WebSocket جاهز من الاتصال المبكر
        const existingWs = earlyConnectionServiceRef.current.getAzureWebSocket();
        if (existingWs) {
          Logger.info('✅ Using pre-established Azure WebSocket connection');
          wsRef.current = existingWs;
        } else {
          Logger.info('🔄 No pre-established connection, initializing new WebSocket...');
          await initializeWebSocket();
        }
      } else {
        Logger.info('Hugging Face engine detected, skipping WebSocket initialization');
      }
      
      setIsReady(true);
      Logger.info('✅ Audio service initialized successfully with Azure-compatible settings:', audioConfig);
      Logger.info(`Using transcription engine: ${engine}`);
    } catch (error) {
      Logger.error('❌ Failed to initialize audio service:', error);
      setError('Failed to initialize audio service. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  const cleanup = () => {
    Logger.info('🧹 Starting comprehensive cleanup...');
    
    // CRASH PREVENTION: Reset all operation flags
    setIsStartingRecording(false);
    setIsStoppingRecording(false);
    setIsInitializing(false);
    
    // إعادة تعيين حالة الاتصال
    isConnectingRef.current = false;
    
    // Clear translation flags
    isTranslatingRef.current.clear();
    
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
  const sendBufferedChunks = async () => {
    Logger.info(`[sendBufferedChunks] Called with ${chunkBufferRef.current.length} chunks in buffer`);
    if (chunkBufferRef.current.length === 0) {
      Logger.warn(`[sendBufferedChunks] No chunks to send`);
      return;
    }
    
    // التحقق من المحرك المستخدم أولاً
    try {
      const currentEngine = await transcriptionEngineService.getCurrentEngine();
      Logger.info(`[sendBufferedChunks] Current engine: ${currentEngine}`);
      
      if (currentEngine === 'huggingface') {
        // Hugging Face يستخدم HTTP API
        await sendToHuggingFace();
        return;
      }
    } catch (error) {
      Logger.warn(`[sendBufferedChunks] Error checking engine, falling back to WebSocket:`, error);
    }
    
    // Azure يستخدم WebSocket
    sendToWebSocket();
  };

  // دالة إرسال البيانات إلى Hugging Face عبر HTTP API
  const sendToHuggingFace = async () => {
    const totalSize = chunkBufferRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedChunk = new Uint8Array(totalSize);
    let offset = 0;
    chunkBufferRef.current.forEach((chunk) => {
      combinedChunk.set(chunk, offset);
      offset += chunk.byteLength;
    });
    
    if (combinedChunk.byteLength === 0) {
      Logger.warn(`[sendToHuggingFace] Combined chunk is empty, skipping send`);
      chunkBufferRef.current = [];
      return;
    }
    
    try {
      Logger.info(`[sendToHuggingFace] 🚀 Sending ${combinedChunk.byteLength} bytes to Hugging Face API`);
      
      // تحويل البيانات إلى Blob
      const audioBlob = new Blob([combinedChunk], { type: 'audio/wav' });
      
      // إرسال البيانات إلى Hugging Face
      const transcription = await SpeechService.transcribeAudio(
        audioBlob,
        selectedTargetLanguage?.code || 'en',
        false // لا نستخدم VAD في الوقت الحالي
      );
      
      if (transcription) {
        Logger.info(`[sendToHuggingFace] ✅ Transcription received: "${transcription}"`);
        
        // تحديث النص المترجم
        if (isRealTimeMode) {
          setRealTimeTranscription(transcription);
          
          // ترجمة النص إذا كان مطلوباً
          if (selectedTargetLanguage?.code !== selectedSourceLanguage?.code) {
            try {
              const translation = await SpeechService.translateText(
                transcription,
                selectedSourceLanguage?.code || 'auto',
                selectedTargetLanguage?.code || 'en'
              );
              if (translation) {
                setRealTimeTranslation(translation);
                Logger.info(`[sendToHuggingFace] ✅ Translation: "${translation}"`);
              }
            } catch (translationError) {
              Logger.error(`[sendToHuggingFace] ❌ Translation failed:`, translationError);
            }
          }
        } else {
          // تحديث النص العادي
          setCurrentSessionText(prev => ({
            original: prev.original + (prev.original ? ' ' : '') + transcription,
            translation: prev.translation
          }));
        }
      }
    } catch (error) {
      Logger.error(`[sendToHuggingFace] ❌ Failed to send to Hugging Face:`, error);
      setError('Failed to transcribe audio. Please try again.');
    } finally {
      chunkBufferRef.current = [];
      Logger.info(`[sendToHuggingFace] Buffer cleared`);
    }
  };

  // دالة إرسال البيانات إلى Azure عبر WebSocket
  const sendToWebSocket = () => {
    const totalSize = chunkBufferRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedChunk = new Uint8Array(totalSize);
    let offset = 0;
    chunkBufferRef.current.forEach((chunk) => {
      combinedChunk.set(chunk, offset);
      offset += chunk.byteLength;
    });
    
    // Validate the combined chunk before sending
    if (combinedChunk.byteLength === 0) {
      Logger.warn(`[sendToWebSocket] Combined chunk is empty, skipping send`);
      chunkBufferRef.current = [];
      return;
    }
    
    // Validate audio format (16-bit samples should be even number of bytes)
    if (combinedChunk.byteLength % 2 !== 0) {
      Logger.warn(`[sendToWebSocket] ⚠️ Audio chunk size not aligned to 16-bit samples: ${combinedChunk.byteLength} bytes`);
      // Pad with zero if needed
      const paddedChunk = new Uint8Array(combinedChunk.byteLength + 1);
      paddedChunk.set(combinedChunk);
      // Use the padded chunk for sending
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && paddedChunk.byteLength > 0) {
        try {
          wsRef.current.send(paddedChunk);
          manageWebSocketTimeout();
          Logger.info(`[sendToWebSocket] ✅ Padded chunk sent successfully to Azure Speech SDK (${paddedChunk.byteLength} bytes)`);
        } catch (sendError) {
          Logger.error(`[sendToWebSocket] ❌ Failed to send padded chunk:`, sendError);
          pendingChunksRef.current.push(paddedChunk);
        }
      } else {
        pendingChunksRef.current.push(paddedChunk);
        const wsState = wsRef.current?.readyState;
        const wsStateText = wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : wsState === 3 ? 'CLOSED' : 'UNKNOWN';
        Logger.warn(`[sendToWebSocket] ⚠️ WebSocket not ready (state: ${wsState}/${wsStateText}), padded chunk stored in pending queue`);
      }
      chunkBufferRef.current = [];
      Logger.info(`[sendToWebSocket] Buffer cleared`);
      return;
    }
    
    // Only send if WebSocket is open and data is valid
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && combinedChunk.byteLength > 0) {
      try {
        // Send the Uint8Array directly, not the buffer
        wsRef.current.send(combinedChunk);
        manageWebSocketTimeout();
        Logger.info(`[sendToWebSocket] ✅ Combined chunk sent successfully to Azure Speech SDK (${combinedChunk.byteLength} bytes)`);
      } catch (sendError) {
        Logger.error(`[sendToWebSocket] ❌ Failed to send chunk:`, sendError);
        pendingChunksRef.current.push(combinedChunk);
      }
    } else {
      pendingChunksRef.current.push(combinedChunk);
      const wsState = wsRef.current?.readyState;
      const wsStateText = wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : wsState === 3 ? 'CLOSED' : 'UNKNOWN';
      Logger.warn(`[sendToWebSocket] ⚠️ WebSocket not ready (state: ${wsState}/${wsStateText}), combined chunk stored in pending queue`);
    }
    chunkBufferRef.current = [];
    Logger.info(`[sendToWebSocket] Buffer cleared`);
  };

  // Initialize WebSocket connection
  const initializeWebSocket = async () => {
    // CRASH PREVENTION: Additional safeguard for WebSocket initialization
    if (isConnectingRef.current || isStartingRecording || isStoppingRecording) {
      Logger.warn('⚠️ WebSocket initialization blocked: Connection in progress or recording operation active');
      return;
    }
    
    try {
      // منع الاتصالات المتعددة المتزامنة
      if (isConnectingRef.current) {
        Logger.warn('⚠️ Connection already in progress, skipping to prevent parallel connections');
        return;
      }
      
      // إذا كان الاتصال مفتوح بالفعل، لا نحتاج لإنشاء جديد
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('✅ WebSocket already connected and ready, skipping initialization');
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
      
      // الحصول على المحرك الحالي وعنوان WebSocket المناسب
      let wsUrl: string;
      let connectionMessage: string;
      
      try {
        const engine = await transcriptionEngineService.getCurrentEngine();
        connectionMessage = await transcriptionEngineService.getConnectionMessage();
        Logger.info(`🚀 Using transcription engine: ${engine}`);
        
        if (engine === 'huggingface') {
          // Hugging Face لا يستخدم WebSocket، لذا نستخدم HTTP API
          Logger.info('🔄 Hugging Face engine detected - using HTTP API instead of WebSocket');
          isConnectingRef.current = false;
          return; // لا نحتاج لإنشاء WebSocket
        } else {
          // Azure يستخدم WebSocket
          wsUrl = await transcriptionEngineService.getWebSocketURL();
        }
      } catch (error) {
        Logger.warn('⚠️ Error getting engine config:', error);
        
        // في حالة الخطأ، نتحقق من المحرك مرة أخرى
        try {
          const fallbackEngine = await transcriptionEngineService.getCurrentEngine();
          if (fallbackEngine === 'huggingface') {
            Logger.info('🔄 Fallback: Hugging Face engine detected - using HTTP API instead of WebSocket');
            isConnectingRef.current = false;
            return; // لا نحتاج لإنشاء WebSocket
          }
        } catch (fallbackError) {
          Logger.warn('⚠️ Fallback engine check failed:', fallbackError);
        }
        
        // فقط إذا لم يكن Hugging Face، نستخدم WebSocket الافتراضي
        wsUrl = 'wss://ai-voicesum.onrender.com/ws';
        connectionMessage = 'Connecting to Azure Speech...';
      }
      
      Logger.info(`🚀 ${connectionMessage}`);
      
      // إنشاء اتصال WebSocket جديد
      const ws = new WebSocket(wsUrl);
      
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
        
        // Send initialization message
        const initMessage = {
          type: 'init',
          language: azureSourceLang || 'auto',
          targetLanguage: azureTargetLang,
          clientSideTranslation: true,
          realTimeMode: true,
          autoDetection: azureSourceLang === null,
          audioConfig: {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            encoding: 'pcm_s16le'
          }
        };
        
        Logger.info('📤 Sending init message:', JSON.stringify(initMessage, null, 2));
        ws.send(JSON.stringify(initMessage));
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
              Logger.info(`Processing ${data.type} transcription:`, data.text);
              
              if (isRealTimeMode) {
                // Handle real-time mode - update immediately
                if (data.type === 'transcription') {
                  // Partial result - update real-time display immediately
                  appendNewTranscriptionSegment(data.text);
                  
                  // Update current session text with the accumulated transcription
                  setCurrentSessionText(current => ({
                    ...current,
                    original: currentAccumulatedTextRef.current
                  }));
                  
                  // Trigger live translation for partial results too
                  translatePartialText(data.text);
                  
                } else if (data.type === 'final') {
                  // Final result - update transcription and translate
                  appendNewTranscriptionSegment(data.text);
                  
                  // Update current session text with the accumulated transcription
                  setCurrentSessionText(current => ({
                    ...current,
                    original: currentAccumulatedTextRef.current
                  }));
                  
                  // Translate the final result
                  translateFinalText(data.text);
                }
                
                // Add to history only for final results to avoid duplicates
                if (data.type === 'final') {
                  addToHistoryIfNew(data.text);
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
                  
                  // Scroll to bottom to show new translation
                  scrollToBottom();
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
                  
                  // Scroll to bottom to show fallback text
                  scrollToBottom();
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
            
            // تحسين معالجة الأخطاء - تحقق أكثر دقة من نوع الخطأ
            const errorMessage = data.error || '';
            const errorCode = data.errorCode || 0;
            const reason = data.reason || 0;
            
            // تحقق من نوع الخطأ بدقة أكبر
            if (errorMessage.includes('Quota exceeded') && errorCode === 2) {
              // هذا خطأ Quota exceeded حقيقي من Azure
              setError('Azure Speech Service quota exceeded. Please wait a few minutes before trying again, or upgrade your Azure subscription.');
              Logger.warn('⚠️ Confirmed Azure quota exceeded error');
              
              // Stop recording immediately when quota is exceeded
              if (isRecording) {
                Logger.warn('Stopping recording due to quota exceeded error');
                stopStreaming();
              }
              // Close WebSocket connection to prevent further quota usage
              if (wsRef.current) {
                wsRef.current.close(1000, 'Quota exceeded');
              }
            } else if (errorMessage.includes('websocket error code: 1007') || errorCode === 1007) {
              // هذا خطأ في تنسيق البيانات، وليس Quota exceeded
              setError('Connection error: Invalid audio format. Please try again.');
              Logger.warn('⚠️ WebSocket 1007 error - audio format issue, not quota');
              
              // For 1007 errors, try to reconnect once
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                Logger.info('Attempting to reconnect after 1007 error...');
                wsRef.current.close(1000, 'Reconnecting after 1007 error');
                setTimeout(() => {
                  if (isRecording && !isConnectingRef.current) {
                    initializeWebSocket();
                  }
                }, 2000);
              }
            } else if (errorMessage.includes('Recognition canceled') && reason === 0) {
              // هذا خطأ في التعرف على الكلام، وليس Quota exceeded
              setError('Speech recognition failed. Please try speaking more clearly.');
              Logger.warn('⚠️ Recognition canceled - speech issue, not quota');
            } else {
              // خطأ عام آخر
              setError(`خطأ في السيرفر: ${errorMessage}`);
              Logger.warn('⚠️ General server error:', errorMessage);
            }
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
        
        // Handle different close codes
        if (event.code === 1011) {
          Logger.warn('⚠️ Server terminated connection - likely due to concurrent limit or quota exceeded');
          setError('Server connection limit reached or quota exceeded. Please wait before reconnecting.');
          // Don't attempt to reconnect for quota/concurrent limit issues
        } else if (event.code === 1000 && event.reason === 'Quota exceeded') {
          Logger.warn('⚠️ Connection closed due to quota exceeded');
          setError('Azure Speech Service quota exceeded. Please wait a few minutes before trying again.');
          // Don't attempt to reconnect for quota issues
        } else if (event.code === 1007) {
          Logger.warn('⚠️ Connection closed due to invalid data format (1007)');
          setError('Audio format error. Please try again.');
          // Don't attempt to reconnect for format issues
        } else if (event.code === 1000 && event.reason === 'Reconnecting after 1007 error') {
          Logger.info('🔄 Connection closed for 1007 error reconnection');
          // This will be handled by the setTimeout in the error handler
        } else if (event.code !== 1000 && isRecording && !isConnectingRef.current) {
          Logger.info('🔄 Attempting to reconnect after unexpected disconnect...');
          setTimeout(() => {
            if (isRecording && !isConnectingRef.current) {
              initializeWebSocket();
            }
          }, 3000); // زيادة وقت الانتظار لتجنب الاتصالات السريعة
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
    // CRASH PREVENTION: Multiple safeguards to prevent race conditions
    if (isRecording || isStartingRecording || isStoppingRecording) {
      Logger.warn('⚠️ Operation blocked: Already recording, starting, or stopping');
      return;
    }
    
    // CRASH PREVENTION: Set flag immediately to prevent multiple calls
    setIsStartingRecording(true);
    
    try {
      Logger.info('🎙️ Starting real-time streaming...');
      setShowSummaryButton(false); // Hide summary button when starting new recording
      
      // Reset state for new recording session
      setError(null);
      setIsRecording(false);
      setIsReady(false);
      
      // 1. تأكد أن السيرفر متصل
      if (connectionStatus !== 'connected') {
        Logger.info('Server not connected, initializing connection...');
        await initializeServerConnection();
        // انتظار قصير للتأكد من الاتصال
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 2. تهيئة خدمة الـstreaming
      Logger.info('Initializing streaming service...');
      await initializeStreamingService();
      
      // 3. إذا لم يكن AudioService جاهزًا، هيئه
      if (!isReady || !audioServiceRef.current) {
        Logger.info('Audio service not ready, initializing...');
        setIsInitializing(true);
        try {
          await initAll();
          // Wait a bit for initialization to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          Logger.error('Failed to initialize audio service:', error);
          setError('فشل في تهيئة الصوت. يرجى المحاولة مرة أخرى.');
          setIsInitializing(false);
          return;
        } finally {
          setIsInitializing(false);
        }
      }
      
      // CRASH PREVENTION: Ensure audio service exists and is ready
      if (!audioServiceRef.current) {
        Logger.error('❌ Audio service not available');
        setError('Audio service not available. Please try again.');
        return;
      }
      
      // إزالة المستمعين القديمة لتجنب التراكم
      audioServiceRef.current.removeAllListeners();
      
      // CRASH PREVENTION: Safe audio start with error handling
      try {
        await audioServiceRef.current.start();
        Logger.info('✅ Audio recording started successfully');
        
        // Trigger animation to recording mode
        animateToRecordingMode();
        
        setIsRecording(true);
        Logger.info('🎙️ Recording session started successfully');
      } catch (audioError) {
        Logger.error('❌ Failed to start audio recording:', audioError);
        setError('Failed to start audio recording. Please check microphone permissions.');
        return;
      }
      
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
        
        // إرسال البيانات مباشرة إلى خدمة الـstreaming
        if (streamingServiceRef.current) {
          streamingServiceRef.current.sendAudioChunk(raw);
          Logger.info(`[onData] 🚀 Sent chunk to streaming service: ${raw.byteLength} bytes`);
        } else {
          Logger.warn(`[onData] ⚠️ Streaming service not available, falling back to buffer`);
          // Fallback to old method if streaming service is not available
          chunkBufferRef.current.push(raw);
          Logger.info(`[onData] 📦 Added chunk to buffer. Buffer now has ${chunkBufferRef.current.length} chunks`);
          
          // تحديد استراتيجية الإرسال بناءً على حجم البيانات
          const bufferSize = chunkBufferRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
          const targetBufferSize = 32000; // ~1 second of 16kHz 16-bit mono audio
          
          // إرسال البيانات فوراً عند الوصول للحجم المطلوب
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
          
          // لا نستخدم timeout في الترجمة الفورية
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
        lastAzureTextRef.current = ''; // Clear the last Azure text reference for new session
        currentAccumulatedTextRef.current = ''; // Clear the accumulated text reference for new session
        Logger.info('[startStreaming] 🔴 Real-time mode: Cleared real-time data for new recording (keeping current session text)');
      }
      
      // Check if WebSocket connection is still open and usable
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('[startStreaming] 🔗 WebSocket connection is still open and usable - reusing it');
        // Don't close the connection, just clear the buffers
      } else if (wsRef.current) {
        // Close if exists but not in OPEN state
        wsRef.current.close(1000, 'Starting new recording session');
        wsRef.current = null;
        Logger.info('[startStreaming] 🔄 Closed existing WebSocket connection for fresh start');
      }
      
      // Clear all timeouts and buffers for fresh start
      if (chunkBufferTimeoutRef.current) {
        clearTimeout(chunkBufferTimeoutRef.current);
        chunkBufferTimeoutRef.current = null;
      }
      if (wsTimeoutRef.current) {
        clearTimeout(wsTimeoutRef.current);
        wsTimeoutRef.current = null;
      }
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
        translationTimeoutRef.current = null;
      }
      
      // Clear all buffers
      chunkBufferRef.current = [];
      pendingChunksRef.current = [];
      isTranslatingRef.current.clear();
      
      Logger.info('[startStreaming] 🧹 Cleared all timeouts and buffers for fresh start');
      
      Logger.info(`[startStreaming] ✅ Live streaming started successfully (Real-time mode: ${isRealTimeMode})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to start streaming:', errorMessage);
      
      // تحسين معالجة الأخطاء في startStreaming
      if (errorMessage.includes('Quota exceeded') && errorMessage.includes('errorCode: 2')) {
        // خطأ Quota exceeded مؤكد
        setError('Azure Speech Service quota exceeded. Please wait a few minutes before trying again.');
        Logger.warn('⚠️ Confirmed quota exceeded error in startStreaming');
      } else if (errorMessage.includes('websocket error code: 1007')) {
        // خطأ في تنسيق البيانات
        setError('Audio format error. Please try again.');
        Logger.warn('⚠️ Audio format error (1007) in startStreaming');
      } else if (errorMessage.includes('Recognition canceled')) {
        // خطأ في التعرف على الكلام
        setError('Speech recognition failed. Please try speaking more clearly.');
        Logger.warn('⚠️ Recognition canceled in startStreaming');
      } else {
        setError(`فشل في بدء التسجيل: ${errorMessage}`);
        Logger.warn('⚠️ General error in startStreaming:', errorMessage);
      }
      
      setIsRecording(false);
    } finally {
      // CRASH PREVENTION: Always reset the starting flag
      setIsStartingRecording(false);
    }
  };

  // Helper function for retrying startStreaming
  const startStreamingWithRetry = async (retryCount = 0) => {
    if (retryCount === 0) {
      // First attempt - call the main function
      await startStreaming();
    } else {
      // Retry attempt
      Logger.info(`🔄 Retry attempt ${retryCount} for startStreaming`);
      try {
        // Clear any existing connections
        if (wsRef.current) {
          wsRef.current.close(1000, 'Retry attempt');
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry the streaming
        await startStreaming();
      } catch (error) {
        Logger.error(`Retry attempt ${retryCount} failed:`, error);
        if (retryCount < 2) {
          const retryDelay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            if (!isRecording && !isStartingRecording) {
              startStreamingWithRetry(retryCount + 1);
            }
          }, retryDelay);
        }
      }
    }
  };

  const stopStreaming = async () => {
    // CRASH PREVENTION: Multiple safeguards to prevent race conditions
    if (!isRecording || isStoppingRecording || isStartingRecording) {
      Logger.warn('⚠️ Stop operation blocked: Not recording, already stopping, or starting');
      return;
    }
    
    // CRASH PREVENTION: Set flag immediately to prevent multiple calls
    setIsStoppingRecording(true);
    
    try {
      Logger.info('Stopping real-time streaming...');
      
      // إيقاف خدمة الـstreaming
      if (streamingServiceRef.current) {
        streamingServiceRef.current.stopStreaming();
        Logger.info('✅ Streaming service stopped successfully');
      }
      
      // إرسال أي chunks متبقية في الـbuffer قبل الإيقاف (fallback)
      if (chunkBufferRef.current.length > 0) {
        Logger.info(`[stopStreaming] 📤 Sending remaining ${chunkBufferRef.current.length} chunks before stopping`);
        sendBufferedChunks();
      }
      
      // CRASH PREVENTION: Safe audio stop with error handling
      if (audioServiceRef.current && isReady) {
        try {
          await audioServiceRef.current.stop();
          Logger.info('✅ Audio service stopped successfully');
        } catch (audioError) {
          Logger.error('❌ Error stopping audio service:', audioError);
          // Don't throw error to avoid disrupting the flow
        }
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
      
      // Trigger animation back to normal mode
      animateToNormalMode();
      
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
          
          // Show AI Summary button if there's content
          const hasContent = (realTimeTranscription && realTimeTranscription.trim()) || 
                           (currentSessionText.original && currentSessionText.original.trim()) ||
                           transcriptions.length > 0;
          
          if (hasContent) {
            Logger.info('Showing AI Summary button - content available');
            setShowSummaryButton(true);
          } else {
            Logger.info('No content available - not showing AI Summary button');
          }
        }
      }, 1000); // Wait 1 second for any final transcriptions
      
    } catch (error) {
      Logger.error('Failed to stop streaming:', error);
    } finally {
      // CRASH PREVENTION: Always reset the stopping flag
      setIsStoppingRecording(false);
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
      const { error: supabaseError } = await supabase.from('recordings').insert([
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
      
      if (supabaseError) {
        Logger.error('❌ Supabase error:', supabaseError);
        throw supabaseError;
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

  // Function to scroll both columns to bottom smoothly
  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      translationScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Test function to manually test the translation pipeline
  const testTranslation = async () => {
    try {
      Logger.info('🧪 Testing translation pipeline...');
      const testText = 'Hello, this is a test message';
      
      // Add test transcription
      const testItem: TranscriptionItem = {
        id: Date.now().toString(),
        originalText: testText,
        translatedText: '',
        timestamp: new Date()
      };
      
      setTranscriptions(prev => [...prev, testItem]);
      
      // Test translation
      const translatedText = await SpeechService.translateText(
        testText,
        selectedTargetLanguage?.code || 'ar',
        selectedSourceLanguage?.code
      );
      
      Logger.info('🧪 Test translation result:', translatedText);
      
      // Update the test item
      setTranscriptions(prev => 
        prev.map(item => 
          item.id === testItem.id 
            ? { ...item, translatedText } 
            : item
        )
      );
      
      Logger.info('✅ Test translation completed successfully');
    } catch (error) {
      Logger.error('❌ Test translation failed:', error);
      setError(`Test translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Helper to append only new segments to the transcription
  function appendNewTranscriptionSegment(newText: string) {
    // Remove leading/trailing whitespace
    newText = newText.trim();
    if (!newText) return;

    // If the new text is a prefix of the last, ignore (no new content)
    if (lastAzureTextRef.current && newText.startsWith(lastAzureTextRef.current)) {
      // Only append the new segment
      const newSegment = newText.slice(lastAzureTextRef.current.length).trim();
      if (newSegment) {
        const accumulatedText = currentAccumulatedTextRef.current ? currentAccumulatedTextRef.current + ' ' + newSegment : newSegment;
        setRealTimeTranscription(accumulatedText);
        currentAccumulatedTextRef.current = accumulatedText;
        lastAzureTextRef.current = newText;
      }
      return;
    }
    // If the new text is shorter (Azure reset), just append as new
    if (newText.length < lastAzureTextRef.current.length) {
      const accumulatedText = currentAccumulatedTextRef.current ? currentAccumulatedTextRef.current + '\n' + newText : newText;
      setRealTimeTranscription(accumulatedText);
      currentAccumulatedTextRef.current = accumulatedText;
      lastAzureTextRef.current = newText;
      return;
    }
    // If the new text is different, append only the new part
    if (lastAzureTextRef.current && newText !== lastAzureTextRef.current) {
      const diff = newText.replace(lastAzureTextRef.current, '').trim();
      if (diff) {
        const accumulatedText = currentAccumulatedTextRef.current ? currentAccumulatedTextRef.current + ' ' + diff : diff;
        setRealTimeTranscription(accumulatedText);
        currentAccumulatedTextRef.current = accumulatedText;
      }
      lastAzureTextRef.current = newText;
      return;
    }
    // First time or fallback
    setRealTimeTranscription(newText);
    currentAccumulatedTextRef.current = newText;
    lastAzureTextRef.current = newText;
  }

  // Helper to translate partial text for live updates
  const translatePartialText = async (text: string) => {
    try {
      // Prevent duplicate translation requests
      if (isTranslatingRef.current.has(text)) {
        Logger.warn('Partial translation already in progress for:', text);
        return;
      }
      
      isTranslatingRef.current.add(text);
      Logger.info('Translating partial text:', text, 'to:', selectedTargetLanguage?.code);
      
      const translatedText = await SpeechService.translateText(
        text, 
        selectedTargetLanguage?.code || 'ar',
        selectedSourceLanguage?.code
      );
      
      Logger.info('Partial translation result:', translatedText);
      
      // Update real-time translation
      setRealTimeTranslation(translatedText);
      
      // Update current session translation by accumulating
      setCurrentSessionText(current => {
        const currentTranslation = current.translation || '';
        const newTranslation = currentTranslation ? currentTranslation + ' ' + translatedText : translatedText;
        return {
          ...current,
          translation: newTranslation
        };
      });
      
      // Scroll to bottom to show new translation
      scrollToBottom();
      
    } catch (translationError) {
      Logger.error('Partial translation failed:', translationError);
      
      // Show translating indicator on error
      setRealTimeTranslation('Translating...');
      
    } finally {
      // Remove from translating set
      isTranslatingRef.current.delete(text);
    }
  };

  // Helper to translate final text and update UI
  const translateFinalText = async (text: string) => {
    try {
      // Prevent duplicate translation requests
      if (isTranslatingRef.current.has(text)) {
        Logger.warn('Translation already in progress for:', text);
        return;
      }
      
      isTranslatingRef.current.add(text);
      Logger.info('Translating final text:', text, 'to:', selectedTargetLanguage?.code);
      
      const translatedText = await SpeechService.translateText(
        text, 
        selectedTargetLanguage?.code || 'ar',
        selectedSourceLanguage?.code
      );
      
      Logger.info('Final translation result:', translatedText);
      
      // Update real-time translation
      setRealTimeTranslation(translatedText);
      
      // Update current session translation by accumulating
      setCurrentSessionText(current => {
        const currentTranslation = current.translation || '';
        const newTranslation = currentTranslation ? currentTranslation + ' ' + translatedText : translatedText;
        return {
          ...current,
          translation: newTranslation
        };
      });
      
      // Scroll to bottom to show new translation
      scrollToBottom();
      
    } catch (translationError) {
      Logger.error('Final translation failed:', translationError);
      
      // Fallback to original text
      setRealTimeTranslation(text);
      
      // Update current session translation with fallback
      setCurrentSessionText(current => {
        const currentTranslation = current.translation || '';
        const newTranslation = currentTranslation ? currentTranslation + ' ' + text : text;
        return {
          ...current,
          translation: newTranslation
        };
      });
      
      // Scroll to bottom to show fallback text
      scrollToBottom();
    } finally {
      // Remove from translating set
      isTranslatingRef.current.delete(text);
    }
  };

  // Helper to add new transcription to history without duplicates
  const addToHistoryIfNew = (text: string) => {
    // The accumulation is now handled by appendNewTranscriptionSegment
    // This function is called for final results to ensure the current session is properly updated
    setCurrentSessionText(current => ({
      ...current,
      original: currentAccumulatedTextRef.current
    }));
    
    Logger.info('Updated current session with accumulated transcription:', currentAccumulatedTextRef.current);
  };

  // Animation functions for interactive design
  const animateToRecordingMode = () => {
    Animated.parallel([
      Animated.timing(headerHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(contentHeight, {
        toValue: 1.5, // تقليل من 2 إلى 1.5 لتجنب الـ overflow
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(languageOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const animateToNormalMode = () => {
    Animated.parallel([
      Animated.timing(headerHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(contentHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(languageOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#F9FAFB',
      minHeight: '100%',
      height: '100%',
      overflow: 'hidden' // منع الـ overflow
    }}> 
      {/* Header - Landscape Layout */}
      <Animated.View style={{ 
        backgroundColor: '#fff', 
        shadowColor: '#000', 
        shadowOpacity: 0.04, 
        shadowRadius: 2, 
        borderBottomWidth: 1, 
        borderBottomColor: '#E5E7EB', 
        paddingHorizontal: 16, 
        paddingVertical: 8,
        flexShrink: 0,
        height: headerHeight.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 65] // تقليل من 80 إلى 65
        }),
        opacity: headerHeight,
        overflow: 'hidden',
        zIndex: 1000, // إضافة z-index عالي
        elevation: 10 // للأندرويد
      }}> 
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Live Translation</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/live-translation')}
              style={{
                backgroundColor: '#F3F4F6',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Icon name="view-column" size={12} color="#6B7280" style={{ marginRight: 3 }} />
              <Text style={{ color: '#6B7280', fontSize: 10, fontWeight: '600' }}>Column View</Text>
            </TouchableOpacity>
            
            {/* Test Translation Button */}
            {!isRecording && (
              <TouchableOpacity
                onPress={testTranslation}
                style={{
                  backgroundColor: '#10B981',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 10,
                  shadowColor: '#10B981',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: '#34D399',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>🧪 Test</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Language Selection - Horizontal Layout */}
        <Animated.View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          gap: 12,
          opacity: languageOpacity,
          zIndex: 999, // إضافة z-index عالي
          elevation: 9 // للأندرويد
        }}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <LanguageSelector
              selectedLanguage={selectedSourceLanguage}
              onSelectLanguage={setSelectedSourceLanguage}
              disabled={isRecording}
              title="Source Language"
              subtitle="Language you will speak"
            />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <LanguageSelector
              selectedLanguage={selectedTargetLanguage}
              onSelectLanguage={handleTargetLanguageChange}
              disabled={isRecording}
              title="Target Language"
              subtitle="Language to translate to"
            />
          </View>
          
          {/* Live Connection Status Indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}> 
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: connectionStatus === 'connected' ? '#ECFDF5' : '#FEF2F2', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 999, 
              borderWidth: 1, 
              borderColor: connectionStatus === 'connected' ? '#10B981' : '#EF4444' 
            }}> 
              <View style={{ 
                width: 5, 
                height: 5, 
                backgroundColor: connectionStatus === 'connected' ? '#10B981' : '#EF4444', 
                borderRadius: 2.5, 
                marginRight: 4 
              }} />
              <Text style={{ 
                fontWeight: '500', 
                color: connectionStatus === 'connected' ? '#10B981' : '#EF4444', 
                fontSize: 10 
              }}>
                {connectionStatus === 'connected' ? 'Live' : 'Offline'}
              </Text>
            </View>
            {connectionStatus !== 'connected' && (
              <TouchableOpacity
                onPress={initializeServerConnection}
                style={{ 
                  marginLeft: 6, 
                  backgroundColor: '#3B82F6', 
                  paddingHorizontal: 8, 
                  paddingVertical: 4, 
                  borderRadius: 6 
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '500', fontSize: 10 }}>Reconnect</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>

      {/* Main Content - Landscape Layout with Full Height */}
      <Animated.View style={{ 
        flex: 1, 
        flexDirection: 'row', 
        paddingHorizontal: 16, 
        paddingTop: contentHeight.interpolate({
          inputRange: [1, 1.5],
          outputRange: [12, 6] // إضافة تباعد من الأعلى
        }),
        paddingBottom: contentHeight.interpolate({
          inputRange: [1, 1.5],
          outputRange: [6, 2] // تقليل التباعد أكثر
        }),
        minHeight: 0,
        maxHeight: '100%', // إضافة maxHeight
        height: contentHeight.interpolate({
          inputRange: [1, 1.5],
          outputRange: ['100%', '110%'] // تقليل من 120% إلى 110%
        }),
        zIndex: 1, // z-index منخفض للمحتوى
        elevation: 1, // للأندرويد
        overflow: 'hidden' // منع الـ overflow
      }}>
        {/* Original Text Section - Left Side (50% width) */}
        <View style={{ 
          width: '50%',
          marginRight: 6,
          backgroundColor: '#F8FAFC', 
          borderRadius: 16, 
          borderWidth: 2,
          borderColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
          flexDirection: 'column',
          height: '100%',
          zIndex: 1, // z-index منخفض
          overflow: 'hidden' // منع الـ overflow
        }}> 
          <View style={{ 
            backgroundColor: '#3B82F6', 
            paddingHorizontal: 14, 
            paddingVertical: 10, 
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}> 
            <View style={{ flexDirection: 'row', alignItems: 'center' }}> 
              <Icon name="volume-high" size={18} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', marginLeft: 8 }}>Original</Text>
              <Text style={{ fontSize: 10, color: '#E0E7FF', marginLeft: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                {selectedSourceLanguage?.name || 'Auto-detect'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, backgroundColor: connectionStatus === 'connected' ? '#10B981' : '#EF4444', borderRadius: 4, marginRight: 6 }} />
              <Text style={{ fontWeight: '500', color: '#fff', fontSize: 10 }}>
                {connectionStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          <ScrollView 
            ref={scrollViewRef}
            style={{ 
              flex: 1, 
              padding: contentHeight.interpolate({
                inputRange: [1, 2],
                outputRange: [12, 8] // أقل تباعد عند التسجيل
              })
            }} 
            contentContainerStyle={{ 
              flexGrow: 1, 
              paddingBottom: contentHeight.interpolate({
                inputRange: [1, 2],
                outputRange: [12, 8] // أقل تباعد عند التسجيل
              })
            }}
            showsVerticalScrollIndicator={true}
          > 
            {transcriptions.length === 0 && !isRecording && !currentSessionText.original ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 150, paddingVertical: 20 }}> 
                <Icon name="microphone" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', fontWeight: '500' }}>Start recording to see original text</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 6 }}>Tap the microphone button below</Text>
              </View>
            ) : (
              <View style={{ 
                backgroundColor: '#fff', 
                borderRadius: 12, 
                padding: 16, 
                shadowColor: '#000', 
                shadowOpacity: 0.08, 
                shadowRadius: 4, 
                borderWidth: 1, 
                borderColor: '#E5E7EB', 
                minHeight: 120,
                height: '100%'
              }}>
                {/* Current Session Text - Main Content Area */}
                {(currentSessionText.original || realTimeTranscription) && (
                  <View style={{ 
                    backgroundColor: '#F0F9FF', 
                    padding: 12, 
                    borderRadius: 12, 
                    marginBottom: currentSessionText.original && transcriptions.length > 0 ? 12 : 0,
                    borderLeftWidth: 4,
                    borderLeftColor: '#3B82F6',
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                    flex: 1
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ 
                        width: 10, 
                        height: 10, 
                        backgroundColor: isRecording ? '#EF4444' : '#10B981', 
                        borderRadius: 5, 
                        marginRight: 8,
                        shadowColor: isRecording ? '#EF4444' : '#10B981',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                      }} />
                      <Text style={{ fontSize: 12, color: '#374151', fontWeight: '700', textTransform: 'uppercase' }}>
                        {isRecording ? '🔴 LIVE' : '📝 CURRENT'}
                      </Text>
                      {(currentSessionText.original || realTimeTranscription) && (
                        <TouchableOpacity
                          onPress={() => Clipboard.setString(currentSessionText.original || realTimeTranscription || '')}
                          style={{ 
                            marginLeft: 'auto', 
                            padding: 6, 
                            borderRadius: 6,
                            backgroundColor: '#F3F4F6',
                            borderWidth: 1,
                            borderColor: '#E5E7EB'
                          }}
                        >
                          <Icon name="content-copy" size={14} color="#6B7280" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={{ 
                      color: '#111827', 
                      fontSize: 14, 
                      lineHeight: 20, 
                      fontWeight: '500',
                      textAlign: selectedSourceLanguage?.code === 'ar' ? 'right' : 'left',
                      writingDirection: selectedSourceLanguage?.code === 'ar' ? 'rtl' : 'ltr',
                      minHeight: 60,
                      flex: 1
                    }}>
                      {currentSessionText.original || realTimeTranscription}
                    </Text>
                  </View>
                )}
                
                {/* Previous Sessions - Only show if there are previous sessions and no current session */}
                {transcriptions.length > 0 && !currentSessionText.original && !realTimeTranscription && (
                  <>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>Previous Sessions:</Text>
                    </View>
                    {transcriptions.map((block, index) => (
                      <View key={`original-${block.id}`} style={{ marginBottom: index < transcriptions.length - 1 ? 12 : 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '500' }}>
                            {new Date(block.timestamp).toLocaleTimeString()}
                          </Text>
                          <TouchableOpacity
                            onPress={() => Clipboard.setString(block.originalText)}
                            style={{ marginLeft: 'auto', padding: 3, borderRadius: 3 }}
                          >
                            <Icon name="content-copy" size={12} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                        <Text style={{ 
                          color: '#111827', 
                          fontSize: 12, 
                          lineHeight: 18, 
                          fontWeight: '500',
                          textAlign: selectedSourceLanguage?.code === 'ar' ? 'right' : 'left',
                          writingDirection: selectedSourceLanguage?.code === 'ar' ? 'rtl' : 'ltr'
                        }}>
                          {block.originalText}
                        </Text>
                        {index < transcriptions.length - 1 && (
                          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 12 }} />
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
        
        {/* Translation Section - Right Side (50% width) */}
        <View style={{ 
          width: '50%',
          marginLeft: 6,
          backgroundColor: '#F8FAFC', 
          borderRadius: 16, 
          borderWidth: 2,
          borderColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
          flexDirection: 'column',
          height: '100%',
          zIndex: 1, // z-index منخفض
          overflow: 'hidden' // منع الـ overflow
        }}> 
          <View style={{ 
            backgroundColor: '#10B981', 
            paddingHorizontal: 14, 
            paddingVertical: 10, 
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}> 
            <View style={{ flexDirection: 'row', alignItems: 'center' }}> 
              <Icon name="translate" size={18} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', marginLeft: 8 }}>Translation</Text>
              <Text style={{ fontSize: 10, color: '#D1FAE5', marginLeft: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                {selectedTargetLanguage?.name || 'Select Language'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="sync" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={{ fontWeight: '500', color: '#fff', fontSize: 10 }}>
                REAL-TIME
              </Text>
            </View>
          </View>
          <ScrollView 
            ref={translationScrollViewRef}
            style={{ 
              flex: 1, 
              padding: contentHeight.interpolate({
                inputRange: [1, 2],
                outputRange: [12, 8] // أقل تباعد عند التسجيل
              })
            }} 
            contentContainerStyle={{ 
              flexGrow: 1, 
              paddingBottom: contentHeight.interpolate({
                inputRange: [1, 2],
                outputRange: [12, 8] // أقل تباعد عند التسجيل
              })
            }}
            showsVerticalScrollIndicator={true}
          > 
            {transcriptions.length === 0 && !isRecording && !currentSessionText.original ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 150, paddingVertical: 20 }}> 
                <Icon name="translate" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', fontWeight: '500' }}>Translations will appear here</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 6 }}>Start recording to see real-time translations</Text>
              </View>
            ) : (
              <View style={{ 
                backgroundColor: '#fff', 
                borderRadius: 12, 
                padding: 16, 
                shadowColor: '#000', 
                shadowOpacity: 0.08, 
                shadowRadius: 4, 
                borderWidth: 1, 
                borderColor: '#E5E7EB', 
                minHeight: 120,
                height: '100%'
              }}>
                {/* Current Session Translation - Main Content Area */}
                {(currentSessionText.translation || realTimeTranslation) && (
                  <View style={{ 
                    backgroundColor: '#F0FDF4', 
                    padding: 12, 
                    borderRadius: 12, 
                    marginBottom: currentSessionText.translation && transcriptions.length > 0 ? 12 : 0,
                    borderLeftWidth: 4,
                    borderLeftColor: '#10B981',
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                    flex: 1
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ 
                        width: 10, 
                        height: 10, 
                        backgroundColor: isRecording ? '#EF4444' : '#10B981', 
                        borderRadius: 5, 
                        marginRight: 8,
                        shadowColor: isRecording ? '#EF4444' : '#10B981',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                      }} />
                      <Text style={{ fontSize: 12, color: '#374151', fontWeight: '700', textTransform: 'uppercase' }}>
                        {isRecording ? '🔴 LIVE' : '🌐 CURRENT'}
                      </Text>
                      {(currentSessionText.translation || realTimeTranslation) && (
                        <TouchableOpacity
                          onPress={() => Clipboard.setString(currentSessionText.translation || realTimeTranslation || '')}
                          style={{ 
                            marginLeft: 'auto', 
                            padding: 6, 
                            borderRadius: 6,
                            backgroundColor: '#F3F4F6',
                            borderWidth: 1,
                            borderColor: '#E5E7EB'
                          }}
                        >
                          <Icon name="content-copy" size={14} color="#10B981" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={{ 
                      color: '#111827', 
                      fontSize: 14, 
                      lineHeight: 20, 
                      fontWeight: '500',
                      textAlign: selectedTargetLanguage?.code === 'ar' ? 'right' : 'left',
                      writingDirection: selectedTargetLanguage?.code === 'ar' ? 'rtl' : 'ltr',
                      minHeight: 60,
                      flex: 1
                    }}>
                      {currentSessionText.translation || realTimeTranslation}
                    </Text>
                  </View>
                )}
                
                {/* Previous Sessions - Only show if there are previous sessions and no current session */}
                {transcriptions.length > 0 && !currentSessionText.translation && !realTimeTranslation && (
                  <>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>Previous Sessions:</Text>
                    </View>
                    {transcriptions.map((block, index) => (
                      <View key={`translation-${block.id}`} style={{ marginBottom: index < transcriptions.length - 1 ? 12 : 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '500' }}>
                            {new Date(block.timestamp).toLocaleTimeString()}
                          </Text>
                          {block.translatedText && (
                            <TouchableOpacity
                              onPress={() => Clipboard.setString(block.translatedText)}
                              style={{ marginLeft: 'auto', padding: 3, borderRadius: 3 }}
                            >
                              <Icon name="content-copy" size={12} color="#2563EB" />
                            </TouchableOpacity>
                          )}
                        </View>
                        {!block.translatedText ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', minHeight: 40 }}>
                            <Icon name="sync" size={16} color="#3B82F6" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#3B82F6', fontSize: 12, fontStyle: 'italic' }}>Translating...</Text>
                          </View>
                        ) : (
                          <Text
                            style={[
                              { 
                                color: '#111827', 
                                fontSize: 12, 
                                lineHeight: 18, 
                                fontWeight: '500',
                                textAlign: selectedTargetLanguage?.code === 'ar' ? 'right' : 'left',
                                writingDirection: selectedTargetLanguage?.code === 'ar' ? 'rtl' : 'ltr'
                              }
                            ]}
                          >
                            {block.translatedText}
                          </Text>
                        )}
                        {index < transcriptions.length - 1 && (
                          <View style={{ height: 1, backgroundColor: '#BFDBFE', marginTop: 12 }} />
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Animated.View>

      {/* Enhanced Recording Button - Centered at Bottom */}
      <View style={{ position: 'absolute', left: '50%', bottom: 60, zIndex: 100, transform: [{ translateX: -35 }] }} pointerEvents="box-none">
        <TouchableOpacity
          onPress={isRecording ? stopStreaming : startStreaming}
          disabled={isStartingRecording || isStoppingRecording || isInitializing}
          style={{
            width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isRecording ? '#EF4444' : '#3B82F6',
            shadowColor: isRecording ? '#EF4444' : '#3B82F6',
            shadowOffset: { width: 0, height: 6 }, 
            shadowOpacity: 0.3, 
            shadowRadius: 10,
            elevation: 6,
            borderWidth: isRecording ? 5 : 3, 
            borderColor: isRecording ? '#F87171' : '#60A5FA',
            opacity: (isStartingRecording || isStoppingRecording || isInitializing) ? 0.6 : 1
          }}
        >
          <Icon 
            name={isStartingRecording || isStoppingRecording ? "sync" : (isRecording ? "stop" : "microphone")} 
            size={32} 
            color="#fff" 
            style={[
              isRecording ? { opacity: 0.9 } : {},
              (isStartingRecording || isStoppingRecording) ? { transform: [{ rotate: '360deg' }] } : {}
            ]} 
          />
        </TouchableOpacity>
        
        {/* Recording Status Text */}
        {isRecording && (
          <View style={{ 
            position: 'absolute', 
            top: -35, 
            left: '50%', 
            transform: [{ translateX: -35 }],
            backgroundColor: '#EF4444',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 3,
          }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 10, textAlign: 'center' }}>
              🔴 RECORDING
            </Text>
          </View>
        )}
      </View>

      {/* Enhanced AI Summary Button */}
      {showSummaryButton && !isRecording && (
        <View style={{ 
          position: 'absolute', 
          left: 16, 
          right: 16, 
          bottom: 140, 
          backgroundColor: '#fff', 
          borderRadius: 16,
          borderWidth: 2,
          borderColor: '#7C3AED',
          padding: 16, 
          zIndex: 50,
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 6,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ 
              backgroundColor: '#7C3AED', 
              paddingHorizontal: 10, 
              paddingVertical: 4, 
              borderRadius: 16,
              marginRight: 10
            }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>🤖 AI</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', flex: 1 }}>Summary Ready</Text>
            <TouchableOpacity
              onPress={() => setShowSummaryButton(false)}
              style={{
                backgroundColor: '#F3F4F6',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB'
              }}
            >
              <Text style={{ color: '#6B7280', fontSize: 10, fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={{
              width: '100%',
              backgroundColor: '#7C3AED',
              paddingVertical: 14,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#7C3AED',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 3,
            }}
            onPress={navigateToSummary}
          >
            <Text style={{ fontSize: 20, marginRight: 8 }}>🤖</Text>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Generate AI Summary</Text>
            <Icon name="arrow-right" size={18} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View style={{ position: 'absolute', top: 100, left: 16, right: 16, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, padding: 12, zIndex: 200 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '500' }}>{error}</Text>
              {error.includes('Quota exceeded') && (
                <Text style={{ color: '#DC2626', fontSize: 11, marginTop: 3 }}>
                  💡 Tip: Wait 5-10 minutes before trying again, or check your Azure Speech Service subscription limits.
                </Text>
              )}
              {!error.includes('Quota exceeded') && !isRecording && (
                <TouchableOpacity 
                  onPress={() => {
                    setError(null);
                    startStreamingWithRetry();
                  }}
                  style={{ 
                    backgroundColor: '#DC2626', 
                    paddingHorizontal: 10, 
                    paddingVertical: 4, 
                    borderRadius: 6, 
                    marginTop: 6,
                    alignSelf: 'flex-start'
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>🔄 Retry</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => setError(null)} style={{ marginLeft: 6 }}>
              <Icon name="close" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
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