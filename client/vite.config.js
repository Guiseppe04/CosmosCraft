import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { securityHeadersPlugin } from './securityHeadersPlugin.js'

export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = (env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

  return {
    plugins: [securityHeadersPlugin(env, command === 'serve' && !isPreview), react()],
    server: {
      host: true,
      port: 3000,
      open: true,
      proxy: {
        '/auth/google': apiUrl,
        '/auth/facebook': apiUrl,
        '/auth/check': apiUrl,
        '/auth/terms': apiUrl,
        '/auth/refresh': apiUrl,
        '/auth/logout': apiUrl,
        '/auth/email-signup': apiUrl,
        '/auth/email-login': apiUrl,
        '/auth/verify-otp': apiUrl,
        '/auth/resend-otp': apiUrl,
        '/user': apiUrl,
        '/api': apiUrl,
        '/uploads': apiUrl,
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
    },
  }
})
