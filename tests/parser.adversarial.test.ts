import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildColorObject } from '../lib/build-color-object'
import { rgbToXyz, xyzToRgb } from '../lib/converter'
import { COLOR_FORMATS, formatColor } from '../lib/format-color'
import { parseToken } from '../lib/parser'
import { ColorTokenizer } from '../lib/tokenizer'
import type { ColorObject, Token, TokenType } from '../lib/types'

type ColorCase = {
    input: string
    hex: string
    alpha?: number
}

const validCases: ColorCase[] = [
    { input: '#abc', hex: '#aabbcc' },
    { input: '#AbC0', hex: '#aabbcc00', alpha: 0 },
    { input: '#1234', hex: '#11223344', alpha: 68 / 255 },
    { input: '#12345678', hex: '#12345678', alpha: 120 / 255 },
    { input: '#ffffffff', hex: '#ffffff' },
    { input: 'rgb(255, 0, 0)', hex: '#ff0000' },
    { input: 'rgba(255, 0, 0)', hex: '#ff0000' },
    { input: 'rgb(100%, 0%, 0%, 50%)', hex: '#ff000080', alpha: 0.5 },
    { input: 'rgb(100% 0 0 / 25%)', hex: '#ff000040', alpha: 0.25 },
    { input: 'RGBA(255 0% 0 / .5)', hex: '#ff000080', alpha: 0.5 },
    { input: 'rgb(2.55e2 0e0 +0 / 5e-1)', hex: '#ff000080', alpha: 0.5 },
    { input: 'rgb(255\n0\t0 / 0)', hex: '#ff000000', alpha: 0 },
    { input: 'rgb(999 -20 0 / 2)', hex: '#ff0000', alpha: 1 },
    { input: 'rgba(255, 0, 0, 2)', hex: '#ff0000', alpha: 1 },
    { input: 'rgb(200% -2% 0% / -0.5)', hex: '#ff000000', alpha: 0 },
    { input: 'rgb(255 0 0 / 120%)', hex: '#ff0000', alpha: 1 },
    { input: 'hsl(120, 100%, 50%)', hex: '#00ff00' },
    { input: 'hsla(120 100% 50% / 0)', hex: '#00ff0000', alpha: 0 },
    { input: 'hsl(.5turn 100% 50%)', hex: '#00ffff' },
    { input: 'hsl(200grad 100% 50%)', hex: '#00ffff' },
    { input: 'hsl(3.141592653589793rad 100% 50%)', hex: '#00ffff' },
    { input: 'hsl(-120deg 100% 50%)', hex: '#0000ff' },
    { input: 'hsl(1080deg 100% 50%)', hex: '#ff0000' },
    { input: 'hsl(0 200% 50% / 25%)', hex: '#ff000040', alpha: 0.25 },
    { input: 'oklch(0 0 0)', hex: '#000000' },
    { input: 'oklch(100% 0 0)', hex: '#ffffff' },
    { input: 'oklch(0.62795536 0.25768331 29.233885)', hex: '#ff0000' },
    { input: 'cmyk(0%, 100%, 100%, 0%)', hex: '#ff0000' },
    { input: 'cmyk(0, 1, 1, 0)', hex: '#ff0000' },
    { input: 'cmyk(0, 0, 0, 1)', hex: '#000000' },
]

async function singleColor(input: string): Promise<ColorObject> {
    const colors = await buildColorObject(input)
    assert.equal(colors.length, 1, `Expected exactly one color from ${JSON.stringify(input)}`)
    return colors[0]
}

function near(actual: unknown, expected: number, tolerance = 1e-8): void {
    assert.equal(typeof actual, 'number')
    assert.ok(typeof actual === 'number' && Number.isFinite(actual))
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`)
}

function channel(value: unknown, key: string): unknown {
    assert.ok(value !== null && typeof value === 'object')
    return Reflect.get(value, key)
}

for (const { input, hex, alpha = 1 } of validCases) {
    test(`valid color: ${input}`, async () => {
        const color = await singleColor(input)
        assert.equal(color.convertedColors.hex, hex)
        near(color.parsedColor.alpha, alpha)
    })
}

const rejectedInputs = [
    'feed cafe dead beef badge face 123456 abcdef ff00ff',
    '#12', '#12345', '#1234567', '#123456789', '#ggg', '#123xyz', '#123456zz',
    'rgb(1px, 2, 3)', 'rgb(1, 2em, 3)', 'rgb(1, 2, 3junk)',
    'rgba(1, 2, 3, .5oops)', 'rgb(1, 2, 3, 4, 5)',
    'rgb(1 2 3 0.5)', 'rgb(1, 2 3)', 'rgb(1, 2, 3 / .5)',
    'rgb(1% , 2, 3)', 'rgb(1 2 3 / .5 / .2)', 'rgb(1 2 3 /)',
    'rgb(1 2 3 // .5)', 'rgb(1 2)', 'rgb(1,,3)', 'rgb(NaN 0 0)',
    'rgb(Infinity 0 0)', 'rgb(1e999 0 0)', 'rgb(1e 0 0)',
    'rgb(0xFF 0 0)', 'rgb(1..2 0 0)', 'rgb(1_000 0 0)',
    'hsl(20garbage, 50%, 50%)', 'hsl(20radial 50% 50%)',
    'hsl(20 50% 50% / .5 / .2)', 'hsl(20 50% 50% /)',
    'oklch(.5 .2 30 extra)', 'oklch(.5 .2 30 / .5 / .2)',
    'oklch(.5 .2 30 /)', 'oklch(.5, .2, 30)', 'oklch(.5 .2foo 30)',
    'cmyk(0%, 0%, 0%, 0%oops)', 'cmyk(0, 0, 0)',
    'notrgb(255, 0, 0)', 'myhsl(0 100% 50%)',
    'color-mix(in srgb, #f00, rgb(0 0 255))',
    'rgb(from #f00 r g b)', 'rgb(calc(255) 0 0)',
    'var(--brand, #fff)', 'url(image-#fff.png)',
    'rgb(1 2 3', 'oklch(.5 .2 30',
]

for (const input of rejectedInputs) {
    test(`rejects malformed or unsupported input: ${input}`, async () => {
        assert.deepEqual(await buildColorObject(input), [])
    })
}

test('retains fractional RGB precision before display serialization', async () => {
    const color = await singleColor('rgb(50% 12.5 0)')
    near(channel(color.parsedColor.color, 'r'), 127.5)
    near(channel(color.parsedColor.color, 'g'), 12.5)
    assert.equal(color.convertedColors.hex, '#800d00')
})

test('OKLCH percentages and hue units use CSS reference ranges', async () => {
    const color = await singleColor('oklch(50% 50% .5turn / 25%)')
    near(channel(color.parsedColor.color, 'l'), 0.5)
    near(channel(color.parsedColor.color, 'c'), 0.2)
    near(channel(color.parsedColor.color, 'h'), 180)
    near(color.parsedColor.alpha, 0.25)
})

test('OKLCH clamps lightness and negative chroma', async () => {
    const color = await singleColor('oklch(150% -1 0)')
    near(channel(color.parsedColor.color, 'l'), 1)
    near(channel(color.parsedColor.color, 'c'), 0)
    assert.equal(color.convertedColors.hex, '#ffffff')
})

test('transparent colors preserve RGB and alpha in every alpha-aware output', async () => {
    const color = await singleColor('#ff000000')
    near(channel(color.convertedColors.rgb, 'r'), 255)
    near(channel(color.convertedColors.rgb, 'a'), 0)
    near(channel(color.convertedColors.hsl, 'a'), 0)
    assert.equal(color.convertedColors.hex, '#ff000000')
})

test('custom properties keep names and parse complete wrapped and raw values', async () => {
    const source = ':root {\n --brand: #1234;\n --accent: hsl(.5turn 100% 50% / 0);\n --raw-hsl: 240 100% 50%;\n --raw-rgb: 255 0 0 / 25%;\n}'
    const colors = await buildColorObject(source)
    assert.deepEqual(colors.map(color => color.parsedColor.cssVariable), ['brand', 'accent', 'raw-hsl', 'raw-rgb'])
    assert.deepEqual(colors.map(color => color.convertedColors.hex), ['#11223344', '#00ffff00', '#0000ff', '#ff000040'])
    assert.deepEqual(colors.map(color => color.token.type), Array(4).fill('css-variable'))
})

test('invalid custom-property values do not masquerade as a complete color', async () => {
    const source = ':root { --broken: #fff garbage; --reference: var(--other, #abc); --space: 10px 20px 30px; }'
    assert.deepEqual(await buildColorObject(source), [])
})

test('extraction preserves source order, exact spans, duplicate occurrences, and CRLF line numbers', async () => {
    const source = '🎨 #abc\r\n  rgb(255 0 0 / 0)\n#abc'
    const colors = await buildColorObject(source)
    assert.deepEqual(colors.map(color => color.token.raw), ['#abc', 'rgb(255 0 0 / 0)', '#abc'])
    assert.deepEqual(colors.map(color => color.token.line), [1, 2, 3])
    for (const { token } of colors) {
        assert.equal(source.slice(token.startPosition, token.endPosition), token.raw)
    }
    assert.equal(new Set(colors.map(color => color.token.id)).size, 3)
})

test('rejecting one candidate does not lose later valid colors', async () => {
    const colors = await buildColorObject('rgb(1px 2 3); #12345; #00ff00; hsl(240 100% 50%)')
    assert.deepEqual(colors.map(color => color.convertedColors.hex), ['#00ff00', '#0000ff'])
})

test('tokenizer remains deterministic across repeated and interleaved calls', () => {
    const input = '#abc rgb(1 2 3) #abc'
    const first = new ColorTokenizer(input).getTokens()
    new ColorTokenizer('hsl(0 100% 50%)').getTokens()
    const second = new ColorTokenizer(input).getTokens()
    const withoutId = (tokens: Token[]) => tokens.map(token => ({ ...token, id: undefined }))
    assert.deepEqual(withoutId(first), withoutId(second))
})

const invalidDirectTokens: { type: TokenType; raw: string }[] = [
    { type: 'hex', raw: '#12345' },
    { type: 'hex', raw: 'abcdef' },
    { type: 'hex', raw: '#GGG' },
    { type: 'rgb', raw: 'prefix rgb(1, 2, 3)' },
    { type: 'rgb', raw: 'rgb(1, 2, 3) suffix' },
    { type: 'rgb', raw: 'rgb(1garbage, 2, 3)' },
    { type: 'hsl', raw: 'hsl(30foo 50% 50%)' },
    { type: 'oklch', raw: 'oklch(.5 .2 30 extra)' },
]

for (const { type, raw } of invalidDirectTokens) {
    test(`parseToken validates the entire public input: ${raw}`, () => {
        assert.equal(parseToken({ id: 'adversary', type, raw, startPosition: 0, endPosition: raw.length, line: 1 }), null)
    })
}

test('sRGB red XYZ conversion agrees with the D65 reference matrix', () => {
    const xyz = rgbToXyz({ r: 255, g: 0, b: 0 })
    near(xyz.x, 41.23907992659595, 0.02)
    near(xyz.y, 21.26390058715103, 0.02)
    near(xyz.z, 1.933081871559185, 0.002)
})

test('sRGB XYZ conversions preserve a deterministic lattice of byte values', () => {
    const values = [0, 1, 2, 10, 11, 64, 127, 128, 192, 254, 255]
    for (const r of values) {
        for (const g of values) {
            for (const b of values) {
                const result = xyzToRgb(rgbToXyz({ r, g, b }))
                near(result.r, r, 0.51)
                near(result.g, g, 0.51)
                near(result.b, b, 0.51)
            }
        }
    }
})

const extendedCases: ColorCase[] = [
    { input: 'red', hex: '#ff0000' },
    { input: 'ReBeccAPurple', hex: '#663399' },
    { input: 'transparent', hex: '#00000000', alpha: 0 },
    { input: 'rgb(none 0 255 / none)', hex: '#0000ff00', alpha: 0 },
    { input: 'hsl(none 100 50 / none)', hex: '#ff000000', alpha: 0 },
    { input: 'hwb(120 0 0)', hex: '#00ff00' },
    { input: 'hwb(0 20% 30%)', hex: '#b33333' },
    { input: 'hwb(240 80% 80%)', hex: '#808080' },
    { input: 'hwb(.5turn 0% 0% / 0)', hex: '#00ffff00', alpha: 0 },
    { input: 'lab(50% 0 0)', hex: '#777777' },
    { input: 'lab(29.567% 68.298 -112.0294)', hex: '#0000ff' },
    { input: 'lab(97.607% -15.753 93.388)', hex: '#ffff00' },
    { input: 'lch(50% 0 .5turn)', hex: '#777777' },
    { input: 'oklab(.5 0 0)', hex: '#636363' },
    { input: 'oklab(0.62795536 0.22486306 0.1258463)', hex: '#ff0000' },
    { input: 'oklch(.5 none none)', hex: '#636363' },
    { input: 'rgb(255 /* channel separator */ 0 0)', hex: '#ff0000' },
    { input: 'rgb(1e308% 0 0)', hex: '#ff0000' },
]

for (const { input, hex, alpha = 1 } of extendedCases) {
    test(`round two — valid color: ${input}`, async () => {
        const color = await singleColor(input)
        assert.equal(color.convertedColors.hex, hex)
        near(color.parsedColor.alpha, alpha)
    })
}

test('round two — CSS Lab, LCH, and Oklab percentages use their own reference ranges', async () => {
    const lab = await singleColor('lab(50% 20% -20%)')
    near(channel(lab.parsedColor.color, 'l'), 50)
    near(channel(lab.parsedColor.color, 'a'), 25)
    near(channel(lab.parsedColor.color, 'b'), -25)
    const lch = await singleColor('lch(50% 20% 200grad)')
    near(channel(lch.parsedColor.color, 'c'), 30)
    near(channel(lch.parsedColor.color, 'h'), 180)
    const oklab = await singleColor('oklab(50% 20% -20%)')
    near(channel(oklab.parsedColor.color, 'l'), 0.5)
    near(channel(oklab.parsedColor.color, 'a'), 0.08)
    near(channel(oklab.parsedColor.color, 'b'), -0.08)
})

test('round two — comments and multiline values keep custom-property metadata', async () => {
    const source = ':root {\n --brand: /* primary */ #f00;\n --accent: rgb(\n 0 0 255\n ) !important;\n}'
    const colors = await buildColorObject(source)
    assert.deepEqual(colors.map(color => color.parsedColor.cssVariable), ['brand', 'accent'])
    assert.deepEqual(colors.map(color => color.convertedColors.hex), ['#ff0000', '#0000ff'])
})

test('round two — comments do not create phantom colors', async () => {
    const source = '/* #bad rgb(255 0 0) */ #123 /* hsl(0 100% 50%) */'
    const colors = await buildColorObject(source)
    assert.deepEqual(colors.map(color => color.token.raw), ['#123'])
})

test('round two — gradients expose stops while unresolved nested functions remain opaque', async () => {
    const colors = await buildColorObject('linear-gradient(var(--brand, #f00), #0f0, rgb(0 0 255 / .5))')
    assert.deepEqual(colors.map(color => color.convertedColors.hex), ['#00ff00', '#0000ff80'])
})

for (const input of [
    'hwb(0, 20%, 30%)', 'lab(50%, 0, 0)', 'lch(50% 20 30 extra)',
    'oklab(.5 0 0 0)', 'hsl(0, 100, 50)', 'rgb(none, 0, 0)',
    'infrared reddish blueish red-blue brand_rgb(255 0 0)',
    'currentColor inherit initial unset',
    'url("#fff")', 'color(display-p3 1 0 0)',
]) {
    test(`round two — unsupported or malformed: ${input}`, async () => {
        assert.deepEqual(await buildColorObject(input), [])
    })
}

test('round two — all 256 alpha bytes survive exact hex round trips', async () => {
    for (let byte = 0; byte < 256; byte++) {
        const alphaHex = byte.toString(16).padStart(2, '0')
        const color = await singleColor(`#123456${alphaHex}`)
        near(color.parsedColor.alpha, byte / 255)
        assert.equal(color.convertedColors.hex, byte === 255 ? '#123456' : `#123456${alphaHex}`)
    }
})

function seededRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        return (state >>> 0) / 4294967296
    }
}

test('round two — 512 generated RGB fixtures have independently calculated bytes and alpha', async () => {
    const random = seededRandom(0xc010a)
    const byteHex = (value: number) => value.toString(16).padStart(2, '0')
    for (let index = 0; index < 512; index++) {
        const r = Math.floor(random() * 256), g = Math.floor(random() * 256), b = Math.floor(random() * 256)
        const alpha = Math.floor(random() * 256)
        const rgb = index % 2 === 0
            ? `RGB(${r}e0 ${g * 100 / 255}% ${b} / ${alpha / 255})`
            : `rgba(${r},${g},${b},${alpha * 100 / 255}%)`
        const color = await singleColor(rgb)
        const expected = `#${byteHex(r)}${byteHex(g)}${byteHex(b)}${alpha < 255 ? byteHex(alpha) : ''}`
        assert.equal(color.convertedColors.hex, expected, rgb)
        near(color.parsedColor.alpha, alpha / 255)
    }
})

test('round two — numeric suffix mutations never accept a partial channel', async () => {
    const suffixes = ['px', 'em', 'deg', 'garbage', '%junk', 'e', 'e+', '_0', '..0', '%%']
    for (const suffix of suffixes) {
        for (let position = 0; position < 4; position++) {
            const values = ['10', '20', '30', '.5']
            values[position] += suffix
            assert.deepEqual(await buildColorObject(`rgb(${values.slice(0, 3).join(' ')} / ${values[3]})`), [])
        }
    }
})

function assertFiniteTree(value: unknown): void {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), `Non-finite value: ${value}`)
    if (typeof value === 'string') assert.doesNotMatch(value, /NaN|Infinity/)
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value)) assertFiniteTree(child)
    }
}

test('round two — seeded corrupt input always produces finite, ordered, non-overlapping results', async () => {
    const random = seededRandom(0xbadc010)
    const chunks = ['rgb(', 'hsl(', 'oklab(', 'oklch(', 'lab(', 'lch(', 'var(', '#', ')', '(', '/', ',', ';', '\n', '0', '1e308', '-1e308', '1e999', '.5', '0%', 'none', '#fff', 'red', 'x', ' ', '\t', '/*', '*/']
    const extremes = ['oklch(.5 1e308 30)', 'oklab(.5 1e308 -1e308)', 'lab(50 1e308 0)', 'lch(50 1e308 20)', 'hsl(1e308turn 100% 50%)']
    const inputs = [...extremes]
    for (let sample = 0; sample < 800; sample++) {
        let source = ''
        for (let part = 0; part < 24; part++) source += chunks[Math.floor(random() * chunks.length)]
        inputs.push(source)
    }
    for (const source of inputs) {
        const colors = await buildColorObject(source)
        let previousEnd = 0
        for (const color of colors) {
            assertFiniteTree(color.parsedColor)
            assertFiniteTree(color.convertedColors)
            assert.ok(color.token.startPosition >= previousEnd, source)
            assert.equal(source.slice(color.token.startPosition, color.token.endPosition), color.token.raw)
            assert.match(String(color.convertedColors.hex), /^#[a-f\d]{6}(?:[a-f\d]{2})?$/)
            previousEnd = color.token.endPosition
        }
    }
})

test('round two — JSON color values do not turn property names into extra colors', async () => {
    const source = JSON.stringify({ red: '#00ff00', blue: 'rgb(255 0 0)', cyan: 'hsl(240 100% 50%)' })
    const colors = await buildColorObject(source)
    assert.deepEqual(colors.map(color => color.convertedColors.hex), ['#00ff00', '#ff0000', '#0000ff'])
    assert.deepEqual(colors.map(color => color.token.raw), ['#00ff00', 'rgb(255 0 0)', 'hsl(240 100% 50%)'])
})

for (const important of ['! important', '! /* annotation */ IMPORTANT']) {
    test(`round two — CSS declaration annotation: ${important}`, async () => {
        const color = await singleColor(`--brand: #ff0000 ${important};`)
        assert.equal(color.parsedColor.cssVariable, 'brand')
        assert.equal(color.convertedColors.hex, '#ff0000')
    })
}

for (const separator of ['\u00a0', '\u2003', '\u000b']) {
    test(`round two — rejects non-CSS whitespace U+${separator.charCodeAt(0).toString(16)}`, async () => {
        assert.deepEqual(await buildColorObject(`rgb(255${separator}0${separator}0)`), [])
    })
}

test('round two — CSS form-feed is valid channel whitespace', async () => {
    assert.equal((await singleColor('rgb(255\f0\f0)')).convertedColors.hex, '#ff0000')
})

for (const input of ['#fff\\g', 'prefix\\rgb(255 0 0)']) {
    test(`round two — unsupported escapes do not expose a misleading partial color: ${input}`, async () => {
        assert.deepEqual(await buildColorObject(input), [])
    })
}

test('round two — extended HSL saturation is retained until sRGB display clipping', async () => {
    const color = await singleColor('hsl(0 200% 25%)')
    near(channel(color.parsedColor.color, 's'), 200)
    assert.equal(color.convertedColors.hex, '#bf0000')
})

test('round two — all nine formatted outputs can be parsed again without losing color or alpha', async () => {
    for (const input of ['#12345600', '#fedcba01', '#0101017f', '#66339980', '#ff9900fe', '#00ff00']) {
        const original = await singleColor(input)
        for (const format of COLOR_FORMATS) {
            const serialized = formatColor(original, format)
            const reparsed = await singleColor(serialized)
            assert.equal(reparsed.convertedColors.hex, input, `${input} -> ${serialized}`)
            near(reparsed.parsedColor.alpha, original.parsedColor.alpha, 1e-6)
        }
    }
})
