import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const buildId = Date.now().toString(36);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'site-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'site-version.json', source: JSON.stringify({ id: buildId }) });
    }
  }],
  define: { __SITE_BUILD_ID__: JSON.stringify(buildId) },
  base: '/',  // Important: Set base path for GitHub Pages
  build: {
    // Native modules/dynamic import baseline, including older Android phones.
    target: ['chrome64', 'edge79', 'firefox67', 'safari12'],
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
