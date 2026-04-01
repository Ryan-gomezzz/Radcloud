import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Set VITE_BASE=/YourRepoName/ when building for GitHub project Pages.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/analyze': { target: 'http://localhost:8000', changeOrigin: true },
      '/analyze-stream': { target: 'http://localhost:8000', changeOrigin: true },
      '/sample-data': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
      '/chat': { target: 'http://localhost:8000', changeOrigin: true },
      '/auth': { target: 'http://localhost:8000', changeOrigin: true },
      '/cloud': { target: 'http://localhost:8000', changeOrigin: true },
      '/sessions': { target: 'http://localhost:8000', changeOrigin: true },
      '/execution': { target: 'http://localhost:8000', changeOrigin: true },
      '/pipeline': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
