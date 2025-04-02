import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',  // Important: Deploy to root
  server: {
    open: '/',
    watch: {
      usePolling: true,
    },
    hmr: {
      protocol: 'ws', // Explicitly use WebSocket
      host: 'localhost',
      port: 5176 // Make sure this matches the port Vite is actually using
    }
  },
  // Use this setting instead of historyApiFallback
  preview: {
    port: 8000
  }
})