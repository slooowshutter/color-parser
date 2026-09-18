import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colorInputsFromPath, colorInputsToPath } from '../lib/color-url'

test('color URLs preserve bands, alpha slashes, percentages, quotes, and Unicode', () => {
    const inputs = ['#ff000080', 'oklch(72% 0.09 310 / 25%)', '--日本語: rgb(1 2 3);', '100% / # ? & + %2F', '"red"', '', '.', '..']
    const path = colorInputsToPath(inputs)
    assert.equal(new URL(path, 'https://colors.example').hash, '')
    assert.equal(new URL(path, 'https://colors.example').pathname, path)
    assert.deepEqual(colorInputsFromPath(path), inputs)
    assert.equal(colorInputsToPath(['red']), '/red')
    assert.equal(colorInputsToPath(['#fff']), '/%23fff')
})

test('empty or reserved input remains shareable without opening another app route', () => {
    for (const value of ['', 'photo', 'test', '_next', 'favicon.ico', '.', '..']) {
        const path = colorInputsToPath([value])
        assert.notEqual(path, `/${value}`)
        assert.deepEqual(colorInputsFromPath(path), [value])
    }
    assert.equal(colorInputsFromPath('/'), null)
    assert.deepEqual(colorInputsFromPath('/%broken'), ['%broken'])
})
