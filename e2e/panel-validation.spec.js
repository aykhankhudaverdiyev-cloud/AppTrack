// Validation only; no attempts, honors, activities, or projects are written.
import { test, expect, login, requireTestUser } from './fixtures.js'

const panels = [
  { tab: 'activities', kind: 'activity', label: 'Organization name', error: 'Add the organisation name', value: 'City Library', missing: 6 },
  { tab: 'projects', kind: 'project', label: 'Project title', error: 'Add the project title', value: 'AppTrack', missing: 1 },
  { tab: 'honors', kind: 'honor', label: 'Honor title', error: 'Add the honor title', value: 'Silver Medal', missing: 3 },
  { tab: 'test_scores', kind: 'test', label: 'Exam name', error: 'Add the exam name', value: 'Local exam', missing: 1 },
]

for (const { tab, kind, label, error, value, missing } of panels) {
  test(`${kind}: no errors until blur or Create, then focus and clear`, async ({ page }, testInfo) => {
    const { email, password } = requireTestUser(testInfo)
    await login(page, email, password)
    await page.goto(`/student?tab=${tab}`)
    await page.getByRole('button', { name: `Add ${kind}`, exact: true }).first().click()

    const form = page.locator('form.panel-validation')
    const errors = form.locator('.panel-field-error')
    const create = form.getByRole('button', { name: `Create ${kind}`, exact: true })
    await expect(create).toBeEnabled()
    await expect(errors).toHaveCount(0)
    await expect(form.locator('[aria-invalid="true"]')).toHaveCount(0)

    // Test type and status have defaults; selecting Other reveals a required field.
    if (kind === 'test') {
      await page.getByRole('combobox', { name: 'Test type' }).click()
      await page.getByRole('option', { name: 'Other', exact: true }).click()
      await expect(errors).toHaveCount(0)
    }

    const field = form.getByRole('textbox', { name: label, exact: true })
    await field.focus()
    await create.focus()
    await expect(errors).toHaveCount(1)
    await expect(errors).toContainText(error)
    await field.fill(value)
    await expect(errors).toHaveCount(0)

    await field.fill('')
    await create.click()
    await expect(field).toBeFocused()
    await expect(errors).toHaveCount(missing)
    await expect(form.locator('footer')).toContainText(`${missing} ${missing === 1 ? 'field' : 'fields'} left:`)

    if (kind === 'activity') {
      await form.locator('footer').getByRole('button', { name: 'Start date', exact: true }).click()
      await expect(form.getByRole('textbox', { name: 'Start date', exact: true })).toBeFocused()
    }
  })
}
