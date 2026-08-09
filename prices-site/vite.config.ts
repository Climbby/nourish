import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const nourishApi = env.NOURISH_API_HOST || 'http://192.168.1.27:8787'
  return {
    plugins: [react()],
    base: './',
    server: {
      port: 5174,
      proxy: {
        '/nourish': {
          target: nourishApi,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/nourish/, ''),
        },
      },
    },
  }
})
