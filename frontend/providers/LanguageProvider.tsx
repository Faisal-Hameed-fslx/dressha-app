import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from '../lang/en';
import ur from '../lang/ur';

const LANGUAGE_STORAGE_KEY = 'dressha.selectedLanguage';

type Locale = 'en' | 'ur';

type LanguageContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof typeof en) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Locale, Record<string, string>> = {
  en: en as unknown as Record<string, string>,
  ur: ur as unknown as Record<string, string>,
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'en' || saved === 'ur') setLocaleState(saved);
      } catch (e) {
        console.warn('LanguageProvider failed to load locale', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, locale).catch((e) => console.warn('Failed to persist locale', e));
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);

  const t = (key: keyof typeof en) => {
    const val = translations[locale]?.[key as string];
    if (val) return val;
    // fallback to english or key itself
    return (translations.en as Record<string, string>)[key as string] || (key as string);
  };

  const value = useMemo(() => ({ locale, setLocale, t }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};

export default LanguageProvider;
