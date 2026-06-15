import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://mrcompress.pages.dev',
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
    server: {
      headers: {
        // Removed to fix asset loading issues
      },
    },
  },

  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});