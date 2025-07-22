import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Ensures microphone permission is granted
 * @returns Promise<boolean> - true if permission granted, false if denied
 */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone for voice recording and live translation.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  }
  
  // For iOS, permissions are typically handled automatically
  // You can add iOS-specific logic here if needed
  return true;
}

/**
 * Checks if microphone permission is already granted
 * @returns Promise<boolean> - true if permission is granted
 */
export async function checkMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return granted;
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return false;
    }
  }
  
  // For iOS, assume permission is granted
  return true;
} 