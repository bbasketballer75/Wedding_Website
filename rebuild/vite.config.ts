import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Greenfield build. The legacy app is untouched and keeps its own Vite config;
 * this one is intentionally minimal until the rebuild has real features.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
