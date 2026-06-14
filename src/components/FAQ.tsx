import React from 'react';
import { useTranslation } from 'react-i18next';

export default function FAQ() {
  const { t } = useTranslation();

  return (
    <section id="faq" className="py-24 border-t border-hairline bg-canvas">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-ink mb-12 text-center">{t('faq.title', 'Frequently Asked Questions')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">{t('faq.q1', 'How to compress an image?')}</h3>
            <p className="text-sm text-body leading-relaxed">{t('faq.a1', 'To compress an image, simply drag and drop your file into our optimizer. Adjust the quality slider to find the perfect balance between file size and clarity, then click the download button. Everything happens locally in your browser for maximum privacy.')}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">{t('faq.q2', 'How to compress image size?')}</h3>
            <p className="text-sm text-body leading-relaxed">{t('faq.a2', "You can compress image size by reducing the quality percentage or by resizing the image's pixel dimensions. Our tool shows you a live preview of the final file size so you can achieve the exact optimization you need.")}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">{t('faq.q3', 'How to compress image on iPhone?')}</h3>
            <p className="text-sm text-body leading-relaxed">{t('faq.a3', 'To compress an image on an iPhone, open our website in Safari, upload a photo from your library, adjust the settings as needed, and save the optimized image directly back to your Photos app. No extra apps required.')}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">{t('faq.q4', 'How to compress image without losing quality?')}</h3>
            <p className="text-sm text-body leading-relaxed">{t('faq.a4', "To compress an image without losing quality, use our advanced algorithms that remove unnecessary metadata and redundant pixel data. While 'lossless' compression is available, even our 'lossy' settings are designed to be visually indistinguishable from the original.")}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">{t('faq.q5', 'How to compress image file size?')}</h3>
            <p className="text-sm text-body leading-relaxed">{t('faq.a5', 'Reducing image file size is easy: select your file, choose a modern format like WebP or AVIF for better compression ratios, and lower the quality slider until you reach your target size.')}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">{t('faq.q6', 'How to compress an image on Mac?')}</h3>
            <p className="text-sm text-body leading-relaxed">{t('faq.a6', "On a Mac, you can compress an image by using our online tool in any browser. It's a faster alternative to using built-in tools like Preview, especially when you need to convert formats or target specific file sizes.")}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">{t('faq.q7', 'Compress image to 20kb?')}</h3>
            <p className="text-sm text-body leading-relaxed">{t('faq.a7', "To compress an image to 20kb, you may need to reduce the dimensions (width and height) and lower the quality setting. Our real-time size counter helps you see exactly when you've reached the 20kb threshold.")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}