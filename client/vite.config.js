import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_URL = process.env.VITE_API_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/auth/google': API_URL,
      '/auth/facebook': API_URL,
      '/auth/check': API_URL,
      '/auth/refresh': API_URL,
      '/auth/logout': API_URL,
      '/auth/email-signup': API_URL,
      '/auth/email-login': API_URL,
      '/auth/verify-otp': API_URL,
      '/auth/resend-otp': API_URL,
      '/user': API_URL,
      '/api': API_URL
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
})
