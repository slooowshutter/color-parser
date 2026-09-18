import { ColorTokenizer } from './tokenizer'
import { parseToken } from './parser'
import { colorToXyz, convertToAllFormats, xyzToUnclippedRgb } from './converter'
import type { ColorObject } from './types'

/** Pure synchronous engine shared by the website and native app; invalid occurrences are omitted. */
export function parseColors(value: string): ColorObject[] {
    const objects: ColorObject[] = []
    for (const token of new ColorTokenizer(value).getTokens()) {
        const parsedColor = parseToken(token)
        if (!parsedColor) continue
        const convertedColors = convertToAllFormats(parsedColor)
        const rawRgb = xyzToUnclippedRgb(colorToXyz(parsedColor))
        // Extremely large finite source values can overflow conversion matrices
        if (Object.values(convertedColors).some(color => typeof color !== 'string' && Object.values(color).some(channel => !Number.isFinite(channel)))) continue
        const outOfGamut = Object.values(rawRgb).some(channel => channel < -1e-4 || channel > 255.0001)
        objects.push({ token, parsedColor, convertedColors, outOfGamut })
    }
    return objects
}

/** Compatibility entry point for existing asynchronous callers. */
export async function buildColorObject(value: string): Promise<ColorObject[]> { return parseColors(value) }
