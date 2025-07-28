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
  const [originalText, setOriginalText] = useState('');
  const [translationText, setTranslationText] = useState('');

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
    // Simulate live transcription
    const originalTexts = [
      "Hello, how are you today?",
      " I hope you're having a wonderful day and everything is going well for you.",
      " I'm looking for the nearest restaurant that serves traditional food.",
      " Can you help me find one?",
      " Could you help me with directions to the city center?",
      " I'm a bit lost and need some guidance.",
      " What time does the store close?",
      " I need to buy some groceries before it's too late."
    ];
    
    const translatedTexts = [
      "مرحبا، كيف حالك اليوم؟",
      " أتمنى أن تقضي يوماً رائعاً وأن تسير الأمور بشكل جيد معك.",
      " أبحث عن أقرب مطعم يقدم الطعام التقليدي.",
      " هل يمكنك مساعدتي في العثور على واحد؟",
      " هل يمكنك مساعدتي في الاتجاهات إلى وسط المدينة؟",
      " أنا تائه قليلاً وأحتاج إلى بعض التوجيه.",
      " في أي وقت يغلق المتجر؟",
      " أحتاج إلى شراء بعض البقالة قبل فوات الأوان."
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < originalTexts.length) {
        setOriginalText(prev => prev + originalTexts[index]);
        setTranslationText(prev => prev + translatedTexts[index]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gray-50 landscape-layout">
      {/* Top Header Bar - Horizontal Layout */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Title */}
          <h1 className="text-xl font-bold text-gray-900">Live Translation</h1>
          
          {/* Language Selection - Horizontal */}
          <div className="flex items-center space-x-6">
            <div onClick={(e) => e.stopPropagation()} className="min-w-48">
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
            
            <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
            
            <div onClick={(e) => e.stopPropagation()} className="min-w-48">
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

          {/* Recording Controls */}
          <div className="flex items-center space-x-4">
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Mic className={`w-6 h-6 text-white ${isRecording ? 'animate-pulse' : ''}`} />
            </button>
            
            {isRecording && (
              <div className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>Recording...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Two Large Windows Side by Side */}
      <div className="flex-1 flex min-h-0 h-full">
        {/* Left Window - Original Text */}
        <div className="w-1/2 bg-gray-100 border-r-2 border-gray-300 flex flex-col h-full">
          {/* Column Header */}
          <div className="bg-gray-200 px-6 py-3 border-b-2 border-gray-300 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Original</h2>
              <span className="text-sm text-gray-600 flex items-center space-x-1">
                <span className="text-lg">{sourceLanguage.flag}</span>
                <span>({sourceLanguage.name})</span>
              </span>
            </div>
          </div>
          
          {/* Large Text Window */}
          <div className="flex-1 p-4 h-full">
            {originalText ? (
              <div className="h-full bg-white rounded-xl p-6 shadow-lg border-2 border-gray-200 relative group">
                <div className="h-full overflow-y-auto">
                  <p className="text-2xl leading-relaxed text-gray-900 font-medium whitespace-pre-wrap select-text">
                    {originalText}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(originalText)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-3 hover:bg-gray-100 rounded-lg"
                  title="Copy original text"
                >
                  <Copy className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-white rounded-xl shadow-lg border-2 border-gray-200">
                <div className="text-center text-gray-500">
                  <Volume2 className="w-20 h-20 mx-auto mb-4 text-gray-400" />
                  <p className="text-2xl font-medium">Start recording to see original text</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Window - Translation */}
        <div className="w-1/2 bg-white flex flex-col h-full">
          {/* Column Header */}
          <div className="bg-blue-50 px-6 py-3 border-b-2 border-blue-200 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <Languages className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-blue-800 uppercase tracking-wide">Translation</h2>
              <span className="text-sm text-blue-600 flex items-center space-x-1">
                <span className="text-lg">{targetLanguage.flag}</span>
                <span>({targetLanguage.name})</span>
              </span>
            </div>
          </div>
          
          {/* Large Text Window */}
          <div className="flex-1 p-4 h-full">
            {translationText ? (
              <div className="h-full bg-blue-50 rounded-xl p-6 shadow-lg border-2 border-blue-200 relative group">
                <div className="h-full overflow-y-auto">
                  <p className="text-2xl leading-relaxed text-gray-900 font-medium whitespace-pre-wrap select-text" 
                     dir={targetLanguage.code === 'ar' ? 'rtl' : 'ltr'}>
                    {translationText}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(translationText)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-3 hover:bg-blue-100 rounded-lg"
                  title="Copy translation"
                >
                  <Copy className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-blue-50 rounded-xl shadow-lg border-2 border-blue-200">
                <div className="text-center text-gray-500">
                  <MessageSquare className="w-20 h-20 mx-auto mb-4 text-gray-400" />
                  <p className="text-2xl font-medium">Translations will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Summary Button - Fixed at Bottom */}
      {showAISummary && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-2xl z-20">
          <div className="max-w-7xl mx-auto">
            <button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-8 rounded-xl font-bold flex items-center justify-center space-x-4 shadow-lg hover:shadow-xl transition-all text-xl">
              <span className="text-2xl">🤖</span>
              <span>AI Summary</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;