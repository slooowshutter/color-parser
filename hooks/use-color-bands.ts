'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { parseColors } from '@/lib/build-color-object'
import { colorInputsFromPath, colorInputsToPath } from '@/lib/color-url'
import type { ColorObject } from '@/lib/types'

export interface ColorPanelState {
    id: string
    rawInput: string
    originalInput: string
    colorObjects: ColorObject[]
    previewColor?: ColorObject
    showMore: boolean
}

const DEFAULT_INPUT = '#010f1d'
const newPanelId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

function panelsFromInputs(inputs: string[]): ColorPanelState[] {
    return inputs.flatMap((rawInput, index) => {
        const colors = parseColors(rawInput)
        return (colors.length > 1 ? colors.map(color => color.token.raw) : [rawInput]).map((value, colorIndex) => {
            const colorObjects = colors.length > 1 ? [colors[colorIndex]] : colors
            return { id: `panel-${index}-${colorIndex}`, rawInput: value, originalInput: value,
                colorObjects, previewColor: colorObjects[0], showMore: false }
        })
    })
}

/** Keeps editable bands in sync with share URLs while grouping continuous typing into one history entry. */
export function useColorBands() {
    const pathname = usePathname()
    const [colorPanels, setColorPanels] = useState(() => panelsFromInputs(colorInputsFromPath(pathname) ?? [DEFAULT_INPUT]))
    const [isReadingClipboard, setIsReadingClipboard] = useState(pathname === '/')
    const panelsRef = useRef(colorPanels)
    const knownPath = useRef(pathname)
    const revision = useRef(0)
    const mounted = useRef(false)
    const editGroup = useRef<string | undefined>(undefined)
    const editTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const finishEditing = useCallback(() => {
        clearTimeout(editTimer.current)
        editGroup.current = undefined
    }, [])

    const commitPanels = useCallback((panels: ColorPanelState[], mode: 'push' | 'replace' | 'edit' = 'push', editId?: string) => {
        revision.current++
        panelsRef.current = panels
        setColorPanels(panels)
        const path = colorInputsToPath(panels.map(panel => panel.rawInput))
        const replace = mode === 'replace' || (mode === 'edit' && editGroup.current === editId)
        if (mode === 'edit') {
            editGroup.current = editId
            clearTimeout(editTimer.current)
            editTimer.current = setTimeout(finishEditing, 600)
        } else finishEditing()
        // Updating the address through Next's History API integration preserves input focus.
        knownPath.current = path
        if (window.location.pathname !== path) {
            window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
        }
    }, [finishEditing])

    useEffect(() => {
        if (pathname === knownPath.current) return
        finishEditing()
        revision.current++
        knownPath.current = pathname
        const panels = panelsFromInputs(colorInputsFromPath(pathname) ?? [DEFAULT_INPUT])
        panelsRef.current = panels
        setColorPanels(panels)
        setIsReadingClipboard(false)
    }, [pathname, finishEditing])

    useEffect(() => {
        if (window.location.pathname !== '/') return
        let cancelled = false
        const initialRevision = revision.current
        async function readClipboard() {
            let input = DEFAULT_INPUT
            try {
                const clipboardText = await navigator.clipboard?.readText()
                if (clipboardText?.trim()) input = clipboardText.trim()
            } catch { /* Browsers may require an explicit paste gesture. */ }
            // A delayed permission response must not overwrite newer edits or navigation.
            if (!cancelled && revision.current === initialRevision) {
                commitPanels(panelsFromInputs([input]), 'replace')
                setIsReadingClipboard(false)
            }
        }
        void readClipboard()
        return () => { cancelled = true }
    }, [commitPanels])

    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false; finishEditing() }
    }, [finishEditing])

    const handleInputChange = useCallback((id: string, rawInput: string) => {
        const colors = parseColors(rawInput)
        const panels = panelsRef.current.flatMap(panel => {
            if (panel.id !== id) return [panel]
            if (colors.length > 1) {
                return colors.map(color => ({ id: newPanelId(), rawInput: color.token.raw, originalInput: color.token.raw,
                    colorObjects: [color], previewColor: color, showMore: panel.showMore }))
            }
            return [{ ...panel, rawInput, colorObjects: colors, previewColor: colors[0] ?? panel.previewColor }]
        })
        commitPanels(panels, 'edit', id)
    }, [commitPanels])

    const handleRevertPanel = useCallback((id: string) => {
        commitPanels(panelsRef.current.map(panel => {
            if (panel.id !== id) return panel
            const colorObjects = parseColors(panel.originalInput)
            return { ...panel, rawInput: panel.originalInput, colorObjects, previewColor: colorObjects[0] }
        }))
    }, [commitPanels])

    const handleAddPanel = useCallback(() => {
        commitPanels([...panelsRef.current, { ...panelsFromInputs([DEFAULT_INPUT])[0], id: newPanelId() }])
    }, [commitPanels])

    const handleReset = useCallback(() => commitPanels(panelsFromInputs([DEFAULT_INPUT])), [commitPanels])

    const handleShowMoreToggle = useCallback((id: string) => {
        const panels = panelsRef.current.map(panel => panel.id === id ? { ...panel, showMore: !panel.showMore } : panel)
        panelsRef.current = panels
        setColorPanels(panels)
    }, [])

    const pasteColors = useCallback(async () => {
        const initialRevision = revision.current
        const initialPath = window.location.pathname
        const text = await navigator.clipboard.readText()
        if (mounted.current && revision.current === initialRevision && window.location.pathname === initialPath && text.trim()) {
            commitPanels(panelsFromInputs([text.trim()]))
        }
    }, [commitPanels])

    return { colorPanels, isReadingClipboard, handleInputChange, handleRevertPanel, handleAddPanel,
        handleReset, handleShowMoreToggle, pasteColors, finishEditing }
}
