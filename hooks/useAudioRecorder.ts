import { useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { AudioProcessor } from '@/services/audioProcessor';

// Conditional import for expo-av to avoid TurboModule errors
let Audio: any = null;
if (Platform.OS !== 'web') {
  try {
    Audio = require('expo-av').Audio;
  } catch (error) {
    console.warn('expo-av not available:', error);
  }
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  processAudio: (
    audioBlob: Blob,
    onTranscription: (transcription: string) => void,
    onSummary: (summary: string) => void,
    targetLanguage?: string
  ) => Promise<void>;
  generateSummary: (
    transcription: string,
    onSummary: (summary: string) => void,
    targetLanguage?: string
  ) => Promise<void>;
  // New real-time methods
  startRealTimeTranscription: (
    onTranscriptionUpdate: (transcription: string) => void,
    onTranslationUpdate: (translation: string) => void,
    targetLanguage?: string,
    sourceLanguage?: string,
    useLiveTranslationServer?: boolean
  ) => Promise<void>;
  stopRealTimeTranscription: () => Promise<void>;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Real-time transcription state
  const [isRealTimeTranscribing, setIsRealTimeTranscribing] = useState(false);
  const transcriptionIntervalRef = useRef<number | null>(null);
  const lastTranscriptionRef = useRef<string>('');
  const translationDebounceRef = useRef<number | null>(null);

  // Mobile recording state
  const recordingRef = useRef<any | null>(null);
  const audioUriRef = useRef<string | null>(null);

  const startRecording = async (): Promise<void> => {
    try {
      console.log('[AudioRecorder] Starting recording...');
      
      if (Platform.OS === 'web') {
        // Web-based MediaRecorder
        console.log('[AudioRecorder] Using web MediaRecorder...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        console.log('[AudioRecorder] Web recording started successfully');
      } else {
        // Mobile recording using expo-av with minimal settings
        console.log('[AudioRecorder] Using mobile expo-av...');
        
        if (!Audio) {
          throw new Error('Audio recording not supported on this device');
        }

        console.log('[AudioRecorder] Requesting microphone permissions...');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Microphone permission not granted');
        }
        console.log('[AudioRecorder] Microphone permission granted');

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        // Use the most basic recording settings possible - no specific format
        console.log('[AudioRecorder] Creating recording...');
        const { recording } = await Audio.Recording.createAsync({
          android: {
            extension: '.mp3',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
            sampleRate: 22050,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            extension: '.mp3',
            outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW,
            sampleRate: 22050,
            numberOfChannels: 1,
            bitRate: 64000,
          },
        });
        
        recordingRef.current = recording;
        setIsRecording(true);
        console.log('[AudioRecorder] Mobile recording started successfully');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      if (Platform.OS === 'web') {
      throw new Error('Failed to start recording. Please check microphone permissions.');
      } else {
        throw new Error('Failed to start mobile recording. Please check microphone permissions.');
      }
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (Platform.OS === 'web' && mediaRecorderRef.current) {
        const mediaRecorder = mediaRecorderRef.current;
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Stop all tracks
          const stream = mediaRecorder.stream;
          stream.getTracks().forEach(track => track.stop());
          
          setIsRecording(false);
          
          // Process the audio for AssemblyAI compatibility
          try {
            const processedBlob = await AudioProcessor.processAudioForAssemblyAI(audioBlob);
            resolve(processedBlob);
          } catch (error) {
            console.error('Error processing audio:', error);
            resolve(audioBlob); // Fallback to original blob
          }
        };

        mediaRecorder.stop();
      } else if (Platform.OS !== 'web' && recordingRef.current) {
        // Mobile recording stop
        recordingRef.current.stopAndUnloadAsync().then(() => {
          const uri = recordingRef.current?.getURI();
          audioUriRef.current = uri || null;
          setIsRecording(false);
          
          if (uri) {
            // Convert URI to Blob for processing
            fetch(uri)
              .then(response => response.blob())
              .then(async audioBlob => {
                // Process audio for AssemblyAI compatibility
                const processedBlob = await AudioProcessor.processAudioForAssemblyAI(audioBlob);
                resolve(processedBlob);
              })
              .catch(() => resolve(null));
          } else {
            resolve(null);
          }
        });
      } else {
        setIsRecording(false);
        resolve(null);
      }
    });
  };

  const processAudio = async (
    audioBlob: Blob,
    onTranscription: (transcription: string) => void,
    onSummary: (summary: string) => void,
    targetLanguage?: string
  ): Promise<void> => {
    setIsProcessing(true);
    
    try {
      // Import the speech service dynamically
      const { SpeechService } = await import('@/services/speechService');
      
      // Transcribe the audio
      const transcription = await SpeechService.transcribeAudio(audioBlob, targetLanguage);
      onTranscription(transcription);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      throw new Error('Failed to process audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSummary = async (
    transcription: string,
    onSummary: (summary: string) => void,
    targetLanguage?: string
  ): Promise<void> => {
    try {
      const { SpeechService } = await import('@/services/speechService');
      const summary = await SpeechService.summarizeText(transcription, targetLanguage);
      onSummary(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate summary. Please try again.');
    }
  };

  // New real-time transcription method
  const startRealTimeTranscription = async (
    onTranscriptionUpdate: (transcription: string) => void,
    onTranslationUpdate: (translation: string) => void,
    targetLanguage?: string,
    sourceLanguage?: string,
    useLiveTranslationServer?: boolean
  ): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Web-based MediaRecorder for real-time
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        lastTranscriptionRef.current = '';

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        // Start recording
        mediaRecorder.start(3000); // Get data every 3 seconds
        setIsRecording(true);
        setIsRealTimeTranscribing(true);

        // Set up periodic transcription
        transcriptionIntervalRef.current = setInterval(async () => {
          if (audioChunksRef.current.length > 0) {
            try {
              const { SpeechService } = await import('@/services/speechService');
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              
              // تأكد من أن الملف صوتي وليس فيديو
              let processedBlob = audioBlob;
              if (audioBlob.type.startsWith('video/')) {
                console.log('Converting video blob to audio blob (web)...');
                const arrayBuffer = await audioBlob.arrayBuffer();
                processedBlob = new Blob([arrayBuffer], { type: 'audio/webm' });
                console.log('Converted video to audio/webm, size:', processedBlob.size);
              }
              
              const finalBlob = await AudioProcessor.processAudioForAssemblyAI(processedBlob);
              // Use external server if enabled
              const transcription = await SpeechService.transcribeAudioRealTime(finalBlob, targetLanguage, sourceLanguage, useLiveTranslationServer);
              
              if (transcription && transcription !== lastTranscriptionRef.current) {
                lastTranscriptionRef.current = transcription;
                onTranscriptionUpdate(transcription);
                
                // Translate in real-time if language is selected
                if (targetLanguage && transcription) {
                  // Debounce translation to avoid too many API calls
                  if (translationDebounceRef.current) {
                    clearTimeout(translationDebounceRef.current);
                  }
                  
                  translationDebounceRef.current = setTimeout(async () => {
                    try {
                      const translation = await SpeechService.translateTextRealTime(transcription, targetLanguage);
                      onTranslationUpdate(translation);
                    } catch (error) {
                      console.error('Real-time translation error:', error);
                    }
                  }, 1000); // Wait 1 second before translating
                }
              }
              
              // Clear chunks after processing
              audioChunksRef.current = [];
            } catch (error) {
              console.error('Real-time transcription error:', error);
            }
          }
        }, 4000); // Process every 4 seconds

      } else {
        // Mobile real-time transcription using regular recording with periodic processing
        if (!Audio) {
          throw new Error('Audio recording not supported on this device');
        }

        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Microphone permission not granted');
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        // Start recording for mobile real-time
        const { recording } = await Audio.Recording.createAsync({
          android: {
            extension: '.mp3',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
            sampleRate: 22050,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            extension: '.mp3',
            outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW,
            sampleRate: 22050,
            numberOfChannels: 1,
            bitRate: 64000,
          },
        });
        
        recordingRef.current = recording;
        setIsRecording(true);
        setIsRealTimeTranscribing(true);
        lastTranscriptionRef.current = '';

        // Set up periodic processing for mobile (every 5 seconds)
        transcriptionIntervalRef.current = setInterval(async () => {
          if (recordingRef.current) {
            try {
              const uri = recordingRef.current.getURI();
              if (uri) {
                const response = await fetch(uri);
                const audioBlob = await response.blob();
                
                // تحقق من حجم الصوت قبل الإرسال
                if (audioBlob.size < 1000) {
                  console.log('Audio too small, skipping...');
                  return;
                }
                
                // تأكد من أن الملف صوتي وليس فيديو
                let processedBlob = audioBlob;
                if (audioBlob.type.startsWith('video/')) {
                  console.log('Converting video blob to audio blob...');
                  const arrayBuffer = await audioBlob.arrayBuffer();
                  processedBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                  console.log('Converted video to audio/mpeg, size:', processedBlob.size);
                }
                
                const finalBlob = await AudioProcessor.processAudioForAssemblyAI(processedBlob);
                const { SpeechService } = await import('@/services/speechService');
                
                // Use external server if enabled
                const transcription = await SpeechService.transcribeAudioRealTime(finalBlob, targetLanguage, sourceLanguage, useLiveTranslationServer);
                
                if (transcription && transcription !== lastTranscriptionRef.current) {
                  lastTranscriptionRef.current = transcription;
                  onTranscriptionUpdate(transcription);
                  
                  // Translate in real-time if language is selected
                  if (targetLanguage && transcription) {
                    // Debounce translation to avoid too many API calls
                    if (translationDebounceRef.current) {
                      clearTimeout(translationDebounceRef.current);
                    }
                    
                    translationDebounceRef.current = setTimeout(async () => {
                      try {
                        const translation = await SpeechService.translateTextRealTime(transcription, targetLanguage);
                        onTranslationUpdate(translation);
                      } catch (error) {
                        console.error('Real-time translation error:', error);
                      }
                    }, 1000); // Wait 1 second before translating
                  }
                }
              }
            } catch (error) {
              console.error('Mobile real-time transcription error:', error);
              // لا توقف التسجيل عند حدوث خطأ، فقط اطبع الخطأ
            }
          }
        }, 5000); // Process every 5 seconds on mobile
      }

    } catch (error) {
      console.error('Error starting real-time transcription:', error);
      if (Platform.OS === 'web') {
        throw new Error('Failed to start real-time transcription. Please check microphone permissions.');
      } else {
        throw new Error('Failed to start mobile real-time transcription. Please check microphone permissions.');
      }
    }
  };

  const stopRealTimeTranscription = async (): Promise<void> => {
    return new Promise((resolve) => {
      // Clear intervals
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
        transcriptionIntervalRef.current = null;
      }
      
      if (translationDebounceRef.current) {
        clearTimeout(translationDebounceRef.current);
        translationDebounceRef.current = null;
      }

      if (Platform.OS === 'web' && mediaRecorderRef.current) {
        const mediaRecorder = mediaRecorderRef.current;
        
        mediaRecorder.onstop = () => {
          // Stop all tracks
          const stream = mediaRecorder.stream;
          stream.getTracks().forEach(track => track.stop());
          
          setIsRecording(false);
          setIsRealTimeTranscribing(false);
          resolve();
        };

        mediaRecorder.stop();
      } else if (Platform.OS !== 'web' && recordingRef.current) {
        // Stop mobile recording
        try {
          recordingRef.current.stopAndUnloadAsync().then(() => {
            setIsRecording(false);
            setIsRealTimeTranscribing(false);
            resolve();
          }).catch(() => {
            setIsRecording(false);
            setIsRealTimeTranscribing(false);
            resolve();
          });
        } catch (error) {
          console.error('Error stopping mobile recording:', error);
          setIsRecording(false);
          setIsRealTimeTranscribing(false);
          resolve();
        }
      } else {
        setIsRecording(false);
        setIsRealTimeTranscribing(false);
        resolve();
      }
    });
  };

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    processAudio,
    generateSummary,
    startRealTimeTranscription,
    stopRealTimeTranscription,
  };
}