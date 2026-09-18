import type { Color, ColorType, ParsedColor, RGBColor, HSLColor, HWBColor, HexColor, CMYKColor, XYZColor, OKLabColor, OKLCHColor, LabColor, LCHColor } from './types'

const clamp = (value: number, max = 1) => Math.min(max, Math.max(0, value))
const degrees = (value: number) => ((value % 360) + 360) % 360
const snap = (value: number) => Math.abs(value) < 1e-10 ? 0 : Math.abs(value - 255) < 1e-9 ? 255 : value
const byte = (value: number) => Math.round(clamp(value, 255)).toString(16).padStart(2, '0')
const encode = (value: number) => Math.abs(value) <= 0.0031308 ? 12.92 * value : Math.sign(value) * (1.055 * Math.abs(value) ** (1 / 2.4) - 0.055)
const decode = (value: number) => Math.abs(value) <= 0.04045 ? value / 12.92 : Math.sign(value) * ((Math.abs(value) + 0.055) / 1.055) ** 2.4

function matrix(values: readonly number[], vector: readonly number[]): [number, number, number] {
    return [0, 3, 6].map(offset => values[offset] * vector[0] + values[offset + 1] * vector[1] + values[offset + 2] * vector[2]) as [number, number, number]
}

function hslToRgb({ h, s, l }: HSLColor): RGBColor {
    h = degrees(h); s /= 100; l /= 100
    const a = s * Math.min(l, 1 - l)
    const channel = (offset: number) => {
        const k = (offset + h / 30) % 12
        return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
    }
    return { r: channel(0), g: channel(8), b: channel(4) }
}

function rgbToHsl({ r, g, b }: RGBColor): HSLColor {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
    const l = (max + min) / 2
    if (delta < 1e-10) return { h: 0, s: 0, l: l * 100 }
    const h = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
    return { h: degrees(h * 60), s: delta / (1 - Math.abs(2 * l - 1)) * 100, l: l * 100 }
}

function hexToRgb(hex: HexColor): RGBColor {
    let digits = hex.slice(1)
    if (digits.length <= 4) digits = [...digits].map(char => char + char).join('')
    return { r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16) }
}

function hwbToRgb({ h, w, b }: HWBColor): RGBColor {
    w /= 100; b /= 100
    if (w + b >= 1) { const gray = w / (w + b) * 255; return { r: gray, g: gray, b: gray } }
    const rgb = hslToRgb({ h, s: 100, l: 50 })
    const channel = (value: number) => value * (1 - w - b) + w * 255
    return { r: channel(rgb.r), g: channel(rgb.g), b: channel(rgb.b) }
}

function rgbToCmyk({ r, g, b }: RGBColor): CMYKColor {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b)
    if (max === 0) return { c: 0, m: 0, y: 0, k: 100 }
    return { c: (1 - r / max) * 100, m: (1 - g / max) * 100, y: (1 - b / max) * 100, k: (1 - max) * 100 }
}

/** Uses D65 XYZ with Y = 100 and never quantizes intermediate channels. */
export function rgbToXyz(rgb: RGBColor): XYZColor {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(value => decode(value / 255))
    return { x: (r * 0.41239079926595934 + g * 0.357584339383878 + b * 0.1804807884018343) * 100,
        y: (r * 0.21263900587151027 + g * 0.715168678767756 + b * 0.07219231536073371) * 100,
        z: (r * 0.01933081871559182 + g * 0.11919477979462598 + b * 0.9505321522496607) * 100 }
}

/** Keeps extended sRGB channels so callers can detect gamut clipping. */
export function xyzToUnclippedRgb({ x, y, z }: XYZColor): RGBColor {
    x /= 100; y /= 100; z /= 100
    return { r: snap(encode(x * 3.2409699419045226 - y * 1.537383177570094 - z * 0.4986107602930034) * 255),
        g: snap(encode(-x * 0.9692436362808796 + y * 1.8759675015077202 + z * 0.04155505740717559) * 255),
        b: snap(encode(x * 0.05563007969699366 - y * 0.20397695888897652 + z * 1.0569715142428786) * 255) }
}

/** RGB display output clips to sRGB; fractional channels remain intact until serialization. */
export function xyzToRgb(xyz: XYZColor): RGBColor {
    const rgb = xyzToUnclippedRgb(xyz)
    return { r: clamp(rgb.r, 255), g: clamp(rgb.g, 255), b: clamp(rgb.b, 255) }
}
export function hslToXyz(hsl: HSLColor): XYZColor { return rgbToXyz(hslToRgb(hsl)) }
export function hexToXyz(hex: HexColor): XYZColor { return rgbToXyz(hexToRgb(hex)) }
/** An unprofiled CMYK approximation, suitable for inspection rather than print proofing. */
export function cmykToXyz({ c, m, y, k }: CMYKColor): XYZColor {
    return rgbToXyz({ r: 255 * (1 - c / 100) * (1 - k / 100), g: 255 * (1 - m / 100) * (1 - k / 100), b: 255 * (1 - y / 100) * (1 - k / 100) })
}
export function xyzToHsl(xyz: XYZColor): HSLColor { return rgbToHsl(xyzToRgb(xyz)) }
export function xyzToHex(xyz: XYZColor): HexColor {
    const { r, g, b } = xyzToRgb(xyz)
    return `#${byte(r)}${byte(g)}${byte(b)}`
}
export function xyzToCmyk(xyz: XYZColor): CMYKColor { return rgbToCmyk(xyzToRgb(xyz)) }

export function oklabToXyz({ l, a, b }: OKLabColor): XYZColor {
    const lms = [l + 0.3963377773761749 * a + 0.2158037573099136 * b,
        l - 0.1055613458156586 * a - 0.0638541728258133 * b,
        l - 0.0894841775298119 * a - 1.2914855480194092 * b].map(value => value ** 3)
    const [x, y, z] = matrix([1.2268798758459243, -0.5578149944602171, 0.2813910456659647,
        -0.0405757452148008, 1.1122868032803170, -0.0717110580655164,
        -0.0763729366746601, -0.4214933324022432, 1.5869240198367816], lms)
    return { x: x * 100, y: y * 100, z: z * 100 }
}

export function xyzToOklab({ x, y, z }: XYZColor): OKLabColor {
    const lms = matrix([0.8190224379967030, 0.3619062600528904, -0.1288737815209879,
        0.0329836539323885, 0.9292868615863434, 0.0361446663506424,
        0.0481771893596242, 0.2642395317527308, 0.6335478284694309], [x / 100, y / 100, z / 100]).map(Math.cbrt)
    const [l, a, b] = matrix([0.2104542553, 0.7936177850, -0.0040720468,
        1.9779984951, -2.4285922050, 0.4505937099,
        0.0259040371, 0.7827717662, -0.8086757660], lms)
    return { l, a, b }
}

function polar({ l, a, b }: LabColor | OKLabColor): LCHColor {
    const c = Math.hypot(a, b)
    return { l, c: c < 1e-7 ? 0 : c, h: c < 1e-7 ? 0 : degrees(Math.atan2(b, a) * 180 / Math.PI) }
}
function cartesian({ l, c, h }: LCHColor | OKLCHColor): LabColor {
    return { l, a: c * Math.cos(h * Math.PI / 180), b: c * Math.sin(h * Math.PI / 180) }
}
export function oklchToXyz(oklch: OKLCHColor): XYZColor { return oklabToXyz(cartesian(oklch)) }
export function xyzToOklch(xyz: XYZColor): OKLCHColor { return polar(xyzToOklab(xyz)) }

const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585]
const D65_TO_D50 = [1.0479297925449969, 0.022946870601609652, -0.05019226628920524,
    0.02962780877005599, 0.9904344267538799, -0.017073799063418826,
    -0.009243040646204504, 0.015055191490298152, 0.7518742814281371]
const D50_TO_D65 = [0.955473421488075, -0.02309845494876471, 0.06325924320057072,
    -0.0283697093338637, 1.0099953980813041, 0.021041441191917323,
    0.012314014864481998, -0.020507649298898964, 1.330365926242124]

/** Bradford adaptation is required because CSS Lab uses D50 and the conversion hub uses D65. */
export function labToXyz({ l, a, b }: LabColor): XYZColor {
    const f1 = (l + 16) / 116
    const f = [f1 + a / 500, f1, f1 - b / 200]
    const d50 = f.map((value, index) => (value ** 3 > 216 / 24389 ? value ** 3 : (116 * value - 16) / (24389 / 27)) * D50[index])
    const [x, y, z] = matrix(D50_TO_D65, d50)
    return { x: x * 100, y: y * 100, z: z * 100 }
}
export function xyzToLab({ x, y, z }: XYZColor): LabColor {
    const d50 = matrix(D65_TO_D50, [x / 100, y / 100, z / 100])
    const f = d50.map((value, index) => {
        const ratio = value / D50[index]
        return ratio > 216 / 24389 ? Math.cbrt(ratio) : ((24389 / 27) * ratio + 16) / 116
    })
    return { l: 116 * f[1] - 16, a: 500 * (f[0] - f[1]), b: 200 * (f[1] - f[2]) }
}
export function lchToXyz(lch: LCHColor): XYZColor { return labToXyz(cartesian(lch)) }
export function xyzToLch(xyz: XYZColor): LCHColor { return polar(xyzToLab(xyz)) }

/** Converts source coordinates before clipping, preserving out-of-gamut Lab and Oklab information. */
export function colorToXyz({ colorType, color }: ParsedColor): XYZColor {
    switch (colorType) {
        case 'hex': return hexToXyz(color as HexColor)
        case 'rgb': return rgbToXyz(color as RGBColor)
        case 'hsl': return hslToXyz(color as HSLColor)
        case 'hwb': return rgbToXyz(hwbToRgb(color as HWBColor))
        case 'cmyk': return cmykToXyz(color as CMYKColor)
        case 'oklab': return oklabToXyz(color as OKLabColor)
        case 'oklch': return oklchToXyz(color as OKLCHColor)
        case 'lab': return labToXyz(color as LabColor)
        case 'lch': return lchToXyz(color as LCHColor)
    }
}

/** Alpha stays separate for Lab axes; RGB/HSL retain their legacy optional a field. */
export function convertToAllFormats(parsedColor: ParsedColor): Record<ColorType, Color> {
    const xyz = colorToXyz(parsedColor)
    const rgb = parsedColor.colorType === 'rgb' ? { ...parsedColor.color as RGBColor } : xyzToRgb(xyz)
    const hsl = rgbToHsl(rgb)
    const alpha = clamp(parsedColor.alpha ?? 1)
    const colors: Record<ColorType, Color> = {
        rgb, hsl, hex: `#${byte(rgb.r)}${byte(rgb.g)}${byte(rgb.b)}${alpha < 1 ? byte(alpha * 255) : ''}`,
        cmyk: rgbToCmyk(rgb), hwb: { h: hsl.h, w: Math.min(rgb.r, rgb.g, rgb.b) / 255 * 100, b: (1 - Math.max(rgb.r, rgb.g, rgb.b) / 255) * 100 },
        oklab: xyzToOklab(xyz), oklch: xyzToOklch(xyz), lab: xyzToLab(xyz), lch: xyzToLch(xyz),
    }
    // Preserve authored precision and powerless hue in the originating space
    if (parsedColor.colorType !== 'hex') colors[parsedColor.colorType] = { ...parsedColor.color as Exclude<Color, string> }
    if (alpha < 1) {
        colors.rgb = { ...colors.rgb as RGBColor, a: alpha }
        colors.hsl = { ...colors.hsl as HSLColor, a: alpha }
    }
    return colors
}
