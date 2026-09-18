/** A source occurrence with numeric conversions; repeated colors remain separate occurrences. */
export type ColorObject = {
    token: Token
    parsedColor: ParsedColor
    convertedColors: Record<ColorType, Color>
    /** The original color exceeds sRGB; RGB/hex previews use channel clipping. */
    outOfGamut?: boolean
}

export type ColorType = 'hsl' | 'rgb' | 'hex' | 'cmyk' | 'hwb' | 'oklab' | 'oklch' | 'lab' | 'lch'
export type Color = HSLColor | RGBColor | HexColor | CMYKColor | XYZColor | HSLAColor | RGBAColor | HWBColor | OKLabColor | OKLCHColor | LabColor | LCHColor

/** Hue is in degrees; saturation and lightness are percentages. */
export type HSLColor = { h: number; s: number; l: number }
export type HSLAColor = HSLColor & { a: number }
/** sRGB channels use the 0–255 scale and retain fractional precision. */
export type RGBColor = { r: number; g: number; b: number }
export type RGBAColor = RGBColor & { a: number }
export type HexColor = `#${string}`
/** Device-independent approximation — channels are percentages, without an ICC profile. */
export type CMYKColor = { c: number; m: number; y: number; k: number }
/** CIE XYZ D65, scaled so reference white has Y = 100. */
export type XYZColor = { x: number; y: number; z: number }
export type HWBColor = { h: number; w: number; b: number }
/** Oklab lightness is 0–1; a and b are chromatic axes, never opacity. */
export type OKLabColor = { l: number; a: number; b: number }
/** Lightness is 0–1, chroma is unbounded, hue is in degrees. */
export type OKLCHColor = { l: number; c: number; h: number }
/** CIE Lab D50 — lightness is 0–100; a and b are chromatic axes. */
export type LabColor = { l: number; a: number; b: number }
export type LCHColor = { l: number; c: number; h: number }
export type TokenType = ColorType | 'named' | 'css-variable'

/** Offsets are UTF-16 indices, end-exclusive; line and column are one-based. */
export interface Token {
    id: string
    type: TokenType
    raw: string
    startPosition: number
    endPosition: number
    line: number
    column?: number
    cssVariable?: string
}

/** Alpha is normalized to 0–1; missing CSS components resolve to zero outside interpolation. */
export type ParsedColor = {
    cssVariable?: string
    colorType: ColorType
    color: Color
    alpha: number
}
