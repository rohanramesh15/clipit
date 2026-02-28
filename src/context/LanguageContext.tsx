import React, { createContext, useContext, useState } from 'react';

export type Language = 'ko' | 'uk';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  languageName: string;
  langParam: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGUAGE_NAMES: Record<Language, string> = {
  ko: 'Korean',
  uk: 'Ukrainian',
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('deadbird_language');
    return (stored === 'uk' ? 'uk' : 'ko') as Language;
  });

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    localStorage.setItem('deadbird_language', lang);
  }

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      languageName: LANGUAGE_NAMES[language],
      langParam: `lang=${language}`,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
