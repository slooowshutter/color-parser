import { COMPONENT_PATTERNS, COLOR_FUNCTIONS } from './patterns'
import { NAMED_COLOR_HEX } from './named-colors'
import type { ParsedColor, Token, HexColor, ColorType } from './types'

const clamp = (value: number, max = 1) => Math.min(max, Math.max(0, value))
const trimCss = (value: string) => value.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')

type Arguments = { channels: string[]; alpha?: string; legacy: boolean }

function splitArguments(body: string, count: number, allowLegacy: boolean): Arguments | null {
    if (/[()]/.test(body)) return null
    if (body.includes(',')) {
        if (!allowLegacy || body.includes('/') || /\bnone\b/i.test(body)) return null
        const values = body.split(',').map(trimCss)
        if (values.some(value => !value) || (values.length !== count && values.length !== count + 1)) return null
        return { channels: values.slice(0, count), alpha: values[count], legacy: true }
    }
    const pieces = body.split('/')
    if (pieces.length > 2 || (pieces.length === 2 && !trimCss(pieces[1]))) return null
    const channels = trimCss(pieces[0]).split(/[ \t\n\r\f]+/)
    if (channels.length !== count) return null
    return { channels, alpha: pieces[1] === undefined ? undefined : trimCss(pieces[1]), legacy: false }
}

function number(value: string, percentageScale = 1, allowNone = true): number | null {
    if (allowNone && value.toLowerCase() === 'none') return 0
    const isPercent = COMPONENT_PATTERNS.percentageValue.test(value)
    if (!isPercent && !COMPONENT_PATTERNS.numberValue.test(value)) return null
    const raw = Number(isPercent ? value.slice(0, -1) : value)
    if (!Number.isFinite(raw)) return null
    const result = isPercent ? raw / 100 * percentageScale : raw
    return Number.isFinite(result) ? result : Math.sign(raw) * Number.MAX_VALUE
}

function hue(value: string, allowNone: boolean): number | null {
    if (allowNone && value.toLowerCase() === 'none') return 0
    const match = COMPONENT_PATTERNS.hueWithUnit.exec(value)
    if (!match) return null
    const raw = Number(match[1])
    if (!Number.isFinite(raw)) return null
    const unit = match[2]?.toLowerCase()
    // Reduce before scaling — huge finite angles must not overflow into Infinity
    const period = unit === 'turn' ? 1 : unit === 'grad' ? 400 : unit === 'rad' ? Math.PI * 2 : 360
    return ((raw % period) / period * 360 + 360) % 360
}

function parseHex(raw: string): ParsedColor | null {
    if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(raw)) return null
    let digits = raw.slice(1).toLowerCase()
    if (digits.length <= 4) digits = [...digits].map(char => char + char).join('')
    return {
        colorType: 'hex', color: `#${digits.slice(0, 6)}` as HexColor,
        alpha: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1,
    }
}

function parseFunction(type: ColorType, body: string): ParsedColor | null {
    const args = splitArguments(body, type === 'cmyk' ? 4 : 3, ['rgb', 'hsl', 'cmyk'].includes(type))
    if (!args) return null
    const { channels: v, legacy } = args
    const opacity = args.alpha === undefined ? 1 : number(args.alpha, 1, !legacy)
    if (opacity === null) return null
    const alpha = clamp(opacity)
    const value = (index: number, scale = 100) => number(v[index], scale, !legacy)
    if (type === 'rgb') {
        if (legacy && v.some(channel => channel.endsWith('%')) && !v.every(channel => channel.endsWith('%'))) return null
        const [r, g, b] = v.map(channel => number(channel, 255, !legacy))
        if (r === null || g === null || b === null) return null
        return { colorType: type, color: { r: clamp(r, 255), g: clamp(g, 255), b: clamp(b, 255) }, alpha }
    }
    if (type === 'hsl' || type === 'hwb') {
        if (legacy && (!v[1].endsWith('%') || !v[2].endsWith('%'))) return null
        const h = hue(v[0], !legacy), first = value(1), second = value(2)
        if (h === null || first === null || second === null) return null
        return { colorType: type, color: type === 'hsl'
            ? { h, s: Math.max(0, first), l: clamp(second, 100) }
            : { h, w: clamp(first, 100), b: clamp(second, 100) }, alpha }
    }
    if (type === 'cmyk') {
        const channels = v.map(channel => {
            const parsed = number(channel, 100, !legacy)
            if (parsed === null) return null
            return clamp(!channel.endsWith('%') && parsed <= 1 ? parsed * 100 : parsed, 100)
        })
        const [c, m, y, k] = channels
        if (c === null || m === null || y === null || k === null) return null
        return { colorType: type, color: { c, m, y, k }, alpha }
    }
    const isOk = type === 'oklab' || type === 'oklch'
    const isPolar = type === 'lch' || type === 'oklch'
    const l = value(0, isOk ? 1 : 100)
    const second = value(1, isOk ? 0.4 : isPolar ? 150 : 125)
    const third = isPolar ? hue(v[2], true) : value(2, isOk ? 0.4 : 125)
    if (l === null || second === null || third === null) return null
    return { colorType: type, color: isPolar
        ? { l: clamp(l, isOk ? 1 : 100), c: Math.max(0, second), h: third }
        : { l: clamp(l, isOk ? 1 : 100), a: second, b: third }, alpha }
}

/** Parse one complete standalone value; unresolved expressions and malformed syntax return null. */
export function parseColorValue(input: string): ParsedColor | null {
    const raw = trimCss(input)
    if (raw.startsWith('#')) return parseHex(raw)
    if (raw.toLowerCase() === 'transparent') return { colorType: 'rgb', color: { r: 0, g: 0, b: 0 }, alpha: 0 }
    const named = Object.hasOwn(NAMED_COLOR_HEX, raw.toLowerCase()) ? NAMED_COLOR_HEX[raw.toLowerCase()] : undefined
    if (named) return parseHex(named)
    const open = raw.indexOf('(')
    if (open <= 0 || !raw.endsWith(')')) return null
    const name = raw.slice(0, open).toLowerCase()
    if (!Object.hasOwn(COLOR_FUNCTIONS, name)) return null
    const type = COLOR_FUNCTIONS[name as keyof typeof COLOR_FUNCTIONS]
    // CSS comments separate tokens; never concatenate channels across them
    const body = raw.slice(open + 1, -1).replace(/\/\*[\s\S]*?\*\//g, ' ')
    if (body.includes('/*') || body.includes('*/')) return null
    return parseFunction(type, body)
}

/** Raw custom-property triples are a compatibility extension for design token files. */
export function parseCustomPropertyValue(value: string): ParsedColor | null {
    const uncommented = value.replace(/\/\*[\s\S]*?\*\//g, ' ')
    if (uncommented.includes('/*') || uncommented.includes('*/')) return null
    const raw = trimCss(uncommented.replace(/[ \t\n\r\f]*![ \t\n\r\f]*important[ \t\n\r\f]*$/i, ''))
    const complete = parseColorValue(raw)
    if (complete) return complete
    const args = splitArguments(raw, 3, false)
    if (!args) return null
    const [first, second, third] = args.channels
    const type = !first.endsWith('%') && second.endsWith('%') && third.endsWith('%') ? 'hsl' : 'rgb'
    return parseFunction(type, raw)
}

/** Tokens are revalidated so callers cannot bypass the grammar by constructing tokens directly. */
export function parseToken(token: Token): ParsedColor | null {
    if (token.type === 'css-variable') {
        const match = /^(--[\w\-\u0080-\uffff]+)[ \t\n\r\f]*:[ \t\n\r\f]*([\s\S]*)$/.exec(token.raw)
        if (!match) return null
        const parsed = parseCustomPropertyValue(match[2])
        return parsed ? { ...parsed, cssVariable: match[1].slice(2) } : null
    }
    const parsed = parseColorValue(token.raw)
    return parsed && token.cssVariable ? { ...parsed, cssVariable: token.cssVariable } : parsed
}

/** Preserve source order and omit invalid tokens. */
export function parseTokens(tokens: Token[]): ParsedColor[] {
    return tokens.flatMap(token => {
        const parsed = parseToken(token)
        return parsed ? [parsed] : []
    })
}
