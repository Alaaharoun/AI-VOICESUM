import React, { useState, useEffect } from 'react';
import { Mic, Copy, Languages, MessageSquare, Volume2, ArrowRight } from 'lucide-react';
import { LanguageDropdown } from './components/LanguageDropdown';
import { SUPPORTED_LANGUAGES, Language } from './data/languages';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [showAISummary, setShowAISummary] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<Language>({ code: 'auto', name: 'Auto-detect', flag: '🌐' });
  const [targetLanguage, setTargetLanguage] = useState<Language>({ code: 'ar', name: 'Arabic', flag: '🇸🇦' });
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const [translationBlocks, setTranslationBlocks] = useState([
    {
      id: 1,
      original: "Hello, how are you today? I hope you're having a wonderful day and everything is going well for you.",
      translation: "مرحبا، كيف حالك اليوم؟ أتمنى أن تقضي يوماً رائعاً وأن كل شيء يسير على ما يرام معك.",
      isComplete: true
    },
    {
      id: 2,
      original: "I'm looking for the nearest restaurant that serves traditional food. Can you help me find one?",
      translation: "أبحث عن أقرب مطعم يقدم الطعام التقليدي. هل يمكنك مساعدتي في العثور على واحد؟",
      isComplete: true
    },
    {
      id: 3,
      original: "Could you help me with directions to the city center? I'm a bit lost and need some guidance.",
      translation: "هل يمكنك مساعدتي في الاتجاهات إلى وسط المدينة؟ أنا تائه قليلاً وأحتاج إلى بعض التوجيه.",
      isComplete: false
    }
  ]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setSourceDropdownOpen(false);
      setTargetDropdownOpen(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Simulate recording session ending to show AI Summary button
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAISummary(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleStartRecording = () => {
    setIsRecording(true);
    // Simulate new translations coming in
    const newBlock = {
      id: Date.now(),
      original: "What time does the store close? I need to buy some groceries before it's too late.",
      translation: "في أي وقت يغلق المتجر؟ أحتاج إلى شراء بعض البقالة قبل فوات الأوان.",
      isComplete: false
    };
    setTimeout(() => {
      setTranslationBlocks(prev => [...prev, newBlock]);
    }, 1000);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 text-center">Live Translation</h1>
        
        {/* Language Selection */}
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div onClick={(e) => e.stopPropagation()}>
              <LanguageDropdown
                label="Source Language"
                selectedLanguage={sourceLanguage}
                languages={SUPPORTED_LANGUAGES}
                onLanguageSelect={setSourceLanguage}
                showAutoDetect={true}
                isOpen={sourceDropdownOpen}
                onToggle={() => setSourceDropdownOpen(!sourceDropdownOpen)}
              />
            </div>
            
            <div onClick={(e) => e.stopPropagation()}>
              <LanguageDropdown
                label="Target Language"
                selectedLanguage={targetLanguage}
                languages={SUPPORTED_LANGUAGES}
                onLanguageSelect={setTargetLanguage}
                isOpen={targetDropdownOpen}
                onToggle={() => setTargetDropdownOpen(!targetDropdownOpen)}
              />
            </div>
          </div>
          
          {/* Language Direction Indicator */}
          <div className="flex items-center justify-center mt-3 text-sm text-gray-600">
            <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-full">
              <span className="text-base">{sourceLanguage.flag}</span>
              <span className="font-medium">{sourceLanguage.name}</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="text-base">{targetLanguage.flag}</span>
              <span className="font-medium">{targetLanguage.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Column - Original Text */}
        <div className="w-1/2 bg-gray-100 border-r border-gray-300 flex flex-col">
          {/* Column Header */}
          <div className="bg-gray-200 px-4 py-3 border-b border-gray-300 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-gray-600" />
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Original</h2>
              <span className="text-xs text-gray-600">({sourceLanguage.name})</span>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {translationBlocks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <div>
                  <Mic className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-base">Start recording to see original text</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {translationBlocks.map((block) => (
                  <div
                    key={`original-${block.id}`}
                    className={`bg-white rounded-lg p-4 shadow-sm border-2 border-gray-200 relative group transition-all select-text ${
                      !block.isComplete ? 'animate-pulse border-blue-400 shadow-md' : 'hover:shadow-md'
                    }`}
                  >
                    <p className="text-gray-900 text-base leading-relaxed font-medium">
                      {block.original}
                    </p>
                    <button
                      onClick={() => copyToClipboard(block.original)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-md"
                      title="Copy text"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Translation */}
        <div className="w-1/2 bg-white flex flex-col">
          {/* Column Header */}
          <div className="bg-blue-50 px-4 py-3 border-b border-blue-200 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Languages className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide">Translation</h2>
              <span className="text-xs text-blue-600">({targetLanguage.name})</span>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {translationBlocks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <div>
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-base">Translations will appear here</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {translationBlocks.map((block) => (
                  <div
                    key={`translation-${block.id}`}
                    className={`bg-blue-50 rounded-lg p-4 shadow-sm border-2 border-blue-200 relative group transition-all select-text ${
                      !block.isComplete ? 'animate-pulse border-blue-500 shadow-md' : 'hover:shadow-md'
                    }`}
                  >
                    <p className="text-gray-900 text-base leading-relaxed font-medium" dir={targetLanguage.code === 'ar' ? 'rtl' : 'ltr'}>
                      {block.translation}
                    </p>
                    <button
                      onClick={() => copyToClipboard(block.translation)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-blue-100 rounded-md"
                      title="Copy translation"
                    >
                      <Copy className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-10">
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <Mic className={`w-7 h-7 text-white ${isRecording ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {/* AI Summary Button - Appears after recording */}
      {showAISummary && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
          <button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-lg font-semibold flex items-center justify-center space-x-3 shadow-md hover:shadow-lg transition-all text-lg">
            <span className="text-xl">🤖</span>
            <span>AI Summary</span>
          </button>
        </div>
      )}

      {/* Status Indicator */}
      {isRecording && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-20">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Recording...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;