import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';
import de from './locales/de.json';

const i18nInstance = i18n.use(initReactI18next);

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  i18nInstance.use(LanguageDetector);
}

i18nInstance.init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    zh: { translation: zh },
    hi: { translation: hi },
    ar: { translation: ar },
    fr: { translation: fr },
    pt: { translation: pt },
    ru: { translation: ru },
    ja: { translation: ja },
    de: { translation: de },
  },
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  detection: isBrowser ? {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
  } : undefined,
});

export default i18n;
