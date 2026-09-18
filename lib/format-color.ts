import type { ColorObject, RGBColor, HSLColor, HWBColor, OKLabColor, OKLCHColor, LabColor, LCHColor, CMYKColor } from './types'

export const COLOR_FORMATS = ['hex', 'rgb', 'hsl', 'hwb', 'oklch', 'oklab', 'lab', 'lch', 'cmyk'] as const
export type ColorFormat = typeof COLOR_FORMATS[number]

const decimal = (value: number, places = 5): string => Number(value.toFixed(places)).toString()

/** Rounding affects serialized channels only; source values and opacity retain their precision. */
export function formatColor(color: Pick<ColorObject, 'parsedColor' | 'convertedColors'>, format: ColorFormat, options: { rounded?: boolean } = {}): string {
    const colors = color.convertedColors
    const alpha = color.parsedColor.alpha
    const suffix = alpha < 1 ? ` / ${decimal(alpha, 6)}` : ''
    const channel = (value: number, precisePlaces = 5, roundedPlaces = 0) => decimal(value, options.rounded ? roundedPlaces : precisePlaces)
    switch (format) {
        case 'hex': return colors.hex as string
        case 'rgb': {
            const { r, g, b } = colors.rgb as RGBColor
            return `rgb(${channel(r)} ${channel(g)} ${channel(b)}${suffix})`
        }
        case 'hsl': {
            const { h, s, l } = colors.hsl as HSLColor
            return `hsl(${channel(h)} ${channel(s)}% ${channel(l)}%${suffix})`
        }
        case 'hwb': {
            const { h, w, b } = colors.hwb as HWBColor
            return `hwb(${channel(h)} ${channel(w)}% ${channel(b)}%${suffix})`
        }
        case 'oklch': case 'lch': {
            const { l, c, h } = colors[format] as OKLCHColor | LCHColor
            // Normalized OKLCH channels need decimals — whole-number rounding would erase dark colors.
            const places = format === 'oklch' ? 4 : 2
            return `${format}(${channel(l, 7, places)} ${channel(c, 7, places)} ${channel(h, 5, 1)}${suffix})`
        }
        case 'oklab': case 'lab': {
            const { l, a, b } = colors[format] as OKLabColor | LabColor
            const places = format === 'oklab' ? 4 : 2
            return `${format}(${channel(l, 7, places)} ${channel(a, 7, places)} ${channel(b, 7, places)}${suffix})`
        }
        case 'cmyk': {
            const { c, m, y, k } = colors.cmyk as CMYKColor
            return `cmyk(${channel(c)}% ${channel(m)}% ${channel(y)}% ${channel(k)}%${suffix})`
        }
    }
}
