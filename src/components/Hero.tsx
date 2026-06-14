import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Zap, Sparkles } from 'lucide-react';
import '../i18n';

export default function Hero() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden pt-32 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-ink mb-8 max-w-4xl mx-auto leading-[1.1] animate-in fade-in slide-in-from-top-6 duration-1000">
          {t('home.hero_title')}
        </h1>
        
        <p className="text-lg md:text-xl text-mute max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-top-8 duration-1000 delay-200">
          {t('home.hero_desc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 animate-in fade-in slide-in-from-top-10 duration-1000 delay-300">
          <a href="/compress" className="w-full sm:w-auto px-8 py-4 bg-ink text-canvas rounded-geist-pill font-bold shadow-v-4 hover:opacity-90 active:scale-95 transition-all text-sm">
            {t('nav.compress')}
          </a>
          <a href="/social" className="w-full sm:w-auto px-8 py-4 bg-canvas text-ink border border-hairline rounded-geist-pill font-bold shadow-v-2 hover:bg-canvas-soft active:scale-95 transition-all text-sm">
            Social Resizer
          </a>
          <a href="#features" className="w-full sm:w-auto px-8 py-4 text-mute hover:text-ink font-bold transition-all text-sm">
            Learn More
          </a>
        </div>

        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 text-left">
          <div className="p-8 rounded-2xl border border-hairline bg-canvas/50 backdrop-blur-sm shadow-v-1 transition-all hover:shadow-v-2 hover:bg-canvas">
            <div className="h-10 w-10 rounded-xl bg-geist-link/10 flex items-center justify-center mb-6">
              <Shield className="h-5 w-5 text-geist-link" />
            </div>
            <h3 className="text-lg font-bold text-ink mb-3">{t('home.features.privacy')}</h3>
            <p className="text-sm text-mute leading-relaxed">
              {t('home.features.privacy_desc')}
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-hairline bg-canvas/50 backdrop-blur-sm shadow-v-1 transition-all hover:shadow-v-2 hover:bg-canvas">
            <div className="h-10 w-10 rounded-xl bg-geist-success/10 flex items-center justify-center mb-6">
              <Zap className="h-5 w-5 text-geist-success" />
            </div>
            <h3 className="text-lg font-bold text-ink mb-3">{t('home.features.feedback')}</h3>
            <p className="text-sm text-mute leading-relaxed">
              {t('home.features.feedback_desc')}
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-hairline bg-canvas/50 backdrop-blur-sm shadow-v-1 transition-all hover:shadow-v-2 hover:bg-canvas">
            <div className="h-10 w-10 rounded-xl bg-geist-warning/10 flex items-center justify-center mb-6">
              <Sparkles className="h-5 w-5 text-geist-warning" />
            </div>
            <h3 className="text-lg font-bold text-ink mb-3">{t('home.features.tools')}</h3>
            <p className="text-sm text-mute leading-relaxed">
              {t('home.features.tools_desc')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
