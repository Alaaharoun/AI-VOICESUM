import React, { useState, useRef } from 'react';
import { Upload as UploadIcon, FileAudio, Download, Globe, X, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TranscriptionService, TranslationService, SummarizationService, FileUploadService } from '../services/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export const Upload: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [engine, setEngine] = useState<'faster-whisper' | 'azure' | 'assemblyai'>('faster-whisper');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if file is audio
      if (file.type.startsWith('audio/')) {
        setSelectedFile(file);
        setTranscription('');
        setTranslation('');
      } else {
        alert('Please select an audio file (MP3, WAV, M4A, etc.)');
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      setSelectedFile(file);
      setTranscription('');
      setTranslation('');
    } else {
      alert('Please select an audio file (MP3, WAV, M4A, etc.)');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const processFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    
    try {
      let transcribedText = '';

      // Step 1: Transcribe audio based on selected engine
      if (engine === 'assemblyai') {
        console.log('Using AssemblyAI for transcription');
        const transcriptId = await FileUploadService.uploadToAssemblyAI(selectedFile);
        
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max
        
        while (attempts < maxAttempts) {
          const status = await FileUploadService.getTranscriptionStatus(transcriptId);
          
          if (status.status === 'completed') {
            transcribedText = status.text || '';
            break;
          } else if (status.status === 'error') {
            throw new Error('AssemblyAI transcription failed');
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          throw new Error('Transcription timeout');
        }
      } else {
        console.log('Using', engine, 'for transcription');
        transcribedText = await TranscriptionService.transcribeAudio(selectedFile, engine as 'faster-whisper' | 'azure');
      }

      console.log('Transcription result:', transcribedText);
      setTranscription(transcribedText);

      // Step 2: Translate text immediately
      if (transcribedText && targetLanguage !== 'en') {
        try {
          console.log('Starting translation to:', targetLanguage);
          const translatedText = await TranslationService.translateText(transcribedText, targetLanguage, 'libre');
          console.log('Translation result:', translatedText);
          setTranslation(translatedText);
        } catch (error) {
          console.error('Translation error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setTranslation('Translation failed: ' + errorMessage);
        }
      } else if (transcribedText && targetLanguage === 'en') {
        // If target language is English, just copy the transcription
        setTranslation(transcribedText);
      }

      // Step 3: Save to Supabase
      if (user && transcribedText) {
        try {
          const { error } = await supabase.from('recordings').insert({
            user_id: user.id,
            transcription: transcribedText,
            translation: translation || null,
            target_language: targetLanguage,
            duration: Math.round(selectedFile.size / 16000), // Rough estimate
          });

          if (error) {
            console.error('Error saving recording:', error);
          } else {
            console.log('Recording saved to database');
          }
        } catch (error) {
          console.error('Error saving to database:', error);
        }
      }

    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error processing file: ' + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setTranscription('');
    setTranslation('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTranscription = () => {
    if (!transcription) return;
    
    const content = `Transcription: ${transcription}\n\nTranslation: ${translation || 'N/A'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const goToSummary = () => {
    const params = new URLSearchParams({
      transcription: transcription,
      translation: translation,
      targetLanguage: targetLanguage,
      sourceLanguage: 'auto', // Upload doesn't have source language selection
    });
    navigate(`/summary?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Upload Audio File</h1>
          <p className="text-lg text-gray-600">
            Upload an audio file to get transcription and translation
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Upload File</h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={engine}
                    onChange={(e) => setEngine(e.target.value as 'faster-whisper' | 'azure' | 'assemblyai')}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="faster-whisper">Faster Whisper</option>
                    <option value="azure">Azure Speech</option>
                    <option value="assemblyai">AssemblyAI</option>
                  </select>
                </div>
              </div>
            </div>

            {!selectedFile ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <UploadIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop your audio file here
                </p>
                <p className="text-gray-600 mb-4">
                  or click to browse files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                >
                  Choose File
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  Supports MP3, WAV, M4A, and other audio formats
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileAudio className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={removeFile}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <button
                  onClick={processFile}
                  disabled={isProcessing}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Process File'}
                </button>
              </div>
            )}

            {isProcessing && (
              <div className="mt-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Processing audio file...</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Transcription */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Transcription</h3>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                {transcription ? (
                  <p className="text-gray-800">{transcription}</p>
                ) : (
                  <p className="text-gray-500 italic">Transcription will appear here...</p>
                )}
              </div>
            </div>

            {/* Translation - Enlarged */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Translation</h3>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[200px]">
                {translation ? (
                  <p className="text-gray-800 text-lg leading-relaxed">{translation}</p>
                ) : (
                  <p className="text-gray-500 italic">Translation will appear here...</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              {/* Download Button */}
              {(transcription || translation) && (
                <button
                  onClick={downloadTranscription}
                  className="w-full flex items-center justify-center space-x-2 btn-primary"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Results</span>
                </button>
              )}

              {/* Summary Button */}
              {(transcription || translation) && (
                <button
                  onClick={goToSummary}
                  className="w-full flex items-center justify-center space-x-2 btn-secondary"
                >
                  <Brain className="h-4 w-4" />
                  <span>🤖 AI Summary Page</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 