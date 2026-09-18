'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { ColorType, Color, ColorObject, RGBColor, ParsedColor, Token } from '@/lib/types'
import { formatColor } from '@/lib/format-color'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
} from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { ChevronDown } from 'lucide-react'

interface ColorPanelProps {
    id: string
    rawInput: string
    originalInput?: string
    parsedColor?: ParsedColor
    tokens?: Token[]
    convertedColors?: Record<ColorType, Color>
    previewColor?: ColorObject
    showMore: boolean
    roundColors: boolean
    onRoundingToggle: () => void
    onShowMoreToggle: (id: string) => void
    onInputChange: (id: string, value: string) => void
    onInputCommit?: () => void
    onRevert?: (id: string) => void
}

/** Displays an editable color band and its parsed color formats. */
export function ColorPanel({
    id,
    rawInput,
    originalInput,
    parsedColor,
    tokens = [],
    convertedColors,
    previewColor,
    showMore,
    roundColors,
    onRoundingToggle,
    onShowMoreToggle,
    onInputChange,
    onInputCommit,
    onRevert,
}: ColorPanelProps) {
    const [copySuccess, setCopySuccess] = useState('')
    useEffect(() => setCopySuccess(''), [rawInput, roundColors])
    const [showColorPicker, setShowColorPicker] = useState(false)
    const colorPickerRef = useRef<HTMLDivElement>(null)

    // Close color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setShowColorPicker(false)
            }
        }

        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showColorPicker])

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onInputChange(id, event.target.value)
    }

    const handleColorPickerChange = (color: string) => {
        onInputChange(id, color)
    }

    const handleRevert = () => {
        if (onRevert && originalInput) {
            onRevert(id)
        }
    }

    const color = parsedColor && convertedColors ? { parsedColor, convertedColors } : undefined
    const invalid = rawInput.trim().length > 0 && !color
    // Keep the background steady while typing, but never offer stale values to copy.
    const preview = color ?? previewColor
    const alpha = preview?.parsedColor.alpha ?? 1
    const isTransparent = alpha < 1
    const rgb = preview?.convertedColors.rgb as RGBColor | undefined ?? { r: 1, g: 15, b: 29 }
    const hex = preview?.convertedColors.hex as string | undefined ?? '#010f1d'
    // Match the browser's byte serialization so fractional channels hydrate consistently.
    const rgbBackground = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
    const textColorClass = brightness > 128 ? 'text-black' : 'text-white'
    const panelStyle: React.CSSProperties = !isTransparent
        ? { backgroundColor: rgbBackground }
        : { backgroundImage: `url('/transparent-bg.svg')`, backgroundSize: '20px 20px', backgroundRepeat: 'repeat' }

    const handleCopy = async (text: string, format: string) => {
        if (!text || text === '-') return
        try {
            await navigator.clipboard.writeText(text)
            setCopySuccess(`${format} copied!`)
            setTimeout(() => setCopySuccess(''), 1500)
        } catch (err) {
            console.error('Failed to copy: ', err)
            setCopySuccess('Copy failed')
            setTimeout(() => setCopySuccess(''), 1500)
        }
    }

    const formatOptions = { rounded: roundColors }
    const hslString = color ? formatColor(color, 'hsl', formatOptions) : '-'
    const rgbString = color ? formatColor(color, 'rgb', formatOptions) : '-'
    const hexString = color ? formatColor(color, 'hex') : '-'
    const cmykString = color ? formatColor(color, 'cmyk', formatOptions) : '-'
    const oklchString = color ? formatColor(color, 'oklch', formatOptions) : '-'

    return (
        <Card
            className="w-full h-full rounded-none border-0 p-4 min-w-[300px] relative"
            style={panelStyle}
        >
            {isTransparent && (
                <div
                    className="absolute inset-0"
                    style={{ backgroundColor: rgbBackground }}
                />
            )}
            {/* Using a wrapper to ensure content appears above the overlay */}
            <div className="relative">
                <div className="relative mb-4 ">
                    <div className="flex items-center gap-2">
                        <input
                        type="text"
                        aria-label="Color value"
                        aria-invalid={invalid}
                        aria-describedby={invalid ? `${id}-error` : undefined}
                        onBlur={onInputCommit}
                        onKeyDown={event => { if (event.key === 'Enter') onInputCommit?.() }}
                        value={rawInput}
                        onChange={handleInputChange}
                        placeholder="e.g., 60 9.1% 97.8%"
                        className={`w-full max-w-[200px] h-8 p-2 py-1 text-sm rounded-md border border-input bg-background/80 text-black focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
                    />
                    <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        aria-label="Open color picker"
                        className={`w-8 h-8 rounded-md border border-input bg-background/80 flex items-center justify-center hover:bg-background/90 transition-colors ${textColorClass}`}
                        style={{ backgroundColor: hex }}
                    >
                        <div className="w-4 h-4 rounded-sm border border-gray-300" style={{ backgroundColor: hex }} />
                    </button>
                    {onRevert && originalInput && rawInput !== originalInput && (
                        <button
                            onClick={handleRevert}
                            className={`w-8 h-8 rounded-md border border-input bg-background/80 flex items-center justify-center hover:bg-background/90 transition-colors ${textColorClass}`}
                            title="Revert to original color"
                        >
                            ↻
                        </button>
                    )}
                </div>
                {showColorPicker && (
                    <div 
                        ref={colorPickerRef}
                        className="absolute top-10 left-0 z-10 p-2 bg-white rounded-lg shadow-lg border border-gray-300"
                    >
                        <ColorPicker
                            value={hex}
                            onChange={handleColorPickerChange}
                        />
                    </div>
                )}
            </div>

            <CardContent className='px-0'>
                {invalid && (
                    <Alert id={`${id}-error`}>
                        <AlertTitle>No supported color found</AlertTitle>
                        <AlertDescription>Check the value and try again.</AlertDescription>
                    </Alert>
                )}
                {!rawInput.trim() && <p className={`text-sm ${textColorClass}`}>Enter a color to see its formats.</p>}
                {color && <div className={`space-y-1 font-mono text-xs ${textColorClass}`}>

                    <div className="mb-2 flex min-h-11 items-center gap-2">
                        {parsedColor?.cssVariable && <h3 className="min-w-0 truncate text-lg font-bold">{parsedColor.cssVariable}</h3>}
                        <Button
                            type="button"
                            variant={roundColors ? 'default' : 'secondary'}
                            className="w-28"
                            aria-label="Round color values"
                            aria-pressed={roundColors}
                            title="Round displayed and copied values. This preference is saved for all bands."
                            onClick={onRoundingToggle}
                        >
                            {roundColors ? 'Rounded' : 'Precise'}
                        </Button>
                    </div>
                    <div>
                        {isTransparent ? 'HSLA' : 'HSL'}:{' '}
                        <button type="button"
                            onClick={() => handleCopy(hslString, isTransparent ? 'HSLA' : 'HSL')}
                            className="inline-block cursor-pointer p-1 rounded bg-black/10 hover:bg-black/30 transition-colors"
                        >
                            {hslString}
                        </button>
                    </div>
                    <div>
                        {isTransparent ? 'RGBA' : 'RGB'}:{' '}
                        <button type="button"
                            onClick={() => handleCopy(rgbString, isTransparent ? 'RGBA' : 'RGB')}
                            className="inline-block cursor-pointer p-1 rounded bg-black/10 hover:bg-black/30 transition-colors"
                        >
                            {rgbString}
                        </button>
                    </div>
                    <div>
                        Hex:{' '}
                        <button type="button"
                            onClick={() => handleCopy(hexString, 'Hex')}
                            className="inline-block cursor-pointer p-1 rounded bg-black/10 hover:bg-black/30 transition-colors"
                        >
                            {hexString}
                        </button>
                    </div>
                    {showMore && color && (
                        <>
                            <div>
                                CMYK:{' '}
                                <button type="button"
                                    onClick={() => handleCopy(cmykString, 'CMYK')}
                                    className="inline-block cursor-pointer p-1 rounded bg-black/10 hover:bg-black/30 transition-colors"
                                >
                                    {cmykString}
                                </button>
                            </div>
                            <div>
                                OKLCH:{' '}
                                <button type="button"
                                    onClick={() => handleCopy(oklchString, 'OKLCH')}
                                    className="inline-block cursor-pointer p-1 rounded bg-black/10 hover:bg-black/30 transition-colors"
                                >
                                    {oklchString}
                                </button>
                            </div>
                        </>
                    )}
                    <button 
                        onClick={() => onShowMoreToggle(id)} 
                        className={`p-0 m-0 h-auto text-xs flex items-center gap-1 underline-offset-4 hover:underline ${textColorClass}`}
                    >
                        {showMore ? 'Show Less' : 'Show More'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                    </button>
                    {copySuccess && (
                        <div className="mt-2 text-xs p-1 bg-green-500/50 text-white rounded w-auto inline-block">
                            {copySuccess}
                        </div>
                    )}
                    
                    {/* Display tokenizer results */}
                    {tokens && tokens.length > 0 && (
                        <div className="mt-4 pt-2 border-t border-current/20">
                            <div className="text-xs font-bold mb-2">
                                🔍 Tokenizer ({tokens.length})
                            </div>
                            {tokens.map((token, index) => (
                                <div key={token.id || index} className="text-xs mb-1">
                                    <span className="opacity-70">
                                        [{token.type}]
                                    </span>{' '}
                                    {token.raw}
                                    <div className="ml-2 opacity-60">
                                        Position: {token.startPosition}-{token.endPosition}
                                    </div>
                                    <div className="ml-2 opacity-60">
                                        Line: {token.line}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>}
            </CardContent>
        </div>
        </Card>
    )
}
