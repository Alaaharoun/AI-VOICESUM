import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ChevronDown, Languages, Check, Globe } from 'lucide-react-native';
import { SpeechService } from '@/services/speechService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = {
  code: string;
  name: string;
  flag: string;
};

interface LanguageSelectorProps {
  selectedLanguage: Language | null;
  onSelectLanguage: (language: Language) => void;
  disabled?: boolean;
}

const STORAGE_KEY = 'selected_translation_language';

export function LanguageSelector({
  selectedLanguage,
  onSelectLanguage,
  disabled = false,
}: LanguageSelectorProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const languages = SpeechService.getAvailableLanguages();

  // إضافة خيار الكشف التلقائي في بداية القائمة
  const allLanguages = [
    { code: 'auto', name: 'Autodetect', flag: '🌐' },
    ...languages
  ];

  // اللغات السريعة الأكثر استخداماً
  const quickLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
  ];

  // تحميل اللغة المحفوظة عند بدء المكون
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguageCode = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedLanguageCode && !selectedLanguage) {
        const savedLanguage = allLanguages.find(lang => lang.code === savedLanguageCode);
        if (savedLanguage) {
          onSelectLanguage(savedLanguage);
        }
      }
    } catch (error) {
      console.warn('Failed to load saved language:', error);
    }
  };

  const handleSelectLanguage = async (language: Language) => {
    try {
      // حفظ الاختيار في AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, language.code);
      onSelectLanguage(language);
      setIsModalVisible(false);
    } catch (error) {
      console.warn('Failed to save language selection:', error);
      // حتى لو فشل الحفظ، استمر في اختيار اللغة
    onSelectLanguage(language);
    setIsModalVisible(false);
    }
  };

  const renderLanguageItem = ({ item }: { item: Language }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        selectedLanguage?.code === item.code && styles.selectedLanguageItem,
      ]}
      onPress={() => handleSelectLanguage(item)}
    >
      <View style={styles.languageInfo}>
        <Text style={styles.flag}>{item.flag}</Text>
        <Text style={styles.languageName}>{item.name}</Text>
        {item.code === 'auto' && (
          <Text style={styles.autoDetectText}> (Auto-detect source language)</Text>
        )}
      </View>
      {selectedLanguage?.code === item.code && (
        <Check size={20} color="#2563EB" />
      )}
    </TouchableOpacity>
  );

  const getDisplayText = () => {
    if (selectedLanguage) {
      if (selectedLanguage.code === 'auto') {
        return '🌐 Autodetect';
      }
      return `${selectedLanguage.flag} ${selectedLanguage.name}`;
    }
    return 'Select Language';
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={() => setIsModalVisible(true)}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <Languages size={18} color={disabled ? '#9CA3AF' : '#6B7280'} />
          <Text style={[styles.selectorText, disabled && styles.selectorTextDisabled]}>
            {getDisplayText()}
          </Text>
        </View>
        <ChevronDown size={16} color={disabled ? '#9CA3AF' : '#6B7280'} />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setIsModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Globe size={24} color="#2563EB" style={{ marginBottom: 8 }} />
              <Text style={styles.modalTitle}>Select Translation Language</Text>
              <Text style={styles.modalSubtitle}>
                Choose the language you want to translate to
              </Text>
            </View>
            <FlatList
              data={allLanguages}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={() => (
                <View style={styles.quickLanguagesSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.quickLanguagesTitle}>Quick Languages</Text>
                    <TouchableOpacity
                      style={styles.resetButton}
                      onPress={() => handleSelectLanguage({ code: 'auto', name: 'Autodetect', flag: '🌐' })}
                    >
                      <Text style={styles.resetButtonText}>Reset to Auto</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.quickLanguagesGrid}>
                    {quickLanguages.map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        style={[
                          styles.quickLanguageItem,
                          selectedLanguage?.code === lang.code && styles.selectedQuickLanguageItem,
                        ]}
                        onPress={() => handleSelectLanguage(lang)}
                      >
                        <Text style={styles.quickLanguageFlag}>{lang.flag}</Text>
                        <Text style={styles.quickLanguageName}>{lang.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectorDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 8,
  },
  selectorTextDisabled: {
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  languageList: {
    maxHeight: 400,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedLanguageItem: {
    backgroundColor: '#EFF6FF',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  autoDetectText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  quickLanguagesSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickLanguagesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  quickLanguagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickLanguageItem: {
    width: '18%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedQuickLanguageItem: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickLanguageFlag: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickLanguageName: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  resetButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
  },
});