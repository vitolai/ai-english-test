import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    fs: {
      strict: false,
      allow: ['C:/Users/vitol/.gemini/antigravity/scratch/toeic-v0.3.0', 'D:/AntigravityData/scratch/toeic-v0.3.0']
    }
  }
})
