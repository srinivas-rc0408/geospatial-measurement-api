/**
 * End-to-end accuracy tests: the real UI against a real backend. Local only (not in CI).
 * Default: start the backend on SQLite (see README), then `npm run test:e2e`; the dev server starts
 * automatically and proxies the API. E2E_BASE_URL=http://localhost:8000 tests a running image instead.
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false, // one backend, one SQLite file: keep uploads sequential
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --port 5173 --strictPort',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
        },
      }),
})
