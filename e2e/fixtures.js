// Shared login helper for the Playwright E2E suite (spec §5).
// Requires E2E_EMAIL / E2E_PASSWORD env vars pointing at a dedicated test
// account — never a real student account. Tests skip (not fail) when the
// credentials are not provided, so `npm run test:e2e` is safe to run in any
// environment without silently reporting false passes.
import { test as base, expect } from '@playwright/test'

export const test = base.extend({})

export function requireTestUser(testInfo) {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) {
    testInfo.skip(true, 'E2E_EMAIL / E2E_PASSWORD are not set — skipping (see README/report).')
  }
  return { email, password }
}

export async function login(page, email, password) {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/student/, { timeout: 15_000 })
}

export { expect }
