import React from 'react';
import { ChevronDown } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  flag: string;
}

interface LanguageDropdownProps {
  label: string;
  selectedLanguage: Language | null;
  languages: Language[];
  onLanguageSelect: (language: Language) => void;
  showAutoDetect?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  label,
  selectedLanguage,
  languages,
  onLanguageSelect,
  showAutoDetect = false,
  isOpen,
  onToggle
}) => {
  const handleLanguageSelect = (language: Language) => {
    onLanguageSelect(language);
    onToggle();
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      <button
        onClick={onToggle}
        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <div className="flex items-center space-x-3">
          {selectedLanguage ? (
            <>
              <span className="text-xl">{selectedLanguage.flag}</span>
              <span className="text-gray-900 font-medium">{selectedLanguage.name}</span>
            </>
          ) : (
            <span className="text-gray-500">Select language</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {showAutoDetect && (
            <button
              onClick={() => handleLanguageSelect({ code: 'auto', name: 'Auto-detect', flag: '🌐' })}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center space-x-3 border-b border-gray-100"
            >
              <span className="text-xl">🌐</span>
              <span className="text-gray-900 font-medium">Auto-detect</span>
            </button>
          )}
          
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageSelect(language)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center space-x-3 transition-colors"
            >
              <span className="text-xl">{language.flag}</span>
              <span className="text-gray-900 font-medium">{language.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};