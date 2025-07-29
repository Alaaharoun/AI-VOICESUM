import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Download, Copy, Volume2, ArrowLeft, Save, Clipboard, Plus } from 'lucide-react';
import { SummarizationService } from '../services/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export const Summary: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Get data from URL parameters
  const transcription = searchParams.get('transcription') || '';
  const translation = searchParams.get('translation') || '';
  const targetLanguage = searchParams.get('targetLanguage') || 'en';
  const sourceLanguage = searchParams.get('sourceLanguage') || 'auto';
  
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Auto-generate summary if text is available
  useEffect(() => {
    const textToSummarize = translation || transcription;
    if (textToSummarize && textToSummarize.trim().length >= 50 && !summary) {
      setTimeout(() => {
        handleGenerateSummary();
      }, 500);
    }
  }, [transcription, translation]);

  const handleGenerateSummary = async () => {
    const textToSummarize = customText || translation || transcription;
    
    if (!textToSummarize || textToSummarize.trim().length < 50) {
      alert('Text is too short to summarize. Please provide at least 50 characters.');
      return;
    }
    
    if (isSummarizing) return;
    
    setIsSummarizing(true);
    
    try {
      // Enhanced prompt for better AI summarization
      const enhancedPrompt = `Please provide a comprehensive and intelligent summary of the following text. The summary should:

1. Capture the main ideas and key points
2. Maintain the original meaning and context
3. Be well-structured and easy to understand
4. Include important details while being concise
5. Use clear and professional language
6. Highlight any important conclusions or insights

Text to summarize: ${textToSummarize}

Please provide a detailed summary that covers all important aspects of the content.`;

      const result = await SummarizationService.summarizeTextWithPrompt(enhancedPrompt);
      
      if (result && result.trim().length > 0) {
        setSummary(result);
        
        // Save to history
        await saveSummaryToHistory(result);
      } else {
        throw new Error('Generated summary is empty');
      }
    } catch (error) {
      console.error('Summary generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary.';
      alert('Summary Error: ' + errorMessage);
      setSummary('❌ Failed to generate summary. Please try again or check your internet connection.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const saveSummaryToHistory = async (summaryText: string) => {
    if (!user || !summaryText || summaryText.trim().length === 0) {
      return;
    }
    
    try {
      // Check if we already have this exact content saved
      const { data: existingRecords, error: checkError } = await supabase
        .from('recordings')
        .select('id')
        .eq('user_id', user.id)
        .eq('transcription', transcription || '')
        .eq('translation', translation || '')
        .eq('summary', summaryText)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking existing records:', checkError);
      }
      
      // Only save if we don't already have this exact content
      if (!existingRecords || existingRecords.length === 0) {
        const { error } = await supabase.from('recordings').insert({
          user_id: user.id,
          transcription: transcription || '',
          translation: translation || '',
          summary: summaryText,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          duration: 0, // Summary generation doesn't have duration
          created_at: new Date().toISOString(),
        });
        
        if (error) {
          console.error('Error saving summary:', error);
          throw error;
        }
        
        console.log('Summary saved to history successfully');
      } else {
        console.log('Content already exists in history, skipping save');
      }
      
      setIsSaved(true);
    } catch (error) {
      setIsSaved(false);
      console.warn('Failed to save summary to history:', error);
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${type} copied to clipboard!`);
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  };

  const handlePaste = async (type: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        if (type === 'transcription') {
          // Update URL with new transcription
          const newParams = new URLSearchParams(searchParams);
          newParams.set('transcription', text);
          navigate(`/summary?${newParams.toString()}`);
        } else if (type === 'translation') {
          // Update URL with new translation
          const newParams = new URLSearchParams(searchParams);
          newParams.set('translation', text);
          navigate(`/summary?${newParams.toString()}`);
        }
        alert(`${type} pasted from clipboard!`);
      } else {
        alert('Clipboard is empty or contains no text');
      }
    } catch (error) {
      alert('Failed to paste from clipboard');
    }
  };

  const handleSpeak = async (text: string, type: string) => {
    if (speakingText === text && isSpeaking) {
      // Stop speaking
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      setSpeakingText(null);
      return;
    }

    if (isSpeaking) {
      // Stop current speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      setSpeakingText(null);
    }

    if (!text || text.trim() === '') {
      alert('No text to speak');
      return;
    }

    try {
      setIsSpeaking(true);
      setSpeakingText(text);

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set language based on type
        if (type === 'transcription') {
          utterance.lang = sourceLanguage === 'ar' ? 'ar-SA' : 'en-US';
        } else if (type === 'translation') {
          utterance.lang = targetLanguage === 'ar' ? 'ar-SA' : 'en-US';
        } else {
          utterance.lang = 'en-US';
        }
        
        utterance.rate = 0.9;
        utterance.volume = 0.8;
        
        utterance.onend = () => {
          setIsSpeaking(false);
          setSpeakingText(null);
        };
        
        utterance.onerror = () => {
          setIsSpeaking(false);
          setSpeakingText(null);
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        alert('Speech synthesis not supported in this browser');
        setIsSpeaking(false);
        setSpeakingText(null);
      }
    } catch (error) {
      alert('Failed to speak text');
      setIsSpeaking(false);
      setSpeakingText(null);
    }
  };

  const downloadSummary = (format: 'txt' | 'rtf' | 'doc') => {
    const textToDownload = summary;
    if (!textToDownload || textToDownload.trim() === '') {
      alert('No summary available for download or the summary is empty.');
      return;
    }
    
    const content = `Summary: ${textToDownload}\n\nOriginal Transcription: ${transcription || 'N/A'}\n\nTranslation: ${translation || 'N/A'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const goBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">🤖 AI Summary</h1>
          <p className="text-lg text-gray-600">
            Intelligent summary of your transcription and translation
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Content Section */}
          <div className="space-y-6">
            {/* Original Transcription */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Original Transcription:</h3>
                <div className="flex items-center space-x-2">
                  {transcription && (
                    <>
                      <button
                        onClick={() => handleCopy(transcription, 'Transcription')}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Copy transcription"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSpeak(transcription, 'transcription')}
                        className={`p-2 rounded-lg transition-colors ${
                          speakingText === transcription && isSpeaking
                            ? 'text-red-600 bg-red-50'
                            : 'text-blue-600 hover:bg-blue-50'
                        }`}
                        title="Speak transcription"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handlePaste('transcription')}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                {transcription ? (
                  <p className="text-gray-800">{transcription}</p>
                ) : (
                  <p className="text-gray-500 italic">No transcription available</p>
                )}
              </div>
            </div>

            {/* Translation */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Translation {targetLanguage ? `(${targetLanguage})` : ''}:
                </h3>
                <div className="flex items-center space-x-2">
                  {translation && (
                    <>
                      <button
                        onClick={() => handleCopy(translation, 'Translation')}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Copy translation"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSpeak(translation, 'translation')}
                        className={`p-2 rounded-lg transition-colors ${
                          speakingText === translation && isSpeaking
                            ? 'text-red-600 bg-red-50'
                            : 'text-purple-600 hover:bg-purple-50'
                        }`}
                        title="Speak translation"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handlePaste('translation')}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                {translation ? (
                  <p className="text-gray-800">{translation}</p>
                ) : (
                  <p className="text-gray-500 italic">No translation available</p>
                )}
              </div>
            </div>

            {/* Custom Text Input */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Custom Text:</h3>
                <button
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Add custom text"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {showCustomInput && (
                <div className="space-y-4">
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Enter custom text to summarize..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePaste('custom')}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Paste from clipboard"
                    >
                      <Clipboard className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-gray-500">Paste custom text</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Section */}
          <div className="space-y-6">
            {/* AI Summary */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">AI Summary:</h3>
                <div className="flex items-center space-x-2">
                  {summary && (
                    <>
                      <button
                        onClick={() => handleCopy(summary, 'Summary')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Copy summary"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSpeak(summary, 'summary')}
                        className={`p-2 rounded-lg transition-colors ${
                          speakingText === summary && isSpeaking
                            ? 'text-red-600 bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title="Speak summary"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          await saveSummaryToHistory(summary);
                          if (isSaved) {
                            alert('Summary saved to history!');
                          }
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          isSaved ? 'text-green-600 bg-green-50' : 'text-blue-600 hover:bg-blue-50'
                        }`}
                        title="Save summary to history"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                {isSummarizing ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">🤖 Generating AI summary...</span>
                  </div>
                ) : summary ? (
                  <p className="text-gray-800 leading-relaxed">{summary}</p>
                ) : (
                  <p className="text-gray-500 italic">
                    No summary available. Click "Generate Summary" to create one.
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              {/* Generate Summary Button */}
              <button
                onClick={handleGenerateSummary}
                disabled={isSummarizing || (!transcription && !translation && !customText)}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSummarizing ? '🤖 Generating...' : (summary ? '🔄 Regenerate Summary' : '🤖 Generate Summary')}
              </button>

              {/* Download Buttons */}
              {summary && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => downloadSummary('txt')}
                    className="btn-secondary text-sm"
                  >
                    Download .TXT
                  </button>
                  <button
                    onClick={() => downloadSummary('rtf')}
                    className="btn-secondary text-sm"
                  >
                    Download .RTF
                  </button>
                  <button
                    onClick={() => downloadSummary('doc')}
                    className="btn-secondary text-sm"
                  >
                    Download .DOC
                  </button>
                </div>
              )}

              {/* Back Button */}
              <button
                onClick={goBack}
                className="w-full btn-secondary"
              >
                <ArrowLeft className="h-4 w-4 inline mr-2" />
                Back
              </button>
            </div>
          </div>
        </div>

        {/* No Data Warning */}
        {!transcription && !translation && !customText && (
          <div className="mt-8 text-center">
            <p className="text-red-600 italic">
              No data available. Please go back and record some audio first, or add custom text.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 