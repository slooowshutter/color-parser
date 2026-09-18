import { test, expect } from '@playwright/test'
import { parseColors } from '../../lib/build-color-object'
import type { RGBColor } from '../../lib/types'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let copied: string | undefined
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: async () => { if (copied === undefined) throw new Error('No clipboard permission'); return copied },
      writeText: async (text: string) => { copied = text },
    } })
  })
  await page.goto('/')
  await expect(page.getByText('Reading from clipboard...')).toHaveCount(0)
})

test('invalid RGB does not offer a previous color as its conversion', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Color value', exact: true })
  await input.fill('rgb(255, 0, 0)')
  await expect(page.getByText('#ff0000', { exact: true })).toBeVisible()
  await input.fill('rgb(1px, 2, 3)')
  await expect(page.getByText('#ff0000', { exact: true })).toHaveCount(0)
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByTestId('color-band').getByRole('alert')).toContainText('No supported color found')
})

test('copying OKLCH and pasting it back preserves dark and bright RGB colors', async ({ page }) => {
  await page.getByRole('button', { name: 'Show More', exact: true }).click()
  for (const [r, g, b] of [[1, 2, 3], [10, 20, 30], [255, 128, 64]]) {
    const source = `rgb(${r}, ${g}, ${b})`
    await page.getByRole('textbox', { name: 'Color value', exact: true }).fill(source)
    const originalRgb = await page.locator('[data-slot="card"]').evaluate(element => getComputedStyle(element).backgroundColor)
    await page.getByText(/^oklch\(/).first().click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/^oklch\(/)
    const pasted = parseColors(copied)[0]?.convertedColors.rgb as RGBColor
    expect(pasted).toBeDefined()
    for (const channel of ['r', 'g', 'b'] as const) {
      expect(Math.abs(pasted[channel] - { r, g, b }[channel])).toBeLessThan(0.01)
    }
    await page.getByRole('textbox', { name: 'Color value', exact: true }).fill(copied)
    await expect(page.locator('[data-slot="card"]')).toHaveCSS('background-color', originalRgb)
  }
})
