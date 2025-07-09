import { useState, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';

interface UseNativeAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordTime: string;
  currentPosition: number;
  currentDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  resetRecording: () => void;
  error: string | null;
}

export const useNativeAudioRecorder = (): UseNativeAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRecorderPlayer = useRef<AudioRecorderPlayer | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize the audio recorder
  const initializeRecorder = useCallback(() => {
    if (!audioRecorderPlayer.current) {
      try {
        audioRecorderPlayer.current = new AudioRecorderPlayer();
        console.log('AudioRecorderPlayer initialized successfully');
      } catch (err) {
        console.error('Failed to initialize AudioRecorderPlayer:', err);
        setError('Failed to initialize audio recorder');
      }
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Permission request failed:', err);
        return false;
      }
    }
    return true; // iOS handles permissions differently
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      
      // Initialize recorder if needed
      initializeRecorder();
      
      if (!audioRecorderPlayer.current) {
        setError('Audio recorder not initialized');
        return;
      }
      
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setError('Microphone permission is required');
        return;
      }

      const path = Platform.select({
        ios: 'audio_recording.m4a',
        android: 'sdcard/audio_recording.wav',
      });

      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 1, // Mono for better compatibility
        AVFormatIDKeyIOS: AVEncodingOption.aac,
        OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
        AudioSamplingRateAndroid: 16000, // 16kHz for better compatibility with AssemblyAI
        AudioChannelsAndroid: 1, // Mono
        AudioEncodingBitRateAndroid: 128000, // 128kbps
      };

      const uri = await audioRecorderPlayer.current.startRecorder(path, audioSet);
      console.log('Recording started at:', uri);
      
      setIsRecording(true);
      setIsPaused(false);
      setCurrentPosition(0);
      setCurrentDuration(0);
      setRecordTime('00:00:00');

      // Start timer to update recording time
      recordingTimer.current = setInterval(() => {
        setCurrentPosition(prev => {
          const newPosition = prev + 100;
          if (audioRecorderPlayer.current) {
            setRecordTime(audioRecorderPlayer.current.mmssss(Math.floor(newPosition)));
          }
          return newPosition;
        });
      }, 100);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
    }
  }, [requestPermissions]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      if (!isRecording || !audioRecorderPlayer.current) return null;

      const result = await audioRecorderPlayer.current.stopRecorder();
      console.log('Recording stopped, file saved at:', result);
      
      setIsRecording(false);
      setIsPaused(false);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      return result;
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Failed to stop recording');
      return null;
    }
  }, [isRecording]);

  const pauseRecording = useCallback(async (): Promise<void> => {
    try {
      if (!isRecording || isPaused || !audioRecorderPlayer.current) return;

      await audioRecorderPlayer.current.pauseRecorder();
      setIsPaused(true);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
    } catch (err) {
      console.error('Error pausing recording:', err);
      setError('Failed to pause recording');
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(async (): Promise<void> => {
    try {
      if (!isRecording || !isPaused || !audioRecorderPlayer.current) return;

      await audioRecorderPlayer.current.resumeRecorder();
      setIsPaused(false);

      // Restart timer
      recordingTimer.current = setInterval(() => {
        setCurrentPosition(prev => {
          const newPosition = prev + 100;
          if (audioRecorderPlayer.current) {
            setRecordTime(audioRecorderPlayer.current.mmssss(Math.floor(newPosition)));
          }
          return newPosition;
        });
      }, 100);
    } catch (err) {
      console.error('Error resuming recording:', err);
      setError('Failed to resume recording');
    }
  }, [isRecording, isPaused]);

  const resetRecording = useCallback((): void => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordTime('00:00:00');
    setCurrentPosition(0);
    setCurrentDuration(0);
    setError(null);
    
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
  }, []);

  return {
    isRecording,
    isPaused,
    recordTime,
    currentPosition,
    currentDuration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    error,
  };
}; 