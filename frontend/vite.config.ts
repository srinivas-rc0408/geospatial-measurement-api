import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// In development the API runs separately; proxying its paths keeps the page and the API on one origin,
// exactly as in production (where the backend serves this app), so no CORS is needed anywhere.
const API_DEV_SERVER = 'http://localhost:8000'
const apiPaths = ['/api', '/health', '/docs', '/redoc', '/openapi.json']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: Object.fromEntries(apiPaths.map((path) => [path, API_DEV_SERVER])) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'], // e2e/ specs run with Playwright, not Vitest
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: { VITE_API_BASE_URL: 'http://api.test' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/lib/api/schema.d.ts', 'src/main.tsx'],
    },
  },
})
