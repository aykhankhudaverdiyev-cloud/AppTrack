// Test Scores E2E (spec §5). Runs against the production build with a
// dedicated test user (E2E_EMAIL / E2E_PASSWORD). Any attempt this suite
// creates is deleted again at the end of the test that created it.
import { test, expect, login, requireTestUser } from './fixtures.js'

test.describe('Test Scores', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { email, password } = requireTestUser(testInfo)
    await login(page, email, password)
    await page.goto('/student?tab=test_scores')
    await expect(page.getByRole('heading', { name: 'Test Scores' })).toBeVisible()
  })

  test('the 40/60 list+panel layout appears while a panel is open (C-category)', async ({ page }) => {
    await page.getByRole('button', { name: 'Add test', exact: true }).first().click()
    await expect(page.locator('.tests-columns--panel')).toBeVisible()
    await expect(page.locator('.test-card--new')).toContainText('Not saved yet')
    await expect(page.getByRole('region', { name: 'New test' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('IELTS status chips select correctly and overall rounds to the nearest 0.5', async ({ page }) => {
    await page.getByRole('button', { name: 'Add test', exact: true }).first().click()
    const panel = page.locator('.test-panel')
    await panel.getByRole('combobox', { name: 'Test type' }).click()
    await page.getByRole('option', { name: 'IELTS', exact: true }).click()
    await panel.getByRole('radio', { name: 'Released' }).click()
    await expect(panel.getByRole('radio', { name: 'Released' })).toBeChecked()

    const sections = panel.locator('.test-section-item')
    await sections.nth(0).locator('.test-score-input').fill('7.5') // Listening
    await sections.nth(1).locator('.test-score-input').fill('8.5') // Reading
    await sections.nth(2).locator('.test-score-input').fill('6.5') // Writing
    await sections.nth(3).locator('.test-score-input').fill('7')   // Speaking

    // suggestOverall rounds the IELTS average (7.5+8.5+6.5+7)/4 = 7.375 -> 7.5
    await expect(panel.getByText('Suggested from sections: 7.5')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('document picker opens and lists documents without extra clicks (A9)', async ({ page }) => {
    await page.getByRole('button', { name: 'Add test', exact: true }).first().click()
    const panel = page.locator('.test-panel')
    await panel.getByRole('combobox', { name: 'Test type' }).click()
    await page.getByRole('option', { name: 'IELTS', exact: true }).click()
    await panel.getByRole('radio', { name: 'Released' }).click()
    await panel.getByRole('button', { name: /add file|change/i }).click()
    await expect(page.getByRole('dialog', { name: 'Choose a document' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Your documents', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close document picker' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
