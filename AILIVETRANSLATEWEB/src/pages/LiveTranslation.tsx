  import React, { useState, useRef, useEffect } from 'react';
  import { Mic, MicOff, Download, Globe, Brain, Wifi, WifiOff } from 'lucide-react';
  import { useNavigate } from 'react-router-dom';
  import { RenderWebSocketService } from '../services/renderWebSocketService';
  import { AudioConverter } from '../services/audioConverter';
  import { supabase } from '../lib/supabase';
  import { useAuthStore } from '../stores/authStore';
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
    
    const renderWebSocketServiceRef = useRef<RenderWebSocketService | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const { user } = useAuthStore();

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
        
        // Wait for server to be ready (check every 100ms for up to 15 seconds)
        let attempts = 0;
        const maxAttempts = 150; // 15 seconds
        
        while (attempts < maxAttempts) {
          if (renderWebSocketServiceRef.current?.isInitializedStatus()) {
            setIsServerReady(true);
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
        
        // Initialize Render WebSocket service first
        console.log('🔌 Initializing Render WebSocket service...');
        await initializeRenderWebSocketService();
        
        // Check if Render WebSocket service is connected and initialized
        if (!renderWebSocketServiceRef.current || !renderWebSocketServiceRef.current.isConnectedStatus()) {
          console.log('⚠️ Render WebSocket service not connected, stopping recording');
          setIsRecording(false);
          setIsProcessing(false);
          setError('Failed to connect to Render WebSocket service. Please try again.');
          return;
        }
        
        if (!renderWebSocketServiceRef.current.isInitializedStatus()) {
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
          audio: optimalSettings
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
        
        // Use AudioContext to capture raw PCM data instead of MediaRecorder
        console.log('🎵 Using AudioContext for raw PCM capture');
        
        const audioContext = new AudioContext({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
        
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        // Store references for cleanup
        audioContextRef.current = audioContext;
        processorRef.current = processor;
        
        processor.onaudioprocess = (event) => {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array (PCM 16-bit)
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Create blob from PCM data
          const audioBlob = new Blob([pcmData], { type: 'audio/pcm' });
          
          console.log('📦 Raw PCM chunk received:', pcmData.length * 2, 'bytes');
          
          // Send audio chunk to Render WebSocket service
          if (renderWebSocketServiceRef.current && renderWebSocketServiceRef.current.isConnectedStatus()) {
            renderWebSocketServiceRef.current.sendAudioChunk(audioBlob);
          }
        };
        
        // Connect the audio processing chain
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log('✅ Raw PCM recording started successfully');
        
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
        
        // Immediately update UI state
        setIsRecording(false);
        setIsProcessing(false);
        setStreamingStatus('idle');
        
        // Stop AudioContext processing
        if (processorRef.current) {
          processorRef.current.disconnect();
          console.log('✅ Audio processor disconnected');
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
        processorRef.current = null;
        
        // Disconnect Render WebSocket service
        if (renderWebSocketServiceRef.current) {
          renderWebSocketServiceRef.current.disconnect();
          console.log('🔌 Render WebSocket service disconnected');
        }
        
        console.log('✅ Recording stopped successfully');
        
      } catch (error) {
        console.error('❌ Error stopping recording:', error);
        // Force reset state even if there's an error
        setIsRecording(false);
        setIsProcessing(false);
        setStreamingStatus('idle');
        audioStreamRef.current = null;
        audioContextRef.current = null;
        processorRef.current = null;
        
        // Note: Stream cleanup is handled in the main try block above
      }
    };

    const saveToDatabase = async () => {
      if (!user) return;

      try {
        const finalTranscription = realTimeTranscription || transcription;
        const finalTranslation = realTimeTranslation || translation;

        if (finalTranscription || finalTranslation) {
          const { error } = await supabase
            .from('transcriptions')
            .insert({
              user_id: user.id,
              transcription: finalTranscription,
              translation: finalTranslation,
              source_language: sourceLanguage,
              target_language: targetLanguage,
              engine: 'azure', // Assuming engine is azure for now
              created_at: new Date().toISOString(),
            });

          if (error) {
            console.error('Error saving to database:', error);
          } else {
            console.log('Transcription saved to database');
          }
        }
      } catch (error) {
        console.error('Error saving to database:', error);
      }
    };

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



    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (renderWebSocketServiceRef.current) {
          renderWebSocketServiceRef.current.disconnect();
        }
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

                      {/* Render WebSocket Status */}
            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <div>
                      <h3 className="text-sm font-medium text-green-900">Render WebSocket Server</h3>
                      <p className="text-xs text-green-700">Connected to ai-voicesum.onrender.com</p>
                    </div>
                  </div>
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