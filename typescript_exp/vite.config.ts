import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',  // Important: Set base path for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    open: '/',
    watch: {
      usePolling: true,
    },
    hmr: {
      protocol: 'ws', // Explicitly use WebSocket
      host: 'localhost',
      port: 5176 // Make sure this matches the port Vite is actually using
    },
    port: 3000
  },
  // Use this setting instead of historyApiFallback
  preview: {
    port: 8000
  }
})