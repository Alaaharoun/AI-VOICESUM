  import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Download, Brain, Wifi, WifiOff } from 'lucide-react';
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
    const [lidMode, setLidMode] = useState<'AtStart' | 'Continuous'>('Continuous');
    const [isProcessing, setIsProcessing] = useState(false);
    const [realTimeTranscription, setRealTimeTranscription] = useState('');
    const [realTimeTranslation, setRealTimeTranslation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isServerReady, setIsServerReady] = useState(false);
    const [streamingStatus, setStreamingStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [wsConnectionStatus, setWsConnectionStatus] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('');
    
    const renderWebSocketServiceRef = useRef<RenderWebSocketService | null>(null);
  const streamingServiceRef = useRef<any | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  let isUsingWebSocket = true;

  // Source languages with Azure Speech Service support
    const sourceLanguages = [
      { code: 'auto', name: 'Auto-detect', flag: '🌐' },
      // Arabic variants
      { code: 'ar-EG', name: 'Arabic (Egypt)', flag: '🇪🇬' },
      { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', flag: '🇸🇦' },
      { code: 'ar-AE', name: 'Arabic (UAE)', flag: '🇦🇪' },
      { code: 'ar-MA', name: 'Arabic (Morocco)', flag: '🇲🇦' },
      { code: 'ar-DZ', name: 'Arabic (Algeria)', flag: '🇩🇿' },
      { code: 'ar-TN', name: 'Arabic (Tunisia)', flag: '🇹🇳' },
      { code: 'ar-JO', name: 'Arabic (Jordan)', flag: '🇯🇴' },
      { code: 'ar-LB', name: 'Arabic (Lebanon)', flag: '🇱🇧' },
      { code: 'ar-KW', name: 'Arabic (Kuwait)', flag: '🇰🇼' },
      { code: 'ar-QA', name: 'Arabic (Qatar)', flag: '🇶🇦' },
      { code: 'ar-BH', name: 'Arabic (Bahrain)', flag: '🇧🇭' },
      { code: 'ar-OM', name: 'Arabic (Oman)', flag: '🇴🇲' },
      { code: 'ar-YE', name: 'Arabic (Yemen)', flag: '🇾🇪' },
      { code: 'ar-SY', name: 'Arabic (Syria)', flag: '🇸🇾' },
      { code: 'ar-IQ', name: 'Arabic (Iraq)', flag: '🇮🇶' },
      { code: 'ar-PS', name: 'Arabic (Palestine)', flag: '🇵🇸' },
      // English variants
      { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
      { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
      { code: 'en-AU', name: 'English (Australia)', flag: '🇦🇺' },
      { code: 'en-CA', name: 'English (Canada)', flag: '🇨🇦' },
      { code: 'en-IN', name: 'English (India)', flag: '🇮🇳' },
      { code: 'en-IE', name: 'English (Ireland)', flag: '🇮🇪' },
      { code: 'en-NZ', name: 'English (New Zealand)', flag: '🇳🇿' },
      { code: 'en-ZA', name: 'English (South Africa)', flag: '🇿🇦' },
      { code: 'en-PH', name: 'English (Philippines)', flag: '🇵🇭' },
      // French variants
      { code: 'fr-FR', name: 'French (France)', flag: '🇫🇷' },
      { code: 'fr-CA', name: 'French (Canada)', flag: '🇨🇦' },
      { code: 'fr-BE', name: 'French (Belgium)', flag: '🇧🇪' },
      { code: 'fr-CH', name: 'French (Switzerland)', flag: '🇨🇭' },
      // Spanish variants
      { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
      { code: 'es-MX', name: 'Spanish (Mexico)', flag: '🇲🇽' },
      { code: 'es-AR', name: 'Spanish (Argentina)', flag: '🇦🇷' },
      { code: 'es-CO', name: 'Spanish (Colombia)', flag: '🇨🇴' },
      { code: 'es-PE', name: 'Spanish (Peru)', flag: '🇵🇪' },
      { code: 'es-VE', name: 'Spanish (Venezuela)', flag: '🇻🇪' },
      { code: 'es-CL', name: 'Spanish (Chile)', flag: '🇨🇱' },
      // German variants
      { code: 'de-DE', name: 'German (Germany)', flag: '🇩🇪' },
      { code: 'de-AT', name: 'German (Austria)', flag: '🇦🇹' },
      { code: 'de-CH', name: 'German (Switzerland)', flag: '🇨🇭' },
      // Italian variants
      { code: 'it-IT', name: 'Italian (Italy)', flag: '🇮🇹' },
      { code: 'it-CH', name: 'Italian (Switzerland)', flag: '🇨🇭' },
      // Portuguese variants
      { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)', flag: '🇵🇹' },
      // Russian
      { code: 'ru-RU', name: 'Russian (Russia)', flag: '🇷🇺' },
      // Chinese variants
      { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
      { code: 'zh-TW', name: 'Chinese (Traditional)', flag: '🇹🇼' },
      { code: 'zh-HK', name: 'Chinese (Hong Kong)', flag: '🇭🇰' },
      // Japanese
      { code: 'ja-JP', name: 'Japanese (Japan)', flag: '🇯🇵' },
      // Korean
      { code: 'ko-KR', name: 'Korean (South Korea)', flag: '🇰🇷' },
      // Hindi
      { code: 'hi-IN', name: 'Hindi (India)', flag: '🇮🇳' },
      // Turkish
      { code: 'tr-TR', name: 'Turkish (Turkey)', flag: '🇹🇷' },
      // Dutch
      { code: 'nl-NL', name: 'Dutch (Netherlands)', flag: '🇳🇱' },
      { code: 'nl-BE', name: 'Dutch (Belgium)', flag: '🇧🇪' },
      // Swedish
      { code: 'sv-SE', name: 'Swedish (Sweden)', flag: '🇸🇪' },
      // Danish
      { code: 'da-DK', name: 'Danish (Denmark)', flag: '🇩🇰' },
      // Norwegian
      { code: 'nb-NO', name: 'Norwegian (Norway)', flag: '🇳🇴' },
      // Finnish
      { code: 'fi-FI', name: 'Finnish (Finland)', flag: '🇫🇮' },
      // Polish
      { code: 'pl-PL', name: 'Polish (Poland)', flag: '🇵🇱' },
      // Czech
      { code: 'cs-CZ', name: 'Czech (Czech Republic)', flag: '🇨🇿' },
      // Hungarian
      { code: 'hu-HU', name: 'Hungarian (Hungary)', flag: '🇭🇺' },
      // Romanian
      { code: 'ro-RO', name: 'Romanian (Romania)', flag: '🇷🇴' },
      // Bulgarian
      { code: 'bg-BG', name: 'Bulgarian (Bulgaria)', flag: '🇧🇬' },
      // Croatian
      { code: 'hr-HR', name: 'Croatian (Croatia)', flag: '🇭🇷' },
      // Slovak
      { code: 'sk-SK', name: 'Slovak (Slovakia)', flag: '🇸🇰' },
      // Slovenian
      { code: 'sl-SI', name: 'Slovenian (Slovenia)', flag: '🇸🇮' },
      // Estonian
      { code: 'et-EE', name: 'Estonian (Estonia)', flag: '🇪🇪' },
      // Latvian
      { code: 'lv-LV', name: 'Latvian (Latvia)', flag: '🇱🇻' },
      // Lithuanian
      { code: 'lt-LT', name: 'Lithuanian (Lithuania)', flag: '🇱🇹' },
      // Greek
      { code: 'el-GR', name: 'Greek (Greece)', flag: '🇬🇷' },
      // Hebrew
      { code: 'he-IL', name: 'Hebrew (Israel)', flag: '🇮🇱' },
      // Thai
      { code: 'th-TH', name: 'Thai (Thailand)', flag: '🇹🇭' },
      // Vietnamese
      { code: 'vi-VN', name: 'Vietnamese (Vietnam)', flag: '🇻🇳' },
      // Indonesian
      { code: 'id-ID', name: 'Indonesian (Indonesia)', flag: '🇮🇩' },
      // Malay
      { code: 'ms-MY', name: 'Malay (Malaysia)', flag: '🇲🇾' },
      // Filipino
      { code: 'fil-PH', name: 'Filipino (Philippines)', flag: '🇵🇭' },
      // Persian
      { code: 'fa-IR', name: 'Persian (Iran)', flag: '🇮🇷' },
      // Urdu
      { code: 'ur-PK', name: 'Urdu (Pakistan)', flag: '🇵🇰' },
      // Bengali
      { code: 'bn-IN', name: 'Bengali (India)', flag: '🇮🇳' },
      // Tamil
      { code: 'ta-IN', name: 'Tamil (India)', flag: '🇮🇳' },
      // Telugu
      { code: 'te-IN', name: 'Telugu (India)', flag: '🇮🇳' },
      // Kannada
      { code: 'kn-IN', name: 'Kannada (India)', flag: '🇮🇳' },
      // Malayalam
      { code: 'ml-IN', name: 'Malayalam (India)', flag: '🇮🇳' },
      // Gujarati
      { code: 'gu-IN', name: 'Gujarati (India)', flag: '🇮🇳' },
      // Marathi
      { code: 'mr-IN', name: 'Marathi (India)', flag: '🇮🇳' },
      // Punjabi
    { code: 'pa-IN', name: 'Punjabi (India)', flag: '🇮🇳' }
  ];

  // Target languages for translation (simplified list)
    const targetLanguages = [
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
      { code: 'fa', name: 'Persian', flag: '🇮🇷' },
      { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
      { code: 'bn', name: 'Bengali', flag: '🇮🇳' },
      { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
      { code: 'te', name: 'Telugu', flag: '🇮🇳' },
      { code: 'kn', name: 'Kannada', flag: '🇮🇳' },
      { code: 'ml', name: 'Malayalam', flag: '🇮🇳' },
      { code: 'gu', name: 'Gujarati', flag: '🇮🇳' },
      { code: 'mr', name: 'Marathi', flag: '🇮🇳' },
    { code: 'pa', name: 'Punjabi', flag: '🇮🇳' }
  ];

  // Function to automatically translate text using Google Translate
  const translateTextAutomatically = async (text: string) => {
      if (!text.trim()) return;
      
      try {
        const { TranslationService } = await import('../services/api');
        const translatedText = await TranslationService.translateText(
          text,
          targetLanguage,
          'google',
          detectedLanguage || sourceLanguage
        );
        
        setRealTimeTranslation(translatedText);
        setTranslation(translatedText);
      console.log('🌍 Automatic translation completed:', translatedText);
      } catch (error) {
        console.error('❌ Translation error:', error);
      setRealTimeTranslation('Translation failed. Please try again.');
      }
    };

  // Initialize Render WebSocket service with source and target languages
    const initializeRenderWebSocketService = async () => {
      try {
      console.log('🔧 Initializing Render WebSocket service with LID support:', { 
        sourceLanguage, 
        targetLanguage, 
        lidMode,
        autoDetection: sourceLanguage === 'auto'
      });
        setStreamingStatus('connecting');
        setIsInitializing(true);
        setError(null);
        
        // Create new Render WebSocket service instance
        renderWebSocketServiceRef.current = new RenderWebSocketService();
        
      // Connect to Render WebSocket service with callbacks and languages
        await renderWebSocketServiceRef.current.connect(
        sourceLanguage, // Use selected source language or auto-detect
          (transcriptionText: string, detectedLanguage?: string) => {
            console.log('📝 Real-time transcription received:', transcriptionText);
            console.log('🌐 Detected language:', detectedLanguage);
            if (transcriptionText && transcriptionText.trim()) {
              setRealTimeTranscription(transcriptionText);
            setTranscription(transcriptionText);
              setDetectedLanguage(detectedLanguage || '');
            
            // ✅ Automatically translate every transcription
            translateTextAutomatically(transcriptionText);
            }
          }
        );

        console.log('✅ Render WebSocket service connected successfully');
      setWsConnectionStatus(true);
        
      // Wait for server to be ready
        let attempts = 0;
      const maxAttempts = 150;
        
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
      setError(`Failed to initialize WebSocket service: ${error}`);
        throw error;
      } finally {
        setIsInitializing(false);
      }
    };

    const startRecording = async () => {
      try {
      console.log('🎤 Starting real-time translation...');
        setError(null);
        setRealTimeTranscription('');
        setRealTimeTranslation('');
        setTranscription('');
        setTranslation('');
        setIsRecording(true);
        setIsProcessing(true);
        
      // Check microphone permission
        const isGranted = await permissionHelper.isPermissionGranted();
        if (!isGranted) {
          const permissionStatus = await permissionHelper.requestMicrophonePermission();
          if (!permissionStatus.granted) {
            setError('Please allow microphone access to use this feature.');
            setIsRecording(false);
            setIsProcessing(false);
            return;
          }
        }
        
      // Initialize or reuse WebSocket service
        if (renderWebSocketServiceRef.current && renderWebSocketServiceRef.current.isConnectedStatus()) {
        console.log('✅ WebSocket service already connected, reusing...');
        setWsConnectionStatus(true);
          
          try {
            await renderWebSocketServiceRef.current.restartStreaming(
            sourceLanguage, // Use selected source language
              (transcriptionText: string, detectedLanguage?: string) => {
                if (transcriptionText && transcriptionText.trim()) {
                  setRealTimeTranscription(transcriptionText);
                setTranscription(transcriptionText);
                  setDetectedLanguage(detectedLanguage || '');
                  
                // ✅ Automatically translate
                translateTextAutomatically(transcriptionText);
                }
              }
            );
            setStreamingStatus('connected');
          setIsServerReady(true);
          } catch (error) {
          console.warn('⚠️ Failed to restart streaming, reinitializing...');
            await initializeRenderWebSocketService();
          }
        } else {
        console.log('🔌 Initializing WebSocket service...');
          await initializeRenderWebSocketService();
        }
        
        if (!renderWebSocketServiceRef.current || !renderWebSocketServiceRef.current.isConnectedStatus()) {
        setError('Failed to connect to translation service. Please try again.');
            setIsRecording(false);
            setIsProcessing(false);
            return;
      }
      
      // ✅ Start Raw PCM audio recording using AudioContext for better compatibility
      console.log('🎵 Starting Raw PCM recording for optimal Azure Speech compatibility...');
      
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
          sampleRate: 16000,
          channelCount: 1,
          autoGainControl: true,
          noiseSuppression: false,
          echoCancellation: false
        }
      });
      
      audioStreamRef.current = stream;
      
      // Create AudioContext for Raw PCM processing
      const audioContext = new AudioContext({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
      audioContextRef.current = audioContext;
      
      // Create audio source from microphone stream
      const source = audioContext.createMediaStreamSource(stream);
      
      // ✅ Use AudioWorkletNode for Raw PCM data extraction (Modern replacement for deprecated ScriptProcessorNode)
      try {
        console.log('🔧 Loading AudioWorklet processor for Raw PCM...');
        
        // Load the AudioWorklet processor
        await audioContext.audioWorklet.addModule('/src/services/pcmWorkletProcessor.js');
        console.log('✅ AudioWorklet processor loaded successfully');
        
        // Create AudioWorkletNode
        const workletNode = new AudioWorkletNode(audioContext, 'pcm-worklet-processor');
        
        // Handle PCM data from the worklet
        workletNode.port.onmessage = (event) => {
          if (!renderWebSocketServiceRef.current?.isConnectedStatus()) return;
          
          try {
            const { type, data, size } = event.data;
            
            if (type === 'pcmData') {
              // Create blob from Int16 PCM data received from worklet
              const pcmBlob = new Blob([data], { type: 'audio/pcm' });
              
              // Send Raw PCM directly to server
              renderWebSocketServiceRef.current.sendAudioChunk(pcmBlob);
              console.log('📤 Raw PCM chunk sent from AudioWorklet:', size, 'bytes (16kHz Int16)');
            }
            
          } catch (error) {
            console.error('❌ Error processing AudioWorklet PCM data:', error);
          }
        };
        
        // Connect audio processing chain
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
        
        // Store worklet reference for cleanup
        (audioContextRef.current as any).workletNode = workletNode;
        console.log('✅ AudioWorklet PCM processing chain established');
        
      } catch (workletError) {
        console.warn('⚠️ AudioWorklet not supported, falling back to ScriptProcessorNode...');
        
        // Fallback to ScriptProcessorNode for older browsers
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        let pcmChunkBuffer = new Float32Array(0);
        const targetChunkSize = 16000; // 1 second of 16kHz audio
        
        processor.onaudioprocess = (event) => {
          if (!renderWebSocketServiceRef.current?.isConnectedStatus()) return;
          
          try {
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            // Accumulate PCM data into chunks
            const newBuffer = new Float32Array(pcmChunkBuffer.length + inputData.length);
            newBuffer.set(pcmChunkBuffer);
            newBuffer.set(inputData, pcmChunkBuffer.length);
            pcmChunkBuffer = newBuffer;
            
            // Send when we have enough data
            if (pcmChunkBuffer.length >= targetChunkSize) {
              const chunkToSend = pcmChunkBuffer.slice(0, targetChunkSize);
              pcmChunkBuffer = pcmChunkBuffer.slice(targetChunkSize);
              
              // Convert to Int16 for Azure Speech
              const int16Chunk = new Int16Array(chunkToSend.length);
              for (let i = 0; i < chunkToSend.length; i++) {
                const sample = Math.max(-1, Math.min(1, chunkToSend[i]));
                int16Chunk[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
              }
              
              const pcmBlob = new Blob([int16Chunk.buffer], { type: 'audio/pcm' });
              renderWebSocketServiceRef.current.sendAudioChunk(pcmBlob);
              console.log('📤 Raw PCM chunk sent (fallback):', int16Chunk.length * 2, 'bytes');
            }
            
                } catch (error) {
            console.error('❌ Error processing fallback PCM audio:', error);
          }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        (audioContextRef.current as any).processor = processor;
      }
      
        setStreamingStatus('connected');
      console.log('✅ Raw PCM audio recording started successfully');
        
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
      console.log('🛑 Stopping Raw PCM real-time translation...');
        
        setIsRecording(false);
        setIsProcessing(false);
        setStreamingStatus('idle');
        
      // ✅ Stop AudioWorkletNode or ScriptProcessorNode for Raw PCM recording
      if (audioContextRef.current) {
        // Clean up AudioWorkletNode (modern approach)
        if ((audioContextRef.current as any).workletNode) {
          try {
            const workletNode = (audioContextRef.current as any).workletNode;
            workletNode.disconnect();
            workletNode.port.onmessage = null;
            console.log('✅ AudioWorklet PCM processor stopped and disconnected');
          } catch (workletError) {
            console.warn('⚠️ Error stopping AudioWorklet processor:', workletError);
          }
        }
        
        // Clean up ScriptProcessorNode (fallback approach)
        if ((audioContextRef.current as any).processor) {
          try {
            const processor = (audioContextRef.current as any).processor;
            processor.disconnect();
            processor.onaudioprocess = null;
            console.log('✅ ScriptProcessor PCM processor stopped and disconnected');
          } catch (processorError) {
            console.warn('⚠️ Error stopping ScriptProcessor:', processorError);
          }
        }
      }
      
      // Close AudioContext
        if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
          console.log('✅ AudioContext closed successfully');
        }).catch(error => {
          console.warn('⚠️ Error closing AudioContext:', error);
        });
      }
      
      // Stop audio tracks from microphone
          if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => {
              track.stop();
          console.log('✅ Audio track stopped:', track.kind);
        });
      }
      
      // Stop streaming but keep connection alive
      if (renderWebSocketServiceRef.current) {
        renderWebSocketServiceRef.current.stopStreaming();
        console.log('✅ WebSocket streaming stopped');
        }
        
        // Clear references
        audioStreamRef.current = null;
        audioContextRef.current = null;
      // Note: mediaRecorderRef is no longer used with Raw PCM
        
      } catch (error) {
      console.error('❌ Error stopping Raw PCM recording:', error);
        setIsRecording(false);
        setIsProcessing(false);
        setStreamingStatus('idle');
    }
  };

  const downloadResults = () => {
    const content = `Original Text: ${transcription || realTimeTranscription}\n\nTranslation: ${translation || realTimeTranslation}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
    a.download = `real-time-translation-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const goToSummary = () => {
    const params = new URLSearchParams({
      transcription: realTimeTranscription || transcription,
      translation: realTimeTranslation || translation,
      targetLanguage: targetLanguage,
      sourceLanguage: detectedLanguage || sourceLanguage,
    });
    navigate(`/summary?${params.toString()}`);
  };

  // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (renderWebSocketServiceRef.current) {
          renderWebSocketServiceRef.current.disconnect();
        }
        if (streamingServiceRef.current) {
          streamingServiceRef.current.disconnect();
      }
      };
    }, []);

    return (
      <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Real-time Translation</h1>
          <p className="text-lg text-gray-600">
            Speak and get instant transcription and translation in real-time
          </p>
                  </div>

            {/* Language Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Language
                </label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => {
                    setSourceLanguage(e.target.value);
                    // Auto-set LID mode based on language selection
                    if (e.target.value === 'auto') {
                      setLidMode('Continuous');
                    } else {
                      setLidMode('AtStart');
                    }
                  }}
              disabled={isRecording}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {sourceLanguages.map((lang) => (
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
              disabled={isRecording}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {targetLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* LID Mode Selection */}
            {sourceLanguage === 'auto' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language Detection Mode
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    lidMode === 'AtStart' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => !isRecording && setLidMode('AtStart')}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        lidMode === 'AtStart' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}></div>
                      <div>
                        <h3 className="font-medium text-gray-900">At-Start Detection</h3>
                        <p className="text-sm text-gray-600">
                          Detects language once within first 5 seconds. Best for single-language audio.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    lidMode === 'Continuous' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => !isRecording && setLidMode('Continuous')}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        lidMode === 'Continuous' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}></div>
                      <div>
                        <h3 className="font-medium text-gray-900">Continuous Detection</h3>
                        <p className="text-sm text-gray-600">
                          Real-time language detection. Best for multilingual audio.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Control Section */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Live Translation</h2>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Connection Status */}
            <div className={`mb-6 border rounded-lg p-4 ${
                wsConnectionStatus 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                    wsConnectionStatus ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <div>
                      <h3 className={`text-sm font-medium ${
                      wsConnectionStatus ? 'text-green-900' : 'text-gray-900'
                      }`}>
                      Translation Service
                      </h3>
                      <p className={`text-xs ${
                      wsConnectionStatus ? 'text-green-700' : 'text-gray-600'
                      }`}>
                        {wsConnectionStatus 
                        ? 'Connected and ready for real-time translation' 
                        : 'Ready to connect'}
                    </p>
                    {/* Language Support Status */}
                    {wsConnectionStatus && renderWebSocketServiceRef.current && (
                      <div className="mt-1">
                        <span className="text-xs text-blue-600">
                          Source: {sourceLanguages.find(l => l.code === sourceLanguage)?.name || sourceLanguage}
                        </span>
                        {sourceLanguage === 'auto' && (
                          <span className="text-xs text-purple-600 ml-2">
                            (LID: {lidMode})
                          </span>
                        )}
                        {detectedLanguage && detectedLanguage !== sourceLanguage && (
                          <span className="text-xs text-green-600 ml-2">
                            (Detected: {detectedLanguage})
                          </span>
                        )}
                    </div>
                    )}
                  </div>
                </div>
                
                {/* Language Validation Button */}
                  <div className="flex space-x-2">
                    <button
                      onClick={async () => {
                      if (renderWebSocketServiceRef.current) {
                        console.log('🔍 Testing language support...');
                        const languageInfo = renderWebSocketServiceRef.current.getLanguageInfo(sourceLanguage);
                        
                        console.log('📊 Language Information:', languageInfo);
                        
                        let message = `Language: ${sourceLanguage}\n`;
                        message += `✅ Client Supported: ${languageInfo.isClientSupported ? 'Yes' : 'No'}\n`;
                        message += `🌍 Server Confirmed: ${languageInfo.isServerConfirmed ? 'Yes' : 'Not yet tested'}\n`;
                        message += `🔍 Validation: ${languageInfo.validation.isValid ? 'Valid' : 'Invalid'}\n`;
                        
                        if (!languageInfo.validation.isValid && languageInfo.validation.suggestion) {
                          message += `💡 Suggestion: ${languageInfo.validation.suggestion}\n`;
                        }
                        
                        if (languageInfo.detectedLanguage) {
                          message += `🎯 Detected: ${languageInfo.detectedLanguage}`;
                        }
                        
                        alert(message);
                        
                        // Test server support
                        try {
                          const serverTest = await renderWebSocketServiceRef.current.testLanguageSupport(sourceLanguage);
                          console.log('🧪 Server Language Test:', serverTest);
                          
                          let serverMessage = `\nServer Test Results:\n`;
                          serverMessage += `✅ Supported: ${serverTest.isSupported ? 'Yes' : 'No'}\n`;
                          
                          if (serverTest.error) {
                            serverMessage += `❌ Error: ${serverTest.error}`;
                          }
                          
                          if (serverTest.serverResponse) {
                            serverMessage += `📊 Server Response: ${JSON.stringify(serverTest.serverResponse)}`;
                          }
                          
                          alert(message + serverMessage);
                          
                        } catch (testError) {
                          console.error('❌ Language test error:', testError);
                          alert(message + `\n❌ Server test failed: ${testError}`);
                        }
                          } else {
                        alert('❌ WebSocket service not available for language testing');
                      }
                    }}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    title="Test language support"
                  >
                    🌍 Test Language
                    </button>
                </div>
              </div>
            </div>

            {/* Recording Button */}
            <div className="text-center mb-6">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isInitializing && !isRecording}
                className={`w-20 h-20 rounded-full text-white font-bold text-lg transition-all duration-200 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } ${(isInitializing && !isRecording) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <p className="mt-3 text-sm text-gray-600">
                {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
              </p>
            </div>

            {/* Status Indicators */}
            <div className="space-y-2">
              <div className={`flex items-center space-x-2 ${isRecording ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm">
                  {isRecording ? 'Recording Active' : 'Ready to Record'}
                </span>
              </div>
              
              <div className={`flex items-center space-x-2 ${
                streamingStatus === 'connected' ? 'text-green-600' : 
                streamingStatus === 'connecting' ? 'text-yellow-600' : 
                streamingStatus === 'error' ? 'text-red-600' : 'text-gray-400'
              }`}>
                {streamingStatus === 'connected' ? (
                  <Wifi size={14} className="text-green-500" />
                ) : streamingStatus === 'connecting' ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-500"></div>
                ) : (
                  <WifiOff size={14} className="text-red-500" />
                )}
                <span className="text-sm">
                  {streamingStatus === 'connected' ? 'Real-time Translation Active' : 
                  streamingStatus === 'connecting' ? 'Connecting...' : 
                  streamingStatus === 'error' ? 'Connection Error' : 'Not Connected'}
                </span>
              </div>
              </div>
              
            {/* Real-time Status */}
            {isRecording && streamingStatus === 'connected' && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-green-700">
                  <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Live Translation in Progress</span>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Original Text */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Original Text
                {/* ✅ Enhanced language detection display */}
                {sourceLanguage === 'auto' && detectedLanguage && (
                  <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                    🎯 Detected: {sourceLanguages.find(l => l.code === detectedLanguage)?.name || detectedLanguage}
                    </span>
                  )}
                {sourceLanguage !== 'auto' && (
                  <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                    📝 {sourceLanguages.find(l => l.code === sourceLanguage)?.name || sourceLanguage}
                    </span>
                  )}
                {realTimeTranscription && (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full animate-pulse">
                    🔴 Live
                    </span>
                  )}
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                {realTimeTranscription || transcription ? (
                  <>
                    <p className="text-gray-800">{realTimeTranscription || transcription}</p>
                    {/* ✅ Show auto-detect status */}
                    {sourceLanguage === 'auto' && !detectedLanguage && isRecording && (
                      <p className="text-blue-500 italic text-sm mt-2">
                        🔍 Auto-detecting language...
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">
                    {isRecording ? (
                      sourceLanguage === 'auto' 
                        ? '🎤 Listening and auto-detecting language...' 
                        : '🎤 Listening... Speak now!'
                    ) : 'Original text will appear here...'}
                  </p>
                )}
                </div>
              
              {/* ✅ Language detection summary */}
              {sourceLanguage === 'auto' && detectedLanguage && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center text-green-700">
                    <span className="text-sm font-medium">
                      ✅ Language Auto-Detection Successful
                    </span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Detected: <strong>{sourceLanguages.find(l => l.code === detectedLanguage)?.name || detectedLanguage}</strong>
                    {' '}→ Translating to <strong>{targetLanguages.find(l => l.code === targetLanguage)?.name}</strong>
                  </p>
                </div>
              )}
              </div>

              {/* Translation */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Translation ({targetLanguages.find(l => l.code === targetLanguage)?.name})
                  {realTimeTranslation && (
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Live
                    </span>
                  )}
                </h3>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[200px]">
                {realTimeTranslation || translation ? (
                  <p className="text-gray-800 text-lg leading-relaxed">{realTimeTranslation || translation}</p>
                ) : (
                  <p className="text-gray-500 italic">Translation will appear here automatically...</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              {/* Download Button */}
              {(transcription || realTimeTranscription) && (
              <button
                  onClick={downloadResults}
                  className="w-full flex items-center justify-center space-x-2 btn-primary"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Results</span>
              </button>
              )}

              {/* AI Summary Button */}
              {(transcription || realTimeTranscription) && (
              <button
                onClick={goToSummary}
                  className="w-full flex items-center justify-center space-x-2 btn-secondary"
              >
                  <Brain className="h-4 w-4" />
                  <span>🤖 AI Summary Page</span>
              </button>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  }; 