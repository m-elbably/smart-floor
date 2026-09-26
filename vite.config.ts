import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
  base: './',
  plugins: [vue(), ui({ router: false, ui: { colors: { primary: 'emerald', neutral: 'zinc' } } })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5188, strictPort: true },
  // Pre-bundle up front: a mid-session re-optimisation reloads with two Vue copies and breaks Nuxt UI.
  optimizeDeps: { include: ['sql.js', 'three', 'jspdf', '@neutralinojs/lib'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 }
})
