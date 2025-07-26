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

export type Language = {
  code: string;
  name: string;
  flag: string;
};

interface LanguageSelectorProps {
  selectedLanguage: Language | null;
  onSelectLanguage: (language: Language) => void;
  disabled?: boolean;
  title?: string; // إضافة عنوان مخصص للنافذة المنبثقة
  subtitle?: string; // إضافة نص فرعي مخصص
}

export function LanguageSelector({
  selectedLanguage,
  onSelectLanguage,
  disabled = false,
  title = 'Select Translation Language',
  subtitle = 'Choose the language you want to translate to',
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

  // إعادة تحميل اللغة عند تغيير selectedLanguage من الخارج
  useEffect(() => {
    if (selectedLanguage) {
      console.log(`[LanguageSelector] External language change detected: ${selectedLanguage.name} (${selectedLanguage.code})`);
    }
  }, [selectedLanguage]);

  const handleSelectLanguage = async (language: Language) => {
    try {
      console.log(`[LanguageSelector] Selecting language: ${language.name} (${language.code})`);
      
      // تحديث اللغة المحددة عبر Context
      onSelectLanguage(language);
      
      // إغلاق النافذة المنبثقة
      setIsModalVisible(false);
      
      console.log(`[LanguageSelector] ✅ Language selection completed successfully`);
    } catch (error) {
      console.warn('Failed to select language:', error);
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
          <Text style={styles.autoDetectText}> (Auto-detect {selectedLanguage?.code === 'auto' ? 'source' : 'target'} language)</Text>
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
        onRequestClose={() => {
          console.log('[LanguageSelector] Modal closed by back button');
          setIsModalVisible(false);
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            console.log('[LanguageSelector] Modal closed by overlay press');
            setIsModalVisible(false);
          }}
        >
          <View style={styles.modalContent}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Globe size={24} color="#2563EB" style={{ marginBottom: 8 }} />
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalSubtitle}>
                  {subtitle}
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
            </Pressable>
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