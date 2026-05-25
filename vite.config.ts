import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Nourish',
          short_name: 'Nourish',
          description: 'O teu rastreador de refeições pessoal',
          theme_color: '#111416',
          background_color: '#111416',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'pt',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/files\/recipepictures\/.+/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'recipe-images',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://192.168.1.61:9192',
          changeOrigin: true,
          headers: {
            'GROCY-API-KEY': env.GROCY_API_KEY,
          },
        },
      },
    },
  }
})
