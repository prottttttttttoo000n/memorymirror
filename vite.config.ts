import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'MemoryMirror',
        short_name: 'MemoryMirror',
        description: 'AR-powered memory prosthetic for dementia patients',
        theme_color: '#1a1a2e',
        background_color: '#16213e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // In dev mode (with wrangler pages dev --proxy 5173), /api/* is handled
    // by the Pages Functions. When running Vite standalone, /api/* requests
    // will fail gracefully (the services handle 404/502 errors).
    // This proxy is for the reverse direction: when wrangler is the entry point.
  },
  preview: {
    host: true,
    port: 5173,
  },
})
