import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Set VITE_BASE=/YourRepoName/ when building for GitHub project Pages (see .github/workflows/deploy-frontend.yml).
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss()],
})
