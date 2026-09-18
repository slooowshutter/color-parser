import { test, expect } from '@playwright/test'

test('rounding stays consistent across bands, copied values, reloads, and browser tabs', async ({ page, context }) => {
    await context.route('https://*.simpleanalyticscdn.com/**', route => route.fulfill({ status: 204, body: '' }))
    const runtimeErrors: string[] = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    page.on('console', message => {
        if (message.type() === 'error') runtimeErrors.push(message.text())
    })
    await page.addInitScript(() => {
        let copied = ''
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            readText: async () => copied,
            writeText: async (text: string) => { copied = text },
        } })
    })
    const values = ['rgb(12.34567 67.891 210.4567 / 0.456789)', 'hsl(123.456 45.678% 54.321%)']
    await page.goto('/' + values.map(encodeURIComponent).join('/'))
    const bands = page.getByTestId('color-band')
    const toggles = page.getByRole('button', { name: 'Round color values' })
    await expect(toggles.first()).toHaveAttribute('aria-pressed', 'false')
    const originalUrl = page.url()
    const previewColor = await bands.first().locator('[data-slot="card"] > .absolute').evaluate(element => getComputedStyle(element).backgroundColor)
    await toggles.first().click()
    await expect(toggles.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(bands.first().getByRole('button', { name: 'rgb(12 68 210 / 0.456789)', exact: true })).toBeVisible()
    await expect(bands.nth(1).getByRole('button', { name: 'hsl(123 46% 54%)', exact: true })).toBeVisible()
    await expect(page).toHaveURL(originalUrl)
    await expect(bands.first().getByRole('textbox', { name: 'Color value', exact: true })).toHaveValue(values[0])
    await expect(bands.first().locator('[data-slot="card"] > .absolute')).toHaveCSS('background-color', previewColor)
    await bands.first().getByRole('button', { name: 'rgb(12 68 210 / 0.456789)', exact: true }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('rgb(12 68 210 / 0.456789)')
    await page.getByRole('button', { name: 'Export Colors', exact: true }).click()
    await page.getByRole('button', { name: 'Copy to Clipboard', exact: true }).click()
    expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))[0]).toBe('rgba(12, 68, 210, 0.456789)')
    await page.reload()
    await expect(toggles.first()).toHaveAttribute('aria-pressed', 'true')
    for (const toggle of await toggles.all()) await toggle.click({ trial: true })
    await page.screenshot({ path: `.context/color-rounding-${test.info().project.name}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Add empty panel' }).click()
    await expect(toggles).toHaveCount(3)
    await expect(toggles.nth(2)).toHaveAttribute('aria-pressed', 'true')
    const otherTab = await context.newPage()
    await otherTab.goto('/%23010203')
    await expect(otherTab.getByRole('button', { name: 'Round color values' })).toHaveAttribute('aria-pressed', 'true')
    await toggles.first().click()
    await expect(otherTab.getByRole('button', { name: 'Round color values' })).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(toggles.first()).toHaveAttribute('aria-pressed', 'false')
    await expect(bands.first().getByRole('button', { name: values[0], exact: true })).toBeVisible()
    await expect(bands.nth(1).getByRole('button', { name: values[1], exact: true })).toBeVisible()
    await otherTab.close()
    expect(runtimeErrors).toEqual([])
})
