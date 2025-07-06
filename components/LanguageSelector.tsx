import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ChevronDown, Languages, Check } from 'lucide-react-native';
import { SpeechService } from '@/services/speechService';

interface Language {
  code: string;
  name: string;
  flag: string;
}

interface LanguageSelectorProps {
  selectedLanguage: Language | null;
  onSelectLanguage: (language: Language) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  selectedLanguage,
  onSelectLanguage,
  disabled = false,
}: LanguageSelectorProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const languages = SpeechService.getAvailableLanguages();

  const handleSelectLanguage = (language: Language) => {
    onSelectLanguage(language);
    setIsModalVisible(false);
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
      </View>
      {selectedLanguage?.code === item.code && (
        <Check size={20} color="#2563EB" />
      )}
    </TouchableOpacity>
  );

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
            {selectedLanguage ? (
              <>
                {selectedLanguage.flag} {selectedLanguage.name}
              </>
            ) : (
              'Select Language'
            )}
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
              <Text style={styles.modalTitle}>Select Translation Language</Text>
            </View>
            <FlatList
              data={languages}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
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
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
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
});