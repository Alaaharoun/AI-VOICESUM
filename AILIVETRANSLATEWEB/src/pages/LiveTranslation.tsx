  import React, { useState, useRef, useEffect } from 'react';
  import { Mic, MicOff, Download, Globe, Brain, Wifi, WifiOff } from 'lucide-react';
  import { useNavigate } from 'react-router-dom';
  import { RenderWebSocketService } from '../services/renderWebSocketService';
  import { AudioConverter } from '../services/audioConverter';
  import { permissionHelper } from '../utils/permissionHelper';

  export const LiveTranslation: React.FC = () => {
    const navigate = useNavigate();
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [translation, setTranslation] = useState('');
    const [sourceLanguage, setSourceLanguage] = useState('auto');
    const [targetLanguage, setTargetLanguage] = useState('en');
    const [isProcessing, setIsProcessing] = useState(false);
    const [realTimeTranscription, setRealTimeTranscription] = useState('');
    const [realTimeTranslation, setRealTimeTranslation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isServerReady, setIsServerReady] = useState(false);
    const [streamingStatus, setStreamingStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [isInitAcknowledged, setIsInitAcknowledged] = useState(false); // ✅ إضافة متغير تتبع تأكيد init
    const [wsConnectionStatus, setWsConnectionStatus] = useState(false); // Track WebSocket connection status
    const streamingMonitorRef = useRef<number | null>(null); // For periodic streaming status monitoring
    
    const renderWebSocketServiceRef = useRef<RenderWebSocketService | null>(null);
    const streamingServiceRef = useRef<any | null>(null); // For REST API fallback
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    let isUsingWebSocket = true; // Track which service is being used

    // Comprehensive language list from the old application
    const languages = [
      { code: 'auto', name: 'Auto-detect', flag: '🌐' },
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
      { code: 'es', name: 'Spanish', flag: '🇪🇸' },
      { code: 'fr', name: 'French', flag: '🇫🇷' },
      { code: 'de', name: 'German', flag: '🇩🇪' },
      { code: 'it', name: 'Italian', flag: '🇮🇹' },
      { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
      { code: 'ru', name: 'Russian', flag: '🇷🇺' },
      { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
      { code: 'ko', name: 'Korean', flag: '🇰🇷' },
      { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
      { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
      { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
      { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
      { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
      { code: 'da', name: 'Danish', flag: '🇩🇰' },
      { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
      { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
      { code: 'pl', name: 'Polish', flag: '🇵🇱' },
      { code: 'cs', name: 'Czech', flag: '🇨🇿' },
      { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
      { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
      { code: 'bg', name: 'Bulgarian', flag: '🇧🇬' },
      { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
      { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
      { code: 'sl', name: 'Slovenian', flag: '🇸🇮' },
      { code: 'et', name: 'Estonian', flag: '🇪🇪' },
      { code: 'lv', name: 'Latvian', flag: '🇱🇻' },
      { code: 'lt', name: 'Lithuanian', flag: '🇱🇹' },
      { code: 'mt', name: 'Maltese', flag: '🇲🇹' },
      { code: 'el', name: 'Greek', flag: '🇬🇷' },
      { code: 'he', name: 'Hebrew', flag: '🇮🇱' },
      { code: 'th', name: 'Thai', flag: '🇹🇭' },
      { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
      { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
      { code: 'ms', name: 'Malay', flag: '🇲🇾' },
      { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
      { code: 'sw', name: 'Swahili', flag: '🇰🇪' },
      { code: 'am', name: 'Amharic', flag: '🇪🇹' },
      { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
      { code: 'zu', name: 'Zulu', flag: '🇿🇦' },
    ];

    // Initialize Render WebSocket service
    const initializeRenderWebSocketService = async () => {
      try {
        console.log('🔧 Initializing Render WebSocket service...');
        setStreamingStatus('connecting');
        setIsInitializing(true);
        setError(null);
        setIsInitAcknowledged(false); // ✅ إعادة تعيين حالة التأكيد
        
        // Create new Render WebSocket service instance
        renderWebSocketServiceRef.current = new RenderWebSocketService();
        
        // Connect to Render WebSocket service with callbacks
        await renderWebSocketServiceRef.current.connect(
          sourceLanguage,
          targetLanguage,
          (transcriptionText: string) => {
            console.log('📝 Real-time transcription received:', transcriptionText);
            if (transcriptionText && transcriptionText.trim()) {
              setRealTimeTranscription(transcriptionText);
              console.log('✅ Transcription updated in UI:', transcriptionText);
            } else {
              console.log('⚠️ Empty transcription received, ignoring');
            }
          },
          (translationText: string) => {
            console.log('🌐 Real-time translation received:', translationText);
            if (translationText && translationText.trim()) {
              setRealTimeTranslation(translationText);
              console.log('✅ Translation updated in UI:', translationText);
            } else {
              console.log('⚠️ Empty translation received, ignoring');
            }
          }
        );

        console.log('✅ Render WebSocket service connected successfully');
        setWsConnectionStatus(true); // Update connection status
        
        // Wait for server to be ready (check every 100ms for up to 15 seconds)
        let attempts = 0;
        const maxAttempts = 150; // 15 seconds
        
        while (attempts < maxAttempts) {
          if (renderWebSocketServiceRef.current?.isInitializedStatus()) {
            setIsServerReady(true);
            setIsInitAcknowledged(true); // ✅ تعيين حالة التأكيد عند جاهزية الخادم
            console.log('✅ Server is ready for audio input');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          console.warn('⚠️ Server initialization timeout');
          setError('Server initialization timeout. Please try again.');
          setStreamingStatus('error');
        } else {
          setStreamingStatus('connected');
        }
        
      } catch (error) {
        console.error('❌ Error initializing Render WebSocket service:', error);
        setStreamingStatus('error');
        setError(`Failed to initialize Render WebSocket service: ${error}`);
        throw error;
      } finally {
        setIsInitializing(false);
      }
    };

    const startRecording = async () => {
      try {
        console.log('🎤 Starting recording process...');
        setError(null);
        setRealTimeTranscription('');
        setRealTimeTranslation('');
        setTranscription('');
        setTranslation('');
        setIsRecording(true);
        setIsProcessing(true);
        setIsInitAcknowledged(false); // ✅ إعادة تعيين حالة التأكيد
        
        // Check microphone permission first
        console.log('🔍 Checking microphone permission...');
        const isGranted = await permissionHelper.isPermissionGranted();
        
        if (!isGranted) {
          console.log('🎤 Requesting microphone permission...');
          const permissionStatus = await permissionHelper.requestMicrophonePermission();
          
          if (!permissionStatus.granted) {
            console.error('❌ Microphone permission denied');
            setError('Please allow microphone access to use this feature.');
            setIsRecording(false);
            setIsProcessing(false);
            setStreamingStatus('error');
            return;
          }
        }
        
        // Check if we already have a connected WebSocket service
        if (renderWebSocketServiceRef.current && renderWebSocketServiceRef.current.isConnectedStatus()) {
          console.log('✅ WebSocket service already connected, reusing existing connection');
          isUsingWebSocket = true;
          setWsConnectionStatus(true); // Ensure UI reflects the connection status
          
          // Restart streaming if connection exists but streaming is stopped
          console.log('🔄 Restarting WebSocket streaming for new recording session...');
          try {
            // Use the new restartStreaming method instead of full reconnect
            await renderWebSocketServiceRef.current.restartStreaming(
              sourceLanguage,
              targetLanguage,
              (transcriptionText: string) => {
                console.log('📝 Real-time transcription received:', transcriptionText);
                if (transcriptionText && transcriptionText.trim()) {
                  setRealTimeTranscription(transcriptionText);
                  console.log('✅ Transcription updated in UI:', transcriptionText);
                }
              },
              (translationText: string) => {
                console.log('🌐 Real-time translation received:', translationText);
                if (translationText && translationText.trim()) {
                  setRealTimeTranslation(translationText);
                  console.log('✅ Translation updated in UI:', translationText);
                }
              }
            );
            console.log('✅ WebSocket streaming restarted successfully');
            setStreamingStatus('connected');
            setIsServerReady(true); // Mark server as ready since we're reusing connection
            setIsInitAcknowledged(true); // Mark init as acknowledged
            
            // Double-check streaming status after a brief delay
            setTimeout(() => {
              if (renderWebSocketServiceRef.current) {
                const wsService = renderWebSocketServiceRef.current;
                const detailedStatus = wsService.getDetailedStatus();
                console.log('🔍 Post-restart detailed status check:', detailedStatus);
                
                // Force ensure streaming is active if it's not
                if (!detailedStatus.isStreaming) {
                  console.log('⚠️ Streaming still not active after restart - forcing fix...');
                  const fixed = wsService.forceEnsureStreaming();
                  if (fixed) {
                    console.log('✅ Streaming force-fixed successfully');
                  } else {
                    console.error('❌ Failed to force-fix streaming');
                  }
                } else {
                  console.log('✅ Streaming is properly active after restart');
                }
              }
            }, 1000);
          } catch (error) {
            console.warn('⚠️ Failed to restart streaming, will try to reconnect:', error);
            // If restart fails, reinitialize the connection
            await initializeRenderWebSocketService();
          }
        } else {
          // Initialize Render WebSocket service if not connected
          console.log('🔌 Initializing Render WebSocket service...');
          await initializeRenderWebSocketService();
        }
        
        // Check if Render WebSocket service is connected and initialized
        if (!renderWebSocketServiceRef.current || !renderWebSocketServiceRef.current.isConnectedStatus()) {
          console.log('⚠️ Render WebSocket service not connected, trying fallback to REST API...');
          
          // Try fallback to REST API
          try {
            console.log('🔄 Attempting to switch to REST API fallback...');
            const { StreamingService } = await import('../services/streamingService');
            
            if (!streamingServiceRef.current) {
              streamingServiceRef.current = new StreamingService();
            }
            
            await streamingServiceRef.current.connect(
              sourceLanguage,
              targetLanguage, 
              'faster-whisper', // Use faster-whisper for REST API
              (text: string) => {
                setTranscription(text);
                setRealTimeTranscription(text);
              },
              (text: string) => {
                setTranslation(text);
                setRealTimeTranslation(text);
              }
            );
            
            console.log('✅ Successfully connected to REST API fallback');
            setError('Connected via REST API (WebSocket unavailable)');
            
            // Continue with REST API recording setup
            isUsingWebSocket = false;
            
          } catch (fallbackError) {
            console.error('❌ Both WebSocket and REST API failed:', fallbackError);
            setIsRecording(false);
            setIsProcessing(false);
            setError('Failed to connect to both WebSocket and REST API services. Please try again later.');
            return;
          }
        }
        
        // Only check WebSocket initialization if we're using WebSocket
        if (isUsingWebSocket && renderWebSocketServiceRef.current && !renderWebSocketServiceRef.current.isInitializedStatus()) {
          console.log('⚠️ Render WebSocket service not initialized, stopping recording');
          setIsRecording(false);
          setIsProcessing(false);
          setError('Server not ready for audio input. Please try again.');
          return;
        }
        
        console.log('🎵 Starting audio recording for WebSocket...');
        
        // Get microphone stream with optimal settings for Azure Speech Service
        const optimalSettings = AudioConverter.getOptimalRecordingSettings();
        console.log('🎵 Using optimal recording settings:', optimalSettings);
        
        // Test microphone before starting recording
        console.log('🔍 Testing microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            ...optimalSettings,
            autoGainControl: true,      // Boost volume automatically
            noiseSuppression: false,     // Disable noise suppression to preserve speech
            echoCancellation: false,     // Disable echo cancellation to preserve speech
            sampleRate: 16000,          // Ensure 16kHz sample rate
            channelCount: 1             // Ensure mono
          }
        });
        
        // Analyze microphone input for debugging
        const testAudioContext = new AudioContext({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
        const testSource = testAudioContext.createMediaStreamSource(stream);
        const analyser = testAudioContext.createAnalyser();
        analyser.fftSize = 256;
        testSource.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Quick microphone test
        let testDuration = 0;
        const testInterval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          console.log(`🔍 Microphone test - Level: ${average}, Duration: ${testDuration}s`);
          testDuration += 0.1;
          
          if (testDuration >= 1) {
            clearInterval(testInterval);
            console.log('✅ Microphone test completed');
            testAudioContext.close();
          }
        }, 100);
        
        // Store stream reference for stopping later
        audioStreamRef.current = stream;
        
        // Use MediaRecorder for modern audio capture
        console.log('🎵 Using MediaRecorder for audio capture');
        
        const audioContext = new AudioContext({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
        
        // ✅ تحسين إعدادات MediaRecorder مع fallback للPCM
        let mediaRecorderOptions: MediaRecorderOptions = { mimeType: 'audio/webm;codecs=opus' };
        
        // فحص دعم WebM، وإذا فشل استخدم PCM
        if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          console.warn('⚠️ WebM/Opus not supported, trying alternative formats...');
          
          if (MediaRecorder.isTypeSupported('audio/wav')) {
            mediaRecorderOptions = { mimeType: 'audio/wav' };
            console.log('✅ Using WAV format as fallback');
          } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mediaRecorderOptions = { mimeType: 'audio/ogg;codecs=opus' };
            console.log('✅ Using OGG/Opus format as fallback');
          } else {
            console.warn('⚠️ Using default MediaRecorder format');
            mediaRecorderOptions = { mimeType: 'audio/webm' }; // fallback default
          }
        }
        
        console.log('🎵 MediaRecorder options:', mediaRecorderOptions);
        
        // Use MediaRecorder for modern audio capture (replaces deprecated ScriptProcessorNode)
        const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
        
        // Store references for cleanup
        audioContextRef.current = audioContext;
        mediaRecorderRef.current = mediaRecorder;
        
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);

            // Analyze audio level for debugging (approximate)
            const audioLevel = Math.sqrt(event.data.size / 100); // Rough estimate
            console.log('📦 Audio chunk received:', event.data.size, 'bytes, Level:', audioLevel.toFixed(2));

            // ✅ Enhanced validation for audio chunks before sending
            const chunkSize = event.data.size;
            const chunkType = event.data.type;
            
            // 1. Size validation - increased minimum from 500 to 1024 bytes (1KB)
            if (chunkSize < 1024) {
              console.warn('⚠️ Audio chunk too small, may be corrupted:', {
                size: chunkSize,
                type: chunkType,
                level: audioLevel.toFixed(2),
                reason: 'Below 1KB minimum threshold'
              });
              console.warn('🔧 Skipping small chunk to prevent server corruption errors');
              return; // تخطي القطع الصغيرة المحتمل أن تكون فاسدة
            }

            // 2. WebM-specific validation
            if (chunkType && (chunkType.includes('webm') || chunkType.includes('opus'))) {
              // For WebM, be extra strict about minimum size
              if (chunkSize < 2048) { // 2KB minimum for WebM
                console.warn('⚠️ WebM chunk too small for reliable processing:', {
                  size: chunkSize,
                  type: chunkType,
                  minimumRequired: '2KB'
                });
                console.warn('🔧 Skipping small WebM chunk to prevent EBML header errors');
                return;
              }
              
              console.log('✅ WebM chunk accepted for processing:', {
                size: chunkSize,
                type: chunkType,
                sizeCategory: chunkSize >= 5120 ? 'Large (likely complete)' : 'Medium (likely partial)'
              });
            }

            // تحليل مفصل لحالة الاتصال قبل إرسال الصوت
            const wsService = renderWebSocketServiceRef.current;
            const serviceExists = !!wsService;
            const isConnectedToWS = serviceExists ? wsService.isConnectedStatus() : false;
            const recordingState = isRecording;

            console.log('🔍 Detailed status check before sending audio:', {
              serviceExists,
              isConnectedToWS,
              recordingState,
              chunkSize: chunkSize,
              chunkType: chunkType,
              timestamp: new Date().toISOString()
            });
            
            // إرسال الصوت بناءً على نوع الخدمة المستخدمة
            if (isUsingWebSocket) {
              // إرسال عبر WebSocket
              if (serviceExists && isConnectedToWS && wsService) {
                console.log('📤 Sending audio chunk to WebSocket service');
                try {
                  wsService.sendAudioChunk(event.data);
                  console.log('✅ Audio chunk sent successfully via WebSocket');
                } catch (error) {
                  console.error('❌ Error sending audio chunk via WebSocket:', error);
                }
              } else {
                console.warn('⚠️ Cannot send audio chunk via WebSocket:', {
                  reason: !serviceExists ? 'Service not exists' : 
                          !isConnectedToWS ? 'WebSocket not connected' : 
                          !recordingState ? 'Recording stopped' : 'Unknown',
                  serviceExists,
                  isConnectedToWS,
                  recordingState
                });
              }
            } else {
              // إرسال عبر REST API
              if (streamingServiceRef.current && recordingState) {
                console.log('📤 Sending audio chunk to REST API service');
                try {
                  streamingServiceRef.current.sendAudioChunk(event.data);
                  console.log('✅ Audio chunk sent successfully via REST API');
                } catch (error) {
                  console.error('❌ Error sending audio chunk via REST API:', error);
                }
              } else {
                console.warn('⚠️ Cannot send audio chunk via REST API:', {
                  streamingServiceExists: !!streamingServiceRef.current,
                  recordingState
                });
              }
            }
          }
        };
        
        mediaRecorder.onstop = () => {
          console.log('🛑 MediaRecorder stopped');
        };
        
                // ✅ بدء التسجيل مباشرة مع تحسين التعامل مع init
        console.log('🎙️ Starting MediaRecorder...');
        
        // ✅ تحسين فترة التسجيل لتجنب القطع الصغيرة الفاسدة
        // زيادة الفترة من 1000ms إلى 2000ms لضمان قطع أكبر وأكثر استقراراً
        mediaRecorder.start(2000); // 2 seconds for more stable chunks

        // Set recording state to true to prevent auto-stop
        setIsRecording(true);
        setIsProcessing(true);
        setStreamingStatus('connected');

        console.log('✅ MediaRecorder recording started successfully');
        
        // Start monitoring streaming status during recording
        startStreamingMonitor();
        
        // تحسين حالة التأكيد في الخلفية
        setTimeout(() => {
          if (!isInitAcknowledged && renderWebSocketServiceRef.current?.isConnectedStatus()) {
            console.log('🔄 Re-sending init message after recording started...');
            // يمكن إعادة إرسال init message هنا إذا لزم الأمر
          }
        }, 2000);
        
      } catch (error) {
        console.error('❌ Error starting recording:', error);
        setError(`Error starting recording: ${error}`);
        setIsRecording(false);
        setIsProcessing(false);
        setStreamingStatus('error');
      }
    };

    const stopRecording = () => {
      try {
        console.log('🛑 Stopping recording...');
        
        // Immediately update UI state to prevent further audio processing
        setIsRecording(false);
        setIsProcessing(false);
        setStreamingStatus('idle');
        
        // Stop MediaRecorder first
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop();
            console.log('✅ MediaRecorder stopped');
          } catch (error) {
            console.warn('⚠️ Error stopping MediaRecorder:', error);
          }
        }
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          console.log('✅ Audio context closed');
        }
        
        // Stop all tracks
        try {
          if (audioStreamRef.current) {
            const tracks = audioStreamRef.current.getTracks();
            tracks.forEach((track: MediaStreamTrack) => {
              track.stop();
              console.log('🔇 Audio track stopped');
            });
          }
        } catch (error) {
          console.warn('⚠️ Could not stop tracks:', error);
        }
        
        // Clear references
        audioStreamRef.current = null;
        audioContextRef.current = null;
        mediaRecorderRef.current = null;
        
        // Stop monitoring streaming status
        stopStreamingMonitor();
        
        // Stop streaming but keep connection alive for next recording session
        if (isUsingWebSocket && renderWebSocketServiceRef.current) {
          renderWebSocketServiceRef.current.stopStreaming();
          console.log('🛑 WebSocket streaming stopped (connection kept alive)');
        }
        
        if (!isUsingWebSocket && streamingServiceRef.current) {
          streamingServiceRef.current.stopStreaming();
          console.log('🛑 REST API streaming stopped (connection kept alive)');
        }
        
        // Keep service flags as they are for next recording session
        
        console.log('✅ Recording stopped successfully');
        
      } catch (error) {
        console.error('❌ Error stopping recording:', error);
        // Force reset state even if there's an error
        setIsRecording(false);
        setIsProcessing(false);
        setStreamingStatus('idle');
        audioStreamRef.current = null;
        audioContextRef.current = null;
        mediaRecorderRef.current = null;
        
        // Note: Stream cleanup is handled in the main try block above
      }
    };

    // Note: Database saving functionality removed as it's not currently used

    const downloadTranscription = () => {
      const content = `Transcription: ${transcription}\n\nTranslation: ${translation}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcription-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const goToSummary = () => {
      if (transcription || realTimeTranscription) {
        const text = realTimeTranscription || transcription;
        navigate('/summary', { 
          state: { 
            text,
            translation: realTimeTranslation || translation 
          } 
        });
      }
    };

    // Manual disconnect function
    const disconnectServices = () => {
      console.log('🔌 Manually disconnecting all services...');
      
      // Stop recording first if active
      if (isRecording) {
        stopRecording();
      }
      
      // Disconnect WebSocket service
      if (renderWebSocketServiceRef.current) {
        renderWebSocketServiceRef.current.disconnect();
        renderWebSocketServiceRef.current = null;
        console.log('🔌 WebSocket service manually disconnected');
      }
      
      // Update connection status
      setWsConnectionStatus(false);
      
      // Disconnect REST API service
      if (streamingServiceRef.current) {
        streamingServiceRef.current.disconnect();
        streamingServiceRef.current = null;
        console.log('🔌 REST API service manually disconnected');
      }
      
      // Reset service flags
      isUsingWebSocket = true;
      
      // Update UI state
      setStreamingStatus('idle');
      setIsServerReady(false);
      setError(null);
      
      console.log('✅ All services manually disconnected');
    };

    // Start monitoring streaming status during recording
    const startStreamingMonitor = () => {
      if (streamingMonitorRef.current) {
        clearInterval(streamingMonitorRef.current);
      }
      
      console.log('🔍 Starting streaming status monitor...');
      streamingMonitorRef.current = window.setInterval(() => {
        if (isRecording && renderWebSocketServiceRef.current) {
          const status = renderWebSocketServiceRef.current.getDetailedStatus();
          
          // Only log if there's an issue
          if (status.isConnected && !status.isStreaming) {
            console.warn('⚠️ Monitor detected: WebSocket connected but streaming stopped');
            console.log('🔧 Monitor auto-fixing streaming...');
            
            const fixed = renderWebSocketServiceRef.current.forceEnsureStreaming();
            if (fixed) {
              console.log('✅ Monitor successfully fixed streaming');
            } else {
              console.error('❌ Monitor failed to fix streaming');
            }
          }
        }
      }, 5000); // Check every 5 seconds during recording
    };

    // Stop monitoring streaming status
    const stopStreamingMonitor = () => {
      if (streamingMonitorRef.current) {
        clearInterval(streamingMonitorRef.current);
        streamingMonitorRef.current = null;
        console.log('🛑 Streaming status monitor stopped');
      }
    };



    // Cleanup on unmount (when leaving the page)
    useEffect(() => {
      return () => {
        console.log('🏠 Component unmounting - disconnecting all services...');
        
        // Disconnect WebSocket service when leaving the page
        if (renderWebSocketServiceRef.current) {
          renderWebSocketServiceRef.current.disconnect();
          console.log('🔌 WebSocket service disconnected (page unmount)');
        }
        
        // Update connection status (though component is unmounting)
        setWsConnectionStatus(false);
        
        // Disconnect REST API service when leaving the page
        if (streamingServiceRef.current) {
          streamingServiceRef.current.disconnect();
          console.log('🔌 REST API service disconnected (page unmount)');
        }
        
        // Stop monitoring if active
        if (streamingMonitorRef.current) {
          clearInterval(streamingMonitorRef.current);
          streamingMonitorRef.current = null;
        }
        
        // Clear all refs
        renderWebSocketServiceRef.current = null;
        streamingServiceRef.current = null;
        audioStreamRef.current = null;
        audioContextRef.current = null;
        mediaRecorderRef.current = null;
      };
    }, []);

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Live Translation</h1>
            
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                    <span className="font-medium">Connection Error</span>
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      setStreamingStatus('idle');
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="mt-2 text-sm">{error}</p>
                {streamingStatus === 'error' && (
                  <button
                    onClick={async () => {
                      setError(null);
                      setStreamingStatus('idle');
                      try {
                        await initializeRenderWebSocketService();
                      } catch (err) {
                        console.error('Failed to reconnect:', err);
                      }
                    }}
                    className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            )}

            {/* Language Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Language
                </label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Language
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {languages.filter(lang => lang.code !== 'auto').map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

                      {/* WebSocket Status */}
            <div className="mb-6">
              <div className={`border rounded-lg p-4 ${
                wsConnectionStatus 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      wsConnectionStatus 
                        ? 'bg-green-500' 
                        : 'bg-gray-400'
                    }`}></div>
                    <div>
                      <h3 className={`text-sm font-medium ${
                        wsConnectionStatus 
                          ? 'text-green-900' 
                          : 'text-gray-900'
                      }`}>
                        WebSocket Server
                      </h3>
                      <p className={`text-xs ${
                        wsConnectionStatus 
                          ? 'text-green-700' 
                          : 'text-gray-600'
                      }`}>
                        {wsConnectionStatus 
                          ? 'Connected to ai-voicesum.onrender.com' 
                          : 'Not connected - Ready to connect'}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={async () => {
                        try {
                          const testResult = await renderWebSocketServiceRef.current?.testConnection();
                          if (testResult) {
                            alert('✅ Render WebSocket connection test successful!');
                          } else {
                            alert('❌ Render WebSocket connection test failed. Check your server.');
                          }
                        } catch (error) {
                          alert(`❌ Test failed: ${error}`);
                        }
                      }}
                      className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                    >
                      Test Connection
                    </button>
                    
                    <button
                      onClick={() => {
                        if (renderWebSocketServiceRef.current) {
                          const status = renderWebSocketServiceRef.current.getDetailedStatus();
                          console.log('🔍 Current detailed status:', status);
                          
                          if (!status.isStreaming && status.isConnected) {
                            console.log('🔧 Attempting manual force fix...');
                            const fixed = renderWebSocketServiceRef.current.forceEnsureStreaming();
                            if (fixed) {
                              alert('✅ Streaming force-fixed successfully!');
                            } else {
                              alert('❌ Failed to force-fix streaming');
                            }
                          } else if (status.isStreaming) {
                            alert('✅ Streaming is already active!');
                          } else {
                            alert('❌ WebSocket not connected - cannot fix streaming');
                          }
                        } else {
                          alert('❌ No WebSocket service available');
                        }
                      }}
                      className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
                      title="Check and fix streaming status"
                    >
                      Fix Stream
                    </button>
                    
                    <button
                      onClick={disconnectServices}
                      className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      title="Disconnect all services"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center mb-8">
              <button
                onClick={() => {
                  console.log('Button clicked, isRecording:', isRecording);
                  if (isRecording) {
                    console.log('Stopping recording...');
                    // Force immediate UI update
                    setIsRecording(false);
                    setIsProcessing(false);
                    setStreamingStatus('idle');
                    // Then stop recording
                    setTimeout(() => stopRecording(), 100); // Small delay to ensure UI updates first
                  } else {
                    console.log('Starting recording...');
                    startRecording();
                  }
                }}
                disabled={isInitializing && !isRecording} // Allow stopping even when processing
                className={`flex items-center justify-center w-20 h-20 rounded-full text-white font-bold text-lg transition-all duration-200 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 cursor-pointer' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } ${(isInitializing && !isRecording) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
            </div>

            {/* Status Indicators */}
            <div className="flex justify-center space-x-6 mb-6">
              {/* Recording Status */}
              <div className={`flex items-center space-x-2 ${isRecording ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm">
                  {isRecording ? 'Recording' : 'Not Recording'}
                </span>
              </div>
              
              {/* Streaming Status */}
              <div className={`flex items-center space-x-2 ${
                streamingStatus === 'connected' ? 'text-green-600' : 
                streamingStatus === 'connecting' ? 'text-yellow-600' : 
                streamingStatus === 'error' ? 'text-red-600' : 'text-gray-400'
              }`}>
                {streamingStatus === 'connected' ? (
                  <Wifi size={16} className="text-green-500" />
                ) : streamingStatus === 'connecting' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                ) : (
                  <WifiOff size={16} className="text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {streamingStatus === 'connected' ? 'Connected to Real-time Translation' : 
                  streamingStatus === 'connecting' ? 'Connecting...' : 
                  streamingStatus === 'error' ? 'Connection Error' : 'Not Connected'}
                </span>
              </div>
              
              {/* Server Ready Status */}
              <div className={`flex items-center space-x-2 ${isServerReady ? 'text-green-600' : 'text-yellow-600'}`}>
                <div className={`w-3 h-3 rounded-full ${isServerReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm">
                  {isServerReady ? 'Server Ready' : 'Initializing Server...'}
                </span>
              </div>
              
              {/* Connection Attempts */}
              {/* connectionAttempts is removed, so this block is removed */}
              
              {/* Processing Status */}
              {isProcessing && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Processing...</span>
                </div>
              )}
            </div>

            {/* Real-time Status Bar */}
            {isRecording && streamingStatus === 'connected' && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-green-700">
                  <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Real-time Translation Active - Live Updates</span>
                </div>
              </div>
            )}

            {/* Results Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transcription */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Globe className="mr-2" size={20} />
                  Transcription
                  {realTimeTranscription && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Live
                    </span>
                  )}
                </h3>
                <div className="bg-white rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                  {realTimeTranscription || transcription || (
                    <span className="text-gray-500">
                      {isRecording ? 'Listening... Speak now!' : 'Transcription will appear here...'}
                    </span>
                  )}
                </div>
              </div>

              {/* Translation */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Globe className="mr-2" size={20} />
                  Translation
                  {realTimeTranslation && (
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Live
                    </span>
                  )}
                </h3>
                <div className="bg-white rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                  {realTimeTranslation || translation || (
                    <span className="text-gray-500">Translation will appear here...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4 mt-6">
              <button
                onClick={downloadTranscription}
                disabled={!transcription && !realTimeTranscription}
                className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="mr-2" size={16} />
                Download Text
              </button>
              
              <button
                onClick={goToSummary}
                disabled={!transcription && !realTimeTranscription}
                className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Brain className="mr-2" size={16} />
                AI Summary
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }; 