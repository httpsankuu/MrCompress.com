import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ChevronDown } from 'lucide-react';
import '../i18n';

const LANGUAGES = [
  { label: 'English', value: 'en', flag: '🇺🇸' },
  { label: 'Español', value: 'es', flag: '🇪🇸' },
  { label: '中文', value: 'zh', flag: '🇨🇳' },
  { label: 'हिन्दी', value: 'hi', flag: '🇮🇳' },
  { label: 'العربية', value: 'ar', flag: '🇸🇦' },
  { label: 'Français', value: 'fr', flag: '🇫🇷' },
  { label: 'Português', value: 'pt', flag: '🇧🇷' },
  { label: 'Русский', value: 'ru', flag: '🇷🇺' },
  { label: '日本語', value: 'ja', flag: '🇯🇵' },
  { label: 'Deutsch', value: 'de', flag: '🇩🇪' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Normalize language code (e.g., 'en-US' -> 'en')
  const currentLangCode = i18n.language ? i18n.language.split('-')[0] : 'en';
  const currentLang = LANGUAGES.find(l => l.value === currentLangCode) || LANGUAGES[0];

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setIsOpen(false);
    
    // Set HTML dir attribute for Arabic (RTL)
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = lang;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-8 px-3 rounded-geist border border-hairline bg-canvas text-mute hover:text-ink hover:bg-canvas-soft-2 transition-all text-[11px] font-medium shadow-v-1 focus:outline-none focus:ring-1 focus:ring-hairline"
        aria-label="Select Language"
      >
        <Languages className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{currentLang.label}</span>
        <span className="sm:hidden">{currentLang.value.toUpperCase()}</span>
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[90]" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-40 max-h-[60vh] overflow-y-auto rounded-geist border border-hairline bg-canvas shadow-v-3 z-[100] p-1 animate-in fade-in zoom-in-95 duration-100 scrollbar-thin">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => changeLanguage(lang.value)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-sm text-[11px] transition-colors ${
                  currentLangCode === lang.value 
                    ? 'bg-canvas-soft-2 text-ink font-bold' 
                    : 'text-mute hover:text-ink hover:bg-canvas-soft'
                }`}
              >
                <span>{lang.label}</span>
                <span className="text-sm">{lang.flag}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
