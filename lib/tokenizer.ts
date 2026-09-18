import { COLOR_FUNCTIONS } from './patterns'
import { NAMED_COLOR_HEX } from './named-colors'
import { parseColorValue, parseCustomPropertyValue } from './parser'
import type { Token, TokenType } from './types'

const isIdentifier = (char: string | undefined) => char !== undefined && /[\w\-\\\u0080-\uffff]/.test(char)
const gradients = new Set(['linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient'])

function commentEnd(text: string, position: number): number {
    const end = text.indexOf('*/', position + 2)
    return end === -1 ? text.length : end + 2
}

function quotedEnd(text: string, position: number): number {
    const quote = text[position]
    for (let index = position + 1; index < text.length; index++) {
        if (text[index] === '\\') index++
        else if (text[index] === quote) return index + 1
    }
    return text.length
}

function functionSpans(text: string): Map<number, number> {
    const ends = new Map<number, number>()
    const stack: number[] = []
    for (let index = 0; index < text.length; index++) {
        if (text.startsWith('/*', index)) index = commentEnd(text, index) - 1
        else if (text[index] === '"' || text[index] === "'") {
            const end = quotedEnd(text, index)
            const quotedStack: number[] = []
            // JSON palettes can contain color functions inside strings; their parentheses do not close an enclosing url()
            for (let inner = index + 1; inner < end - 1; inner++) {
                if (text[inner] === '\\') inner++
                else if (text[inner] === '(') quotedStack.push(inner)
                else if (text[inner] === ')') {
                    const start = quotedStack.pop()
                    if (start !== undefined) ends.set(start, inner + 1)
                }
            }
            index = end - 1
        }
        else if (text[index] === '(') stack.push(index)
        else if (text[index] === ')') {
            const start = stack.pop()
            if (start !== undefined) ends.set(start, index + 1)
        }
    }
    return ends
}

function declarationEnd(text: string, position: number, spans: Map<number, number>): number {
    for (let index = position; index < text.length; index++) {
        if (text.startsWith('/*', index)) index = commentEnd(text, index) - 1
        else if (text[index] === '"' || text[index] === "'") index = quotedEnd(text, index) - 1
        else if (text[index] === '(' && spans.has(index)) index = spans.get(index)! - 1
        else if (text[index] === ';' || text[index] === '}') return index
    }
    return text.length
}

/** A bounded scanner — balanced functions are consumed once, so invalid interiors cannot leak tokens. */
export class ColorTokenizer {
    private readonly tokens: Token[]

    constructor(private readonly text: string) {
        this.tokens = this.scan()
    }

    private scan(): Token[] {
        const tokens: Token[] = []
        const spans = functionSpans(this.text)
        const lineStarts = [0]
        for (let index = 0; index < this.text.length; index++) {
            if (this.text[index] === '\n') lineStarts.push(index + 1)
            else if (this.text[index] === '\r' && this.text[index + 1] !== '\n') lineStarts.push(index + 1)
        }
        const add = (start: number, end: number, type: TokenType, cssVariable?: string) => {
            let low = 0, high = lineStarts.length
            while (low + 1 < high) {
                const middle = Math.floor((low + high) / 2)
                if (lineStarts[middle] <= start) low = middle
                else high = middle
            }
            tokens.push({ id: `${start}:${end}:${type}`, type, raw: this.text.slice(start, end), startPosition: start,
                endPosition: end, line: low + 1, column: start - lineStarts[low] + 1, ...(cssVariable ? { cssVariable } : {}) })
        }
        let index = 0
        while (index < this.text.length) {
            if (this.text.startsWith('/*', index)) { index = commentEnd(this.text, index); continue }
            const start = index
            if (this.text[index] === '#') {
                index++
                while (isIdentifier(this.text[index])) index++
                const raw = this.text.slice(start, index)
                if (!isIdentifier(this.text[start - 1]) && this.text[start - 1] !== '#' && parseColorValue(raw)) {
                    add(start, index, 'hex')
                }
                continue
            }
            if (!isIdentifier(this.text[index])) { index++; continue }
            while (isIdentifier(this.text[index])) index++
            const word = this.text.slice(start, index)
            const name = word.toLowerCase()
            let next = index
            while (/\s/.test(this.text[next] ?? '') && next < this.text.length) next++
            if (word.startsWith('--') && word.length > 2 && this.text[next] === ':') {
                const end = declarationEnd(this.text, next + 1, spans)
                const value = this.text.slice(next + 1, end)
                const parsed = parseCustomPropertyValue(value)
                if (parsed) {
                    add(start, end - (value.length - value.trimEnd().length), 'css-variable')
                    index = end
                    continue
                }
                index = end
                continue
            }
            if (this.text[index] === '(') {
                const closedEnd = spans.get(index)
                const span = { end: closedEnd ?? declarationEnd(this.text, index + 1, spans), closed: closedEnd !== undefined }
                // Gradients are containers, while expressions such as var()/color-mix() need a resolver
                if (span.closed && gradients.has(name)) { index++; continue }
                if (span.closed && Object.hasOwn(COLOR_FUNCTIONS, name) && parseColorValue(this.text.slice(start, span.end))) {
                    add(start, span.end, COLOR_FUNCTIONS[name as keyof typeof COLOR_FUNCTIONS])
                }
                index = span.end
                continue
            }
            if (name === 'transparent' || Object.hasOwn(NAMED_COLOR_HEX, name)) {
                // A named property or JSON key is not itself its value
                let afterKey = next
                if (this.text[afterKey] === '"' || this.text[afterKey] === "'") {
                    afterKey++
                    while (afterKey < this.text.length && /\s/.test(this.text[afterKey])) afterKey++
                }
                if (this.text[afterKey] !== ':' && this.text[next] !== '(' && this.text[start - 1] !== '#') {
                    add(start, index, 'named')
                }
            }
        }
        return tokens
    }

    /** Return fresh token objects so callers cannot mutate scanner state. */
    getTokens(): Token[] { return this.tokens.map(token => ({ ...token })) }
    getTokensByType(type: TokenType): Token[] { return this.getTokens().filter(token => token.type === type) }
    getText(): string { return this.text }
}
