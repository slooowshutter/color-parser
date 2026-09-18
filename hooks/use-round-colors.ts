'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'color-parser.round-values'

/** One browser preference applies to every band and survives opening a different shared color. */
export function useRoundColors() {
    const [roundColors, setRoundColors] = useState(false)

    useEffect(() => {
        try { setRoundColors(localStorage.getItem(STORAGE_KEY) === 'true') } catch { /* Storage may be unavailable. */ }
        const syncPreference = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY || event.key === null) setRoundColors(event.newValue === 'true')
        }
        window.addEventListener('storage', syncPreference)
        return () => window.removeEventListener('storage', syncPreference)
    }, [])

    const toggleRounding = useCallback(() => {
        const nextValue = !roundColors
        setRoundColors(nextValue)
        try { localStorage.setItem(STORAGE_KEY, String(nextValue)) } catch { /* Keep the toggle usable for this visit. */ }
    }, [roundColors])

    return { roundColors, toggleRounding }
}
