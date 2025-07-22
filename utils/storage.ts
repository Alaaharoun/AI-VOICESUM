import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper function to determine if we're running on web
const isWeb = Platform.OS === 'web';

// Storage interface
interface StorageInterface {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

// Web storage implementation using AsyncStorage
class WebStorage implements StorageInterface {
  async getItemAsync(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('WebStorage getItemAsync error:', error);
      return null;
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn('WebStorage setItemAsync error:', error);
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('WebStorage deleteItemAsync error:', error);
    }
  }
}

// Native storage implementation using SecureStore
class NativeStorage implements StorageInterface {
  async getItemAsync(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('NativeStorage getItemAsync error:', error);
      return null;
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('NativeStorage setItemAsync error:', error);
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('NativeStorage deleteItemAsync error:', error);
    }
  }
}

// Create the appropriate storage instance
const storage: StorageInterface = isWeb ? new WebStorage() : new NativeStorage();

// Export the storage methods
export const getItemAsync = (key: string): Promise<string | null> => {
  return storage.getItemAsync(key);
};

export const setItemAsync = (key: string, value: string): Promise<void> => {
  return storage.setItemAsync(key, value);
};

export const deleteItemAsync = (key: string): Promise<void> => {
  return storage.deleteItemAsync(key);
};

// Export the storage instance for direct access if needed
export default storage; 