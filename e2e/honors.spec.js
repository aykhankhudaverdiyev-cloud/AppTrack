// Honors & Awards E2E (spec §5). Runs against the production build with a
// dedicated test user (E2E_EMAIL / E2E_PASSWORD). Any honor this suite
// creates is deleted again at the end of the test that created it.
import { test, expect, login, requireTestUser } from './fixtures.js'

test.describe('Honors & Awards', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { email, password } = requireTestUser(testInfo)
    await login(page, email, password)
    await page.goto('/student?tab=honors')
    await expect(page.getByRole('heading', { name: 'Honors & Awards' })).toBeVisible()
  })

  test('create a complete honor end to end, then delete it', async ({ page }) => {
    const title = `E2E Silver Medal ${Date.now()}`

    await page.getByRole('button', { name: '+ Add honor' }).first().click()

    // The draft card must never show the ⋯ menu (A5).
    await expect(page.locator('.honor-card--new .honors-menu')).toHaveCount(0)

    await page.locator('#honor-panel, .honor-panel').first()
    const panel = page.locator('.honor-panel')
    await panel.getByPlaceholder(/Silver Medal, National Informatics Olympiad/i).fill(title)
    await panel.getByPlaceholder('e.g. Informatics').fill('Informatics')
    // Grade levels + level of recognition are real selectable chip buttons (A1).
    await panel.getByRole('checkbox', { name: '9' }).click()
    await panel.getByRole('checkbox', { name: 'National' }).click()

    await expect(panel.getByText(/of 4 required fields/)).toContainText('4 of 4')
    await panel.getByRole('button', { name: 'Create honor' }).click()

    await expect(page.getByText(title)).toBeVisible()

    // Clean up: delete what this test created.
    const card = page.locator('.honor-card, .honors-card').filter({ hasText: title })
    await card.getByRole('button', { name: /actions for/i }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete' }).last().click()
    await expect(page.getByText(title)).toHaveCount(0)
  })

  test('category dropdown in the panel header is interactive (A4)', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add honor' }).first().click()
    const select = page.locator('.honor-panel__category select')
    await expect(select).toBeVisible()
    await select.selectOption('research')
    await expect(select).toHaveValue('research')
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('the "Olympiad 0" chip never appears while adding from an empty list', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add honor' }).first().click()
    // The filter bar must stay on "All" — it should not jump to a category
    // chip that would read "0" just because a draft defaults to it.
    await expect(page.getByRole('button', { name: /^All/ })).toHaveClass(/section-chip--on/)
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
