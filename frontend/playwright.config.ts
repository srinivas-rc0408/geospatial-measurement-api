/**
 * End-to-end accuracy tests: the real UI against a real backend. Local only (not in CI): start the
 * backend on SQLite first (see README), then `npm run test:e2e`. The dev server starts automatically.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false, // one backend, one SQLite file: keep uploads sequential
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
