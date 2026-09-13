'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { id } from './locales/id';
import { en } from './locales/en';
import type { Locale, TranslationDictionary } from './types';

export * from './types';
export { id } from './locales/id';
export { en } from './locales/en';

export const TRANSLATIONS: Record<Locale, TranslationDictionary> = {
  id,
  en,
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  t: TRANSLATIONS.en,
});

export function LanguageProvider({
  children,
  initialLocale = 'en',
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('morphic_locale') as Locale | null;
      if (saved === 'id' || saved === 'en') {
        if (saved !== initialLocale) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLocaleState(saved);
        }
        document.cookie = `morphic_locale=${saved}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // LocalStorage unavailable
    }
  }, [initialLocale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('morphic_locale', newLocale);
      document.cookie = `morphic_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // LocalStorage unavailable
    }
  };

  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
