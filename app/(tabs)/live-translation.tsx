// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراى في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LanguageSelector, Language } from '../../components/LanguageSelector';
import { SpeechService } from '../../services/speechService';
import { getAudioService } from '../../services/audioService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function LiveTranslationScreen() {
  const { targetLanguage, languageName, sourceLanguage, sourceLanguageName } = useLocalSearchParams<{
    targetLanguage: string;
    languageName: string;
    sourceLanguage: string;
    sourceLanguageName: string;
  }>();

  // State management
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState<string>(sourceLanguage || 'auto');
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<Language | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // NEW: Real-time translation state
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);
  const [realTimeTranscription, setRealTimeTranscription] = useState<string>('');
  const [realTimeTranslation, setRealTimeTranslation] = useState<string>('');

  // Refs
  const audioServiceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize target language
  useEffect(() => {
    const languages = SpeechService.getAvailableLanguages();
    const targetLang = languages.find(lang => lang.code === targetLanguage) || languages[0];
    setSelectedTargetLanguage(targetLang);
  }, [targetLanguage]);

  // Helper function to convert language codes to Azure format
  const convertToAzureLanguage = (langCode: string): string => {
    const azureLanguageMap: { [key: string]: string } = {
      'ar': 'ar-SA', 'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
      'it': 'it-IT', 'pt': 'pt-BR', 'ru': 'ru-RU', 'ja': 'ja-JP', 'ko': 'ko-KR',
      'zh': 'zh-CN', 'tr': 'tr-TR', 'nl': 'nl-NL', 'pl': 'pl-PL', 'sv': 'sv-SE',
      'da': 'da-DK', 'no': 'no-NO', 'fi': 'fi-FI', 'cs': 'cs-CZ', 'sk': 'sk-SK',
      'hu': 'hu-HU', 'ro': 'ro-RO', 'bg': 'bg-BG', 'hr': 'hr-HR', 'sl': 'sl-SI',
      'et': 'et-EE', 'lv': 'lv-LV', 'lt': 'lt-LT', 'el': 'el-GR', 'he': 'he-IL',
      'th': 'th-TH', 'vi': 'vi-VN', 'id': 'id-ID', 'ms': 'ms-MY', 'fil': 'fil-PH',
      'hi': 'hi-IN', 'bn': 'bn-IN', 'ur': 'ur-PK', 'fa': 'fa-IR', 'uk': 'uk-UA',
      'ca': 'ca-ES', 'eu': 'eu-ES', 'gl': 'gl-ES', 'cy': 'cy-GB', 'ga': 'ga-IE',
      'mt': 'mt-MT', 'sq': 'sq-AL', 'mk': 'mk-MK', 'sr': 'sr-RS', 'bs': 'bs-BA',
      'me': 'me-ME', 'az': 'az-AZ', 'ka': 'ka-GE', 'hy': 'hy-AM', 'kk': 'kk-KZ',
      'ky': 'ky-KG', 'uz': 'uz-UZ', 'tg': 'tg-TJ', 'mn': 'mn-MN', 'ne': 'ne-NP',
      'si': 'si-LK', 'my': 'my-MM', 'km': 'km-KH', 'lo': 'lo-LA', 'am': 'am-ET',
      'sw': 'sw-KE', 'zu': 'zu-ZA', 'af': 'af-ZA', 'is': 'is-IS', 'fo': 'fo-FO',
      'lb': 'lb-LU', 'fy': 'fy-NL', 'gd': 'gd-GB', 'kw': 'kw-GB', 'br': 'br-FR',
      'oc': 'oc-FR', 'co': 'co-FR'
    };
    return azureLanguageMap[langCode] || 'ar-SA';
  };

  // Initialize audio service
  useEffect(() => {
    // تنظيف البيانات القديمة عند بدء التطبيق
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    Logger.info('Cleared old data on app start');
    
    // لا نقوم بتهيئة الصوت تلقائياً في المتصفح
    // سنقوم بتهيئته عند الضغط على زر Start Recording
    if (Platform.OS !== 'web') {
      initAll();
    }
    
    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  // NEW: Real-time translation effect - REMOVED to avoid conflicts
  // Translation is now handled directly in the WebSocket message handler

  const initAll = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      const audioService = getAudioService();
      await audioService.init();
      audioServiceRef.current = audioService;
      
      setIsReady(true);
      Logger.info('Audio service initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to initialize audio service:', errorMessage);
      setError(`فشل في تهيئة الصوت: ${errorMessage}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const cleanup = () => {
    if (audioServiceRef.current) {
      audioServiceRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }
  };

  // Initialize WebSocket connection
  const initializeWebSocket = async () => {
    try {
      setConnectionStatus('connecting');
      
      // استخدام السيرفر على Render
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      ws.onopen = () => {
        Logger.info('WebSocket connected');
        setConnectionStatus('connected');
        setError(null);
        
        // Validate and prepare language codes
        const supportedLanguages = SpeechService.getAvailableLanguages().map(lang => lang.code);
        const sourceLang = selectedSourceLanguage && selectedSourceLanguage !== 'auto' ? selectedSourceLanguage : 'ar';
        const targetLang = selectedTargetLanguage?.code || 'en';
        
        const azureSourceLang = convertToAzureLanguage(sourceLang);
        const azureTargetLang = convertToAzureLanguage(targetLang);
        
        // Validate source language
        if (!supportedLanguages.includes(sourceLang)) {
          Logger.error('Unsupported source language:', sourceLang);
          setError(`Unsupported source language: ${sourceLang}`);
          return;
        }
        
        // Validate target language
        if (!supportedLanguages.includes(targetLang)) {
          Logger.error('Unsupported target language:', targetLang);
          setError(`Unsupported target language: ${targetLang}`);
          return;
        }
        
        Logger.info('Using validated languages - Source:', sourceLang, 'Target:', targetLang);
        
        // Send initialization message
        const initMessage = {
          type: 'init',
          language: azureSourceLang,
          targetLanguage: azureTargetLang,
          clientSideTranslation: true,
          realTimeMode: isRealTimeMode // NEW: Send real-time mode to server
        };
        ws.send(JSON.stringify(initMessage));
        Logger.info('Init message sent with language:', initMessage.language, 'and targetLanguage:', initMessage.targetLanguage);
      };
      
      ws.onmessage = async (event) => {
        try {
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
                    selectedSourceLanguage
                  );
                  
                  Logger.info('Real-time translation result:', translatedText);
                  setRealTimeTranslation(translatedText);
                } catch (translationError) {
                  Logger.error('Real-time translation failed:', translationError);
                  setRealTimeTranslation(data.text); // Fallback to original
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
                    selectedSourceLanguage
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
        Logger.error('WebSocket error event:', error);
        Logger.error('WebSocket error details:', {
          readyState: ws.readyState,
          url: ws.url,
          protocol: ws.protocol
        });
        setConnectionStatus('disconnected');
        setError('فشل في الاتصال بالخادم');
      };
      
      ws.onclose = (event) => {
        Logger.info('WebSocket disconnected', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        // إذا كان الانقطاع غير متوقع، أعد الاتصال
        if (event.code !== 1000 && isRecording) {
          Logger.info('Attempting to reconnect...');
          setTimeout(() => {
            if (isRecording) {
              initializeWebSocket();
            }
          }, 2000);
        }
      };
      
      wsRef.current = ws;
    } catch (error) {
      Logger.error('Failed to initialize WebSocket:', error);
      setConnectionStatus('disconnected');
      throw error;
    }
  };

  const startStreaming = async () => {
    if (isRecording) {
      Logger.warn('Already recording');
      return;
    }

    try {
      Logger.info('Starting audio streaming...');
      
      // في المتصفح، نقوم بتهيئة الصوت عند الضغط على الزر
      if (Platform.OS === 'web' && !isReady) {
        await initAll();
      }
      
      if (!isReady) {
        throw new Error('Audio service not ready');
      }
      
      // Initialize WebSocket connection
      await initializeWebSocket();
      
      // Start audio recording
      await audioServiceRef.current.start();
      
             // Set up audio data callback
       audioServiceRef.current.onData((chunk: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Validate language codes for audio messages
          const supportedLanguages = SpeechService.getAvailableLanguages().map(lang => lang.code);
          const sourceLang = selectedSourceLanguage && selectedSourceLanguage !== 'auto' ? selectedSourceLanguage : 'ar';
          const targetLang = selectedTargetLanguage?.code || 'en';
          
          const azureSourceLang = convertToAzureLanguage(sourceLang);
          const azureTargetLang = convertToAzureLanguage(targetLang);
          
          const message = {
            type: 'audio',
            data: chunk.data, // Sending base64 string as data
            sourceLanguage: azureSourceLang,
            targetLanguage: azureTargetLang,
            transcriptionOnly: true
          };
          wsRef.current.send(JSON.stringify(message)); // Sending JSON message
          Logger.info('Audio chunk sent to server with sourceLanguage:', message.sourceLanguage, 'and targetLanguage:', message.targetLanguage);
        }
      });
      
      setIsRecording(true);
      setError(null);
      
      // NEW: Clear real-time data when starting
      if (isRealTimeMode) {
        setRealTimeTranscription('');
        setRealTimeTranslation('');
        Logger.info('Cleared real-time data for new recording');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to start streaming:', errorMessage);
      setError(`فشل في بدء التسجيل: ${errorMessage}`);
      setIsRecording(false);
      setConnectionStatus('disconnected');
    }
  };

  const stopStreaming = async () => {
    try {
      Logger.info('Stopping audio streaming...');
      
      if (audioServiceRef.current) {
        await audioServiceRef.current.stop();
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setIsRecording(false);
      setConnectionStatus('disconnected');
      
      // NEW: Save real-time transcription to history if exists
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
        setRealTimeTranscription('');
        setRealTimeTranslation('');
      }
      
      Logger.info('Audio streaming stopped');
    } catch (error) {
      Logger.error('Failed to stop streaming:', error);
    }
  };

  const handleTargetLanguageChange = async (newTargetLanguage: Language) => {
    setSelectedTargetLanguage(newTargetLanguage);
    
    // Retranslate existing transcriptions
    const retranslated = await Promise.all(
      transcriptions.map(async (item) => {
        try {
          const newTranslatedText = await SpeechService.translateText(
            item.originalText,
            newTargetLanguage.code,
            selectedSourceLanguage
          );
          return { ...item, translatedText: newTranslatedText };
        } catch (error) {
          Logger.error('Failed to retranslate item:', error);
          return item;
        }
      })
    );
    setTranscriptions(retranslated);
    
         // NEW: Retranslate real-time content
     if (isRealTimeMode && realTimeTranscription) {
       try {
         Logger.info('Retranslating real-time content to:', newTargetLanguage.code);
         const newTranslatedText = await SpeechService.translateText(
           realTimeTranscription,
           newTargetLanguage.code,
           selectedSourceLanguage
         );
         Logger.info('Real-time retranslation result:', newTranslatedText);
         setRealTimeTranslation(newTranslatedText);
       } catch (error) {
         Logger.error('Failed to retranslate real-time content:', error);
       }
     }
    
    // Notify server of language update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const sourceLang = selectedSourceLanguage && selectedSourceLanguage !== 'auto' ? selectedSourceLanguage : 'ar';
      const azureSourceLang = convertToAzureLanguage(sourceLang);
      const azureTargetLang = convertToAzureLanguage(newTargetLanguage.code);
      
      const languageUpdateMessage = {
        type: 'language_update',
        sourceLanguage: azureSourceLang,
        targetLanguage: azureTargetLang,
        clientSideTranslation: true
      };
      wsRef.current.send(JSON.stringify(languageUpdateMessage));
    }
  };

  // NEW: Toggle real-time mode
  const toggleRealTimeMode = () => {
    setIsRealTimeMode(!isRealTimeMode);
    if (isRealTimeMode) {
      // Switching from real-time to traditional mode
      if (realTimeTranscription) {
        // تجنب إضافة نفس النص مرتين
        const isDuplicate = transcriptions.some(item => 
          item.originalText === realTimeTranscription
        );
        
        if (!isDuplicate) {
          const newItem: TranscriptionItem = {
            id: Date.now().toString(),
            originalText: realTimeTranscription,
            translatedText: realTimeTranslation,
            timestamp: new Date()
          };
          setTranscriptions(prev => [...prev, newItem]);
        }
      }
      setRealTimeTranscription('');
      setRealTimeTranslation('');
    }
    Logger.info('Real-time mode toggled to:', !isRealTimeMode);
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    Logger.info('Cleared all transcriptions');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Translation</Text>
      
      {/* NEW: Real-time mode toggle */}
      <View style={styles.realTimeToggle}>
        <Text style={styles.toggleLabel}>Real-time Translation</Text>
        <TouchableOpacity
          style={[styles.toggleButton, isRealTimeMode && styles.toggleButtonActive]}
          onPress={toggleRealTimeMode}
        >
          <Text style={[styles.toggleText, isRealTimeMode && styles.toggleTextActive]}>
            {isRealTimeMode ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

             {/* Language selector */}
       <View style={styles.languageSelector}>
         <LanguageSelector
           selectedLanguage={selectedTargetLanguage}
           onSelectLanguage={handleTargetLanguageChange}
           disabled={isRecording}
         />
       </View>

      {/* NEW: Real-time display */}
      {isRealTimeMode && isRecording && (
        <View style={styles.realTimeContainer}>
          <View style={styles.realTimeSection}>
            <Text style={styles.realTimeLabel}>LIVE Original</Text>
            <Text style={styles.realTimeText}>{realTimeTranscription || 'Listening...'}</Text>
          </View>
          <View style={styles.realTimeSection}>
            <Text style={styles.realTimeLabel}>LIVE Translation</Text>
            <Text style={styles.realTimeText}>{realTimeTranslation || 'Translating...'}</Text>
          </View>
        </View>
      )}

      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

             {/* Traditional transcriptions list */}
       {(!isRealTimeMode || !isRecording) && (
         <ScrollView style={styles.transcriptionContainer}>
          {transcriptions.length === 0 ? (
            <Text style={styles.emptyText}>
              {isRealTimeMode ? 'Start recording to see real-time translation!' : 'No transcriptions yet'}
            </Text>
          ) : (
            transcriptions.map((item) => (
              <View key={item.id} style={styles.transcriptionItem}>
                <View style={styles.originalSection}>
                  <Text style={styles.sectionLabel}>Original</Text>
                  <Text style={styles.transcriptionText}>{item.originalText}</Text>
                </View>
                <View style={styles.translationSection}>
                  <Text style={styles.sectionLabel}>Translation</Text>
                  <Text style={styles.transcriptionText}>{item.translatedText}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>
        
        {transcriptions.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearTranscriptions}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  realTimeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  toggleButton: {
    backgroundColor: '#fff',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  toggleButtonActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  toggleText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleTextActive: {
    color: '#fff',
  },
  languageSelector: {
    marginBottom: 20,
  },
  realTimeContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  realTimeSection: {
    marginBottom: 10,
  },
  realTimeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  realTimeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  transcriptionContainer: {
    flex: 1,
    padding: 10,
  },
  transcriptionItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  originalSection: {
    flex: 1,
    marginRight: 10,
  },
  translationSection: {
    flex: 1,
    marginLeft: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
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
    marginTop: 20,
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
}); 