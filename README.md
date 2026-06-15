# MrCompress 🚀

**MrCompress** is a fast, secure, and free online image optimizer and converter designed for the modern web. Built with a focus on performance and privacy, it handles all image processing locally in your browser, ensuring your data never leaves your device.

🔗 **[Live Website](https://mrcompress.pages.dev/)**

![MrCompress Banner](src/assets/background.svg)

## ✨ Key Features

- **🔒 Privacy First:** All compression and conversion happens client-side. Your images are never uploaded to a server.
- **⚡ Blazing Fast:** Leveraging modern browser capabilities for near-instant processing.
- **🖼️ Comprehensive Support:** Works with PNG, JPG, WebP, AVIF, and even Apple's HEIC format.
- **📄 PDF Integration:** Convert your images directly to high-quality PDF documents.
- **🛠️ Precision Tools:**
  - **Smart Compression:** Fine-tune quality to achieve target file sizes (e.g., 20kb, 50kb, 100kb).
  - **Pro Cropping:** Use aspect ratio presets (1:1, 16:9, 9:16 for TikTok/Reels, etc.) or free-form cropping.
  - **Resize & Rotate:** Easily adjust dimensions while maintaining aspect ratio.
- **🌍 Multi-language:** Fully localized in 10 languages including English, Arabic, German, Spanish, French, Hindi, Japanese, Portuguese, Russian, and Chinese.
- **📱 Mobile Optimized:** A seamless experience across desktop, iPhone, and Android devices.

## 🎓 What I Learned

Building **MrCompress** was a deep dive into modern web engineering. Key takeaways include:

- **🛠️ Tool Website Architecture:** Learned how to build a high-performance, single-purpose tool that delivers instant value without server overhead.
- **📈 Effective SEO & FAQ Strategy:** Mastered how to structure content and FAQ sections to rank for high-intent keywords and drive organic traffic.
- **🔒 Client-Side Processing:** Implemented robust browser-based image manipulation using Canvas and WebWorkers, ensuring 100% user privacy.
- **🌐 Global i18n:** Successfully managed complex internationalization for 10 languages, including RTL (Right-to-Left) support for Arabic.
- **🎨 Modern Styling:** Leveraged Tailwind CSS v4 and Astro for a sleek, performant, and developer-centric UI/UX.

## 🛠️ Tech Stack

- **Framework:** [Astro](https://astro.build/) (v6.4)
- **UI Library:** [React](https://react.dev/) (v19)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (v4)
- **Icons:** [Lucide React](https://lucide.dev/)
- **i18n:** [i18next](https://www.i18next.com/)
- **Deployment:** Optimized for [Cloudflare Pages](https://pages.cloudflare.com/) via [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22.12.0
- npm

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/mrcompress.git
   cd mrcompress
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Start the development server:
   ```sh
   npm run dev
   ```

4. Build for production:
   ```sh
   npm run build
   ```

## 🧞 Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Installs dependencies |
| `npm run dev` | Starts local dev server at `localhost:4321` |
| `npm run build` | Build your production site to `./dist/` |
| `npm run preview` | Preview your build locally |
| `npm run generate-types` | Generate types for Cloudflare bindings |

## 🎨 Design Philosophy

MrCompress follows a minimalist, high-signal design language inspired by Vercel. It prioritizes clarity, typography, and subtle interactive feedback to provide a premium "developer-tool" feel.

---

Developed with ❤️ for a faster, more private web.
