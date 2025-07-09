import { useState, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import { Audio } from 'expo-av';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';

interface UseHybridAudioRecorderReturn {
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
  usingNativeRecorder: boolean;
  showSettingsButton: boolean;
}

export const useHybridAudioRecorder = (): UseHybridAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usingNativeRecorder, setUsingNativeRecorder] = useState(false);
  const [showSettingsButton, setShowSettingsButton] = useState(false);

  const audioRecorderPlayer = useRef<AudioRecorderPlayer | null>(null);
  const expoRecording = useRef<Audio.Recording | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Cache permissions to avoid repeated requests
  const permissionsGranted = useRef<boolean>(false);
  const storagePermissionsGranted = useRef<boolean>(false);

  // Initialize the native audio recorder
  const initializeNativeRecorder = useCallback(() => {
    if (!audioRecorderPlayer.current) {
      try {
        audioRecorderPlayer.current = new AudioRecorderPlayer();
        console.log('Native AudioRecorderPlayer initialized successfully');
        return true;
      } catch (err) {
        console.error('Failed to initialize native AudioRecorderPlayer:', err);
        return false;
      }
    }
    return true;
  }, []);

  // Explicitly request storage permissions
  const requestStoragePermissions = useCallback(async (): Promise<boolean> => {
    // Return cached permission if already granted
    if (storagePermissionsGranted.current) {
      return true;
    }

    if (Platform.OS === 'android') {
      try {
        console.log('Requesting storage permissions...');
        
        const writePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Access Required',
            message: 'This app needs to save audio recordings to your device storage.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );

        const readPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'File Access Required',
            message: 'This app needs to access files from your device storage.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );

        const granted = 
          writePermission === PermissionsAndroid.RESULTS.GRANTED &&
          readPermission === PermissionsAndroid.RESULTS.GRANTED;

        if (granted) {
          storagePermissionsGranted.current = true;
        }

        console.log('Storage permissions granted:', granted);
        return granted;
      } catch (err) {
        console.error('Storage permission request failed:', err);
        return false;
      }
    }
    
    // For iOS, storage permissions are handled differently
    storagePermissionsGranted.current = true;
    return true;
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // Return cached permission if already granted
    if (permissionsGranted.current) {
      return true;
    }

    if (Platform.OS === 'android') {
      try {
        // Request microphone permission
        const micPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        // For Android 10+ (API level 29+), we need to request storage permissions differently
        const androidVersion = Platform.Version;
        let storagePermissionsGranted = true;

        if (androidVersion < 29) {
          // Request storage permissions for older Android versions
          const writePermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'This app needs access to storage to save recordings.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          const readPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: 'File Access Permission',
              message: 'This app needs to read files from storage.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          storagePermissionsGranted = 
            writePermission === PermissionsAndroid.RESULTS.GRANTED &&
            readPermission === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          // For Android 10+, request storage permission explicitly
          const writePermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'This app needs access to storage to save recordings.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          storagePermissionsGranted = writePermission === PermissionsAndroid.RESULTS.GRANTED;
        }

        const allGranted = 
          micPermission === PermissionsAndroid.RESULTS.GRANTED &&
          storagePermissionsGranted;

        if (allGranted) {
          permissionsGranted.current = true;
          console.log('All permissions granted');
        }

        return allGranted;
      } catch (err) {
        console.error('Permission request failed:', err);
        return false;
      }
    }
    
    // For iOS, permissions are handled differently
    permissionsGranted.current = true;
    return true;
  }, []);

  const startNativeRecording = useCallback(async (): Promise<true | string> => {
    try {
      if (!initializeNativeRecorder() || !audioRecorderPlayer.current) {
        const msg = '[Recorder] Native recorder not initialized';
        console.error(msg);
        return msg;
      }
      let path = '';
      if (Platform.OS === 'android') {
        const androidVersion = Platform.Version;
        if (androidVersion >= 29) {
          path = '/storage/emulated/0/Android/data/com.anonymous.boltexponativewind/files/audio_recording.wav';
        } else {
          path = '/storage/emulated/0/Download/audio_recording.wav';
        }
      } else {
        path = 'audio_recording.m4a';
      }
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
        AudioSamplingRateAndroid: 16000,
        AudioChannelsAndroid: 1,
        AudioEncodingBitRateAndroid: 128000,
      };
      const uri = await audioRecorderPlayer.current.startRecorder(path, audioSet);
      console.log('[Recorder] Native recording started at:', uri);
      if (!uri) {
        const msg = '[Recorder] Native recording failed: No URI returned';
        console.error(msg);
        return msg;
      }
      return true;
    } catch (err) {
      const msg = `[Recorder] Native recording failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      return msg;
    }
  }, [initializeNativeRecorder]);

  const startExpoRecording = useCallback(async (): Promise<true | string> => {
    try {
      if (expoRecording.current) {
        try {
          await expoRecording.current.stopAndUnloadAsync();
        } catch (err) {
          console.log('[Recorder] Error cleaning up previous Expo recording:', err);
        }
        expoRecording.current = null;
      }
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      expoRecording.current = recording;
      console.log('[Recorder] Expo recording started');
      if (!recording) {
        const msg = '[Recorder] Expo recording failed: No recording object returned';
        console.error(msg);
        return msg;
      }
      return true;
    } catch (err) {
      const msg = `[Recorder] Expo recording failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      return msg;
    }
  }, []);

  const requestAllPermissions = useCallback(async (): Promise<boolean> => {
    // Always re-request to avoid stale cache
    permissionsGranted.current = false;
    storagePermissionsGranted.current = false;
    if (Platform.OS === 'android') {
      try {
        console.log('[Permissions] Requesting RECORD_AUDIO, WRITE_EXTERNAL_STORAGE, READ_EXTERNAL_STORAGE');
        const permissions = [
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ];
        const results = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted =
          results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
        if (allGranted) {
          permissionsGranted.current = true;
          storagePermissionsGranted.current = true;
          console.log('[Permissions] All permissions granted');
          return true;
        } else {
          console.warn('[Permissions] One or more permissions denied:', results);
          return false;
        }
      } catch (err) {
        console.error('[Permissions] Permission request failed:', err);
        return false;
      }
    }
    // For iOS, assume permissions are handled elsewhere
    permissionsGranted.current = true;
    storagePermissionsGranted.current = true;
    return true;
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setShowSettingsButton(false);
      console.log('[Recorder] Requesting all permissions...');
      const allGranted = await requestAllPermissions();
      console.log('[Recorder] All permissions result:', allGranted);
      if (!allGranted) {
        const msg = 'Microphone and storage permissions are required. Please allow them in your device settings.';
        setError(msg);
        setShowSettingsButton(true);
        return;
      }
      // Try native recording first
      console.log('[Recorder] Trying native recording...');
      const nativeResult = await startNativeRecording();
      if (nativeResult === true) {
        setUsingNativeRecorder(true);
        setIsRecording(true);
        setIsPaused(false);
        setCurrentPosition(0);
        setCurrentDuration(0);
        setRecordTime('00:00:00');
        console.log('[Recorder] Native recording started successfully.');
        recordingTimer.current = setInterval(() => {
          setCurrentPosition(prev => {
            const newPosition = prev + 100;
            if (audioRecorderPlayer.current) {
              setRecordTime(audioRecorderPlayer.current.mmssss(Math.floor(newPosition)));
            }
            return newPosition;
          });
        }, 100);
        return;
      } else if (typeof nativeResult === 'string') {
        setError(nativeResult);
        setShowSettingsButton(false);
        return;
      }
      // Fallback to Expo recording
      console.log('[Recorder] Falling back to Expo recording...');
      const expoResult = await startExpoRecording();
      if (expoResult === true) {
        setUsingNativeRecorder(false);
        setIsRecording(true);
        setIsPaused(false);
        setCurrentPosition(0);
        setCurrentDuration(0);
        setRecordTime('00:00:00');
        console.log('[Recorder] Expo recording started successfully.');
        recordingTimer.current = setInterval(() => {
          setCurrentPosition(prev => {
            const newPosition = prev + 100;
            setRecordTime(formatTime(newPosition));
            return newPosition;
          });
        }, 100);
        return;
      } else if (typeof expoResult === 'string') {
        setError(expoResult);
        setShowSettingsButton(false);
        return;
      }
    } catch (err) {
      const msg = `[Recorder] Error starting recording: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      setError(msg);
      setShowSettingsButton(false);
    }
  }, [requestAllPermissions, startNativeRecording, startExpoRecording]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      console.log('[Recorder] Stopping recording...');
      if (!isRecording) {
        console.log('[Recorder] No active recording to stop.');
        return null;
      }
      if (usingNativeRecorder && audioRecorderPlayer.current) {
        const result = await audioRecorderPlayer.current.stopRecorder();
        console.log('[Recorder] Native recording stopped, file saved at:', result);
        setIsRecording(false);
        setIsPaused(false);
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
          recordingTimer.current = null;
        }
        return result;
      } else if (!usingNativeRecorder && expoRecording.current) {
        console.log('[Recorder] Stopping Expo recording...');
        await expoRecording.current.stopAndUnloadAsync();
        const uri = expoRecording.current.getURI();
        console.log('[Recorder] Expo recording stopped, file saved at:', uri);
        setIsRecording(false);
        setIsPaused(false);
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
          recordingTimer.current = null;
        }
        expoRecording.current = null;
        return uri;
      }
      console.log('[Recorder] No active recording to stop');
      return null;
    } catch (err) {
      console.error('[Recorder] Error stopping recording:', err);
      setError('Failed to stop recording');
      return null;
    }
  }, [isRecording, usingNativeRecorder]);

  const pauseRecording = useCallback(async (): Promise<void> => {
    try {
      if (!isRecording || isPaused) return;

      if (usingNativeRecorder && audioRecorderPlayer.current) {
        await audioRecorderPlayer.current.pauseRecorder();
      } else if (!usingNativeRecorder && expoRecording.current) {
        await expoRecording.current.pauseAsync();
      }

      setIsPaused(true);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
    } catch (err) {
      console.error('Error pausing recording:', err);
      setError('Failed to pause recording');
    }
  }, [isRecording, isPaused, usingNativeRecorder]);

  const resumeRecording = useCallback(async (): Promise<void> => {
    try {
      if (!isRecording || !isPaused) return;

      if (usingNativeRecorder && audioRecorderPlayer.current) {
        await audioRecorderPlayer.current.resumeRecorder();
      } else if (!usingNativeRecorder && expoRecording.current) {
        await expoRecording.current.startAsync();
      }

      setIsPaused(false);

      // Restart timer
      recordingTimer.current = setInterval(() => {
        setCurrentPosition(prev => {
          const newPosition = prev + 100;
          if (usingNativeRecorder && audioRecorderPlayer.current) {
            setRecordTime(audioRecorderPlayer.current.mmssss(Math.floor(newPosition)));
          } else {
            setRecordTime(formatTime(newPosition));
          }
          return newPosition;
        });
      }, 100);
    } catch (err) {
      console.error('Error resuming recording:', err);
      setError('Failed to resume recording');
    }
  }, [isRecording, isPaused, usingNativeRecorder]);

  const resetRecording = useCallback((): void => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordTime('00:00:00');
    setCurrentPosition(0);
    setCurrentDuration(0);
    setError(null);
    setUsingNativeRecorder(false);
    
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
  }, []);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const openAppSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Error', 'Unable to open app settings. Please do it manually.');
    });
  };

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
    usingNativeRecorder,
    showSettingsButton,
  };
}; 