import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const rawBase = command === 'build' ? (process.env.VITE_BASE_PATH || '/').trim() : '/';
  const isRelativeBase = rawBase === '.' || rawBase === './';
  const basePath = isRelativeBase
    ? './'
    : rawBase === '/'
      ? '/'
      : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;
  const manifestPrefix = isRelativeBase ? '' : basePath;

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: isRelativeBase ? './' : basePath,
          name: 'سامانه کارگاهی تولید ورمیکمپوست درجه ۱',
          short_name: 'ورمیکمپوست',
          description: 'فرمولاسیون علمی، ماشین‌حساب بچ، برآورد بهای تمام‌شده و مدیریت کارگاه',
          theme_color: '#064e3b',
          background_color: '#064e3b',
          display: 'standalone',
          orientation: 'portrait',
          start_url: isRelativeBase ? './' : basePath,
          scope: isRelativeBase ? './' : basePath,
          lang: 'fa',
          dir: 'rtl',
          icons: [
            {
              src: `${manifestPrefix}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${manifestPrefix}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${manifestPrefix}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff,woff2,json}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: isRelativeBase ? 'index.html' : `${basePath}index.html`,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url, request }) =>
                request.method !== 'GET' ||
                url.pathname.startsWith('/api/telegram/db/events') ||
                url.pathname.startsWith('/api/telegram/configure') ||
                url.pathname.startsWith('/api/telegram/claim-polling') ||
                url.pathname.startsWith('/api/telegram/stop') ||
                url.pathname.startsWith('/api/telegram/test-admin-message') ||
                url.pathname.startsWith('/api/github/') ||
                url.pathname.startsWith('/api/ai/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'safari-visited-pages-v1',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                (url.pathname === '/api/telegram/db/bootstrap' ||
                  url.pathname === '/api/telegram/db/version' ||
                  url.pathname === '/api/telegram/db/voice-index' ||
                  url.pathname === '/api/app-version' ||
                  url.pathname.endsWith('/live-db.json')),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'safari-catalog-api-v1',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                (url.pathname.startsWith('/api/telegram/db/media/') ||
                  url.pathname.startsWith('/api/telegram/db/voice-clip/')),
              handler: 'CacheFirst',
              options: {
                cacheName: 'safari-media-voice-v1',
                expiration: {
                  maxEntries: 350,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                request.method === 'GET' && url.pathname.startsWith('/api/weather'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'safari-weather-api-v1',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'safari-product-images-v1',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'safari-fonts-cache-v1',
                expiration: {
                  maxEntries: 25,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
