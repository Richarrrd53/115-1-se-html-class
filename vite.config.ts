import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 若在 Vercel 或一般部署，base 為 '/'；若在 GitHub Actions 部署 GitHub Pages，base 為 '/SE-HTML-class/'
const isGitHubActions = Boolean(process.env.GITHUB_ACTIONS || process.env.GITHUB_PAGES)
const base = process.env.BASE_URL ?? (isGitHubActions ? '/SE-HTML-class/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        edit: fileURLToPath(new URL('./edit.html', import.meta.url)),
      },
    },
  },
})


