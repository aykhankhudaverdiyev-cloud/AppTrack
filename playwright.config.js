// Playwright E2E config (spec §5). Tests run against a production build
// (`npm run build && npm run preview`) using a dedicated test account from
// E2E_EMAIL / E2E_PASSWORD — never a real student account.
import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.E2E_PORT || 4173
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 1080 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Builds and serves the production bundle, then runs tests against it.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

// The existing browser suite logs into a real Supabase project and can delete
// records. Keep it unavailable until its auth, database and storage are mocked.
throw new Error('Playwright is disabled: the suite must use mocks only.')
