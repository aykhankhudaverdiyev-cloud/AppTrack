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

    await page.getByRole('button', { name: 'Add honor', exact: true }).first().click()

    // The draft card must never show the ⋯ menu (A5).
    await expect(page.locator('.honor-card--new .honors-menu')).toHaveCount(0)

    const panel = page.locator('.honor-panel')
    await panel.getByPlaceholder(/Silver Medal, National Informatics Olympiad/i).fill(title)
    await panel.getByRole('combobox', { name: 'Category' }).click()
    await page.getByRole('option', { name: 'Olympiad', exact: true }).click()
    await panel.getByRole('radio', { name: 'Silver / 2nd' }).click()
    await panel.getByRole('button', { name: 'Date received', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'Choose date received' })
    for (let year = new Date().getFullYear(); year > 2025; year--) {
      await picker.getByRole('button', { name: 'Previous year' }).click()
    }
    await picker.getByRole('button', { name: 'Jun 2025' }).click()
    // Grade levels + level of recognition are real selectable chip buttons (A1).
    await panel.getByRole('checkbox', { name: '9' }).click()
    await panel.getByRole('radio', { name: 'National' }).click()

    await expect(panel.getByText(/of 4 required fields/)).toContainText('4 of 4')
    await panel.getByRole('button', { name: 'Create honor' }).click()

    await expect(panel.getByRole('heading', { name: title })).toBeVisible()
    await page.reload()
    await expect(panel.getByRole('button', { name: 'Date received', exact: true })).toHaveText('Jun 2025')
    await expect(panel.getByRole('radio', { name: 'Silver / 2nd' })).toHaveAttribute('aria-checked', 'true')
    await expect(panel.getByRole('checkbox', { name: '9' })).toHaveAttribute('aria-checked', 'true')
    await expect(panel.getByRole('radio', { name: 'National' })).toHaveAttribute('aria-checked', 'true')

    // Clean up: delete what this test created.
    const card = page.locator('.honor-card, .honors-card').filter({ hasText: title })
    await card.getByRole('button', { name: /actions for/i }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete' }).last().click()
    await expect(card).toHaveCount(0)
  })

  test('category dropdown in the panel header is interactive (A4)', async ({ page }) => {
    await page.getByRole('button', { name: 'Add honor', exact: true }).first().click()
    const select = page.getByRole('combobox', { name: 'Category' })
    await expect(select).toHaveText('Other')
    await select.press('Enter')
    await select.press('ArrowDown')
    await select.press('Enter')
    await expect(select).toHaveText('Olympiad')
    await select.press('Space')
    await expect(page.getByRole('option', { selected: true })).toContainText('Olympiad')
    await select.press('Escape')
    await expect(page.getByRole('listbox', { name: 'Category' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'New honor' })).toBeVisible()
  })

  test('the "Olympiad 0" chip never appears while adding from an empty list', async ({ page }) => {
    await page.getByRole('button', { name: 'Add honor', exact: true }).first().click()
    // The filter bar must stay on "All" — it should not jump to a category
    // chip that would read "0" just because a draft defaults to it.
    await expect(page.getByRole('button', { name: /^All/ })).toHaveClass(/section-chip--on/)
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
