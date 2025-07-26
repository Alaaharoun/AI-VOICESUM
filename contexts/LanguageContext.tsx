import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Language {
  code: string;
  name: string;
  flag: string;
}

interface LanguageContextType {
  selectedSourceLanguage: Language | null;
  selectedTargetLanguage: Language | null;
  setSelectedSourceLanguage: (language: Language | null) => void;
  setSelectedTargetLanguage: (language: Language | null) => void;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

// Storage keys for persistent language selection
const SOURCE_LANGUAGE_STORAGE_KEY = 'selected_source_language';
const TARGET_LANGUAGE_STORAGE_KEY = 'selected_target_language';

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [selectedSourceLanguage, setSelectedSourceLanguageState] = useState<Language | null>({
    code: 'auto',
    name: 'Auto Detect',
    flag: '🌐'
  });
  const [selectedTargetLanguage, setSelectedTargetLanguageState] = useState<Language | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved languages from AsyncStorage on mount
  useEffect(() => {
    const loadSavedLanguages = async () => {
      try {
        console.log('🔄 [LanguageContext] Loading saved languages from AsyncStorage...');
        
        // Load source language
        const savedSourceCode = await AsyncStorage.getItem(SOURCE_LANGUAGE_STORAGE_KEY);
        if (savedSourceCode) {
          const sourceLanguage = { code: savedSourceCode, name: 'Auto Detect', flag: '🌐' };
          setSelectedSourceLanguageState(sourceLanguage);
          console.log('✅ [LanguageContext] Loaded source language:', savedSourceCode);
        }
        
        // Load target language
        const savedTargetCode = await AsyncStorage.getItem(TARGET_LANGUAGE_STORAGE_KEY);
        if (savedTargetCode) {
          // Find the language in the available languages list
          const { SpeechService } = await import('@/services/speechService');
          const availableLanguages = SpeechService.getAvailableLanguages();
          const targetLanguage = availableLanguages.find(lang => lang.code === savedTargetCode);
          
          if (targetLanguage) {
            setSelectedTargetLanguageState(targetLanguage);
            console.log('✅ [LanguageContext] Loaded target language:', targetLanguage.name);
          } else {
            console.warn('⚠️ [LanguageContext] Saved target language not found in available languages:', savedTargetCode);
          }
        }
      } catch (error) {
        console.error('❌ [LanguageContext] Failed to load saved languages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedLanguages();
  }, []);

  // Wrapper functions to save to AsyncStorage when languages change
  const setSelectedSourceLanguage = async (language: Language | null) => {
    try {
      setSelectedSourceLanguageState(language);
      
      if (language) {
        await AsyncStorage.setItem(SOURCE_LANGUAGE_STORAGE_KEY, language.code);
        console.log('💾 [LanguageContext] Saved source language:', language.code);
      } else {
        await AsyncStorage.removeItem(SOURCE_LANGUAGE_STORAGE_KEY);
        console.log('🗑️ [LanguageContext] Removed source language from storage');
      }
    } catch (error) {
      console.error('❌ [LanguageContext] Failed to save source language:', error);
    }
  };

  const setSelectedTargetLanguage = async (language: Language | null) => {
    try {
      setSelectedTargetLanguageState(language);
      
      if (language) {
        await AsyncStorage.setItem(TARGET_LANGUAGE_STORAGE_KEY, language.code);
        console.log('💾 [LanguageContext] Saved target language:', language.code);
      } else {
        await AsyncStorage.removeItem(TARGET_LANGUAGE_STORAGE_KEY);
        console.log('🗑️ [LanguageContext] Removed target language from storage');
      }
    } catch (error) {
      console.error('❌ [LanguageContext] Failed to save target language:', error);
    }
  };

  const value = {
    selectedSourceLanguage,
    selectedTargetLanguage,
    setSelectedSourceLanguage,
    setSelectedTargetLanguage,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}; 