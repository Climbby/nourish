import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const openRouterKey = env.OPENROUTER_API_KEY?.trim() ?? ''
  if (!openRouterKey) {
    console.warn(
      '\n⚠️  OPENROUTER_API_KEY is missing in .env — IA requests to /ai will fail with 401.\n' +
        '   Copy from .env.example or your homelab grocy project, then restart npm run dev.\n'
    )
  }
  const grocyHost = env.GROCY_HOST || '192.168.1.61:9192'
  const grocyTarget = grocyHost.startsWith('http') ? grocyHost : `http://${grocyHost}`
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
        devOptions: { enabled: false },
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
          navigateFallbackDenylist: [/^\/api/, /^\/ai/, /^\/cdn-cgi\//],
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^\/ai\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^\/api\/files\/recipepictures\/.+/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'recipe-images',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^\/api\/files\/productpictures\/.+/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'product-images',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5180,
      strictPort: false,
      host: true,
      proxy: {
        '/ai': {
          target: 'https://openrouter.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai/, '/api'),
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'http://localhost:5180',
            'X-Title': 'Nourish',
          },
        },
        '/api': {
          target: grocyTarget,
          changeOrigin: true,
          headers: {
            'GROCY-API-KEY': env.GROCY_API_KEY,
          },
        },
        '/nourish': {
          target: 'http://192.168.1.27:8787',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/nourish/, ''),
        },
      },
    },
  }
})
