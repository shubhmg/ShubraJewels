import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:4200',
      // Uploaded media lives on the PROD server's disk (not synced locally), so
      // pull it from production during local dev. Proxied → same-origin to the
      // browser, so the try-on bg-removal canvas stays untainted.
      '/uploads': { target: 'https://shubrajewels.shop', changeOrigin: true, secure: true },
    },
  },
})
