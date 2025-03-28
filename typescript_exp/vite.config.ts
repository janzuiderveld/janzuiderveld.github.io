import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',  // Important: Deploy to root
  server: {
    open: '/',
    historyApiFallback: true,
  },
  // Use this setting instead of historyApiFallback
  preview: {
    port: 8000
  }
})