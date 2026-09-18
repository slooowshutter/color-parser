const reservedPaths = new Set(['photo', 'test', '_next', 'favicon.ico', 'color-study.svg', 'transparent-bg.svg'])

/** Each band occupies one segment; quoting protects empty values and existing app routes. */
export function colorInputsToPath(inputs: readonly string[]): string {
    return '/' + inputs.map((input, index) => {
        const quote = !input || input.startsWith('"') || input === '.' || input === '..' || (index === 0 && reservedPaths.has(input))
        return encodeURIComponent(quote ? JSON.stringify(input) : input)
    }).join('/')
}

/** Decode once — percentages and encoded slashes belong to the color, not the route. */
export function colorInputsFromPath(pathname: string): string[] | null {
    if (pathname === '/') return null
    return pathname.slice(1).split('/').map(segment => {
        let value = segment
        try { value = decodeURIComponent(segment) } catch { /* Keep malformed links editable. */ }
        if (value.startsWith('"')) {
            try {
                const quoted: unknown = JSON.parse(value)
                if (typeof quoted === 'string') return quoted
            } catch { /* Unquoted input can itself contain quotes. */ }
        }
        return value
    })
}
