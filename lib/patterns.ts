/** Lexical atoms only — color grammar is validated in parser.ts. */
export const COMPONENT_PATTERNS = {
    numberValue: /^[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?$/i,
    percentageValue: /^[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?%$/i,
    hueWithUnit: /^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i,
} as const

/** Function aliases share the same argument grammar. */
export const COLOR_FUNCTIONS = {
    rgb: 'rgb', rgba: 'rgb', hsl: 'hsl', hsla: 'hsl', hwb: 'hwb',
    oklab: 'oklab', oklch: 'oklch', lab: 'lab', lch: 'lch', cmyk: 'cmyk',
} as const
