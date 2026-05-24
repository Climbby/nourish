import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
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
