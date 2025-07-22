import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SummaryContextType {
  summary: string;
  setSummary: (s: string) => void;
  transcription: string;
  setTranscription: (t: string) => void;
  translation: string;
  setTranslation: (t: string) => void;
  targetLanguage: string;
  setTargetLanguage: (l: string) => void;
}

const SummaryContext = createContext<SummaryContextType | undefined>(undefined);

export function SummaryProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState('');
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');

  return (
    <SummaryContext.Provider value={{ summary, setSummary, transcription, setTranscription, translation, setTranslation, targetLanguage, setTargetLanguage }}>
      {children}
    </SummaryContext.Provider>
  );
}

export function useSummary() {
  const ctx = useContext(SummaryContext);
  if (!ctx) throw new Error('useSummary must be used within a SummaryProvider');
  return ctx;
} 