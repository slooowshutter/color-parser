'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Clipboard, ImageIcon, Link2, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { ColorPanel } from '@/components/ColorPanel'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useColorBands, type ColorPanelState } from '@/hooks/use-color-bands'
import { useRoundColors } from '@/hooks/use-round-colors'
import type { RGBColor, HSLColor } from '@/lib/types'

/** The clipboard home screen and shared URLs use the same editable bands. */
export function ColorBands() {
    const { roundColors, toggleRounding } = useRoundColors()
    const { colorPanels, isReadingClipboard, handleInputChange, handleRevertPanel, handleAddPanel,
        handleReset, handleShowMoreToggle, pasteColors, finishEditing } = useColorBands()
    const panelsContainerRef = useRef<HTMLDivElement>(null)
    const previousCount = useRef(colorPanels.length)

    useEffect(() => {
        if (colorPanels.length > previousCount.current) {
            panelsContainerRef.current?.scrollTo({ left: panelsContainerRef.current.scrollWidth, behavior: 'smooth' })
        }
        previousCount.current = colorPanels.length
    }, [colorPanels.length])

    const handleCopyLink = async () => {
        finishEditing()
        try {
            await navigator.clipboard.writeText(window.location.href)
            toast.success('Link copied')
        } catch {
            toast.error('Could not copy. You can copy the link from the address bar.')
        }
    }

    return (
        <main className="color-bands-page relative min-h-screen w-full">
            {isReadingClipboard && (
                <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
                    <div className="text-white text-lg">Reading from clipboard...</div>
                </div>
            )}
            <div className="fixed top-4 right-4 z-10 flex flex-col gap-2">
                <Button variant="outline" size="icon" aria-label="Paste colors from clipboard" title="Paste colors from clipboard" onClick={async () => {
                    try {
                        await pasteColors()
                    } catch {
                        toast.error('Paste directly into a color band to read your colors.')
                    }
                }}><Clipboard /></Button>
                <Button variant="outline" size="icon" onClick={handleCopyLink} aria-label="Copy share link" title="Copy share link"><Link2 /></Button>
                <Button variant="outline" size="icon" asChild><Link href="/photo" aria-label="Photo picker" title="Photo picker"><ImageIcon /></Link></Button>
                <Button onClick={handleAddPanel} variant="outline" size="icon" title="Add empty panel" aria-label="Add empty panel">
                    <Plus className="h-4 w-4" />
                </Button>
                <Button onClick={handleReset} variant="outline" size="icon" title="Reset to single panel" aria-label="Reset to single panel">
                    <RotateCcw className="h-4 w-4" />
                </Button>
            </div>
            <div
                ref={panelsContainerRef}
                className="flex flex-row flex-grow min-h-screen w-full overflow-x-auto"
            >
                {colorPanels.map((panel) => {
                    const colorObject = panel.colorObjects[0]

                    return (
                        <div
                            key={panel.id}
                            data-testid="color-band"
                            className="flex-grow min-w-[300px]"
                            style={{ width: `${100 / colorPanels.length}%` }}
                        >
                            <ColorPanel
                                    id={panel.id}
                                    rawInput={panel.rawInput}
                                    originalInput={panel.originalInput}
                                    parsedColor={colorObject?.parsedColor}
                                    tokens={colorObject ? [colorObject.token] : []}
                                    convertedColors={colorObject?.convertedColors}
                                    showMore={panel.showMore || false}
                                    roundColors={roundColors}
                                    onRoundingToggle={toggleRounding}
                                    onShowMoreToggle={handleShowMoreToggle}
                                    previewColor={panel.previewColor}
                                    onInputChange={handleInputChange}
                                    onInputCommit={finishEditing}
                                    onRevert={handleRevertPanel}
                                />
                        </div>
                    )
                })}
            </div>
            <footer className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10 text-sm text-white mix-blend-difference">
                Developed by{' '}
                <a
                    href="https://marclamy.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                >
                    Marc
                </a>
                . Help improve it on{' '}
                <a
                    href="https://github.com/marclelamy/color-parser"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                >
                    GitHub
                </a>
                .
            </footer>
            <div className="fixed bottom-4 right-4 z-10">
                <ExportColorsDialog colorPanels={colorPanels} roundColors={roundColors} />
            </div>
        </main>
    )
}

function ExportColorsDialog({ colorPanels, roundColors }: { colorPanels: ColorPanelState[]; roundColors: boolean }) {
    const [format, setFormat] = useState("rgba")
    const [open, setOpen] = useState(false)

    const handleExport = async () => {
        const channel = (value: number) => roundColors ? Math.round(value) : value
        const colors = colorPanels.map(panel => {
            const colorObject = panel.colorObjects?.[0]
            if (!colorObject) return null

            const convertedColors = colorObject.convertedColors

            switch (format) {
                case 'rgba':
                    const rgb = convertedColors.rgb as RGBColor
                    return `rgba(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)}, ${colorObject.parsedColor.alpha ?? 1})`
                case 'hsla':
                    const hsl = convertedColors.hsl as HSLColor
                    return `hsla(${channel(hsl.h)}, ${channel(hsl.s)}%, ${channel(hsl.l)}%, ${colorObject.parsedColor.alpha ?? 1})`
                case 'hex':
                    return convertedColors.hex
                default:
                    const defaultRgb = convertedColors.rgb as RGBColor
                    return `rgba(${channel(defaultRgb.r)}, ${channel(defaultRgb.g)}, ${channel(defaultRgb.b)}, ${colorObject.parsedColor.alpha ?? 1})`
            }
        }).filter(Boolean)

        const json = JSON.stringify(colors, null, 2)
        try {
            await navigator.clipboard.writeText(json)
            setOpen(false)
            toast.success('Colors copied')
        } catch {
            toast.error('Could not copy. Please allow clipboard access and try again.')
        }
    }

    const exportOptions = (
        <RadioGroup defaultValue="rgba" onValueChange={setFormat} className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="rgba" id="r-rgba" />
                <Label htmlFor="r-rgba">RGBA</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="hsla" id="r-hsla" />
                <Label htmlFor="r-hsla">HSLA</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="hex" id="r-hex" />
                <Label htmlFor="r-hex">Hex</Label>
            </div>
        </RadioGroup>
    )

    return (
        <ResponsiveDialog
            open={open}
            setOpen={setOpen}
            title="Export Colors"
            description="Select a format and copy the JSON to your clipboard."
            trigger={<Button variant="outline">Export Colors</Button>}
            footer={<Button onClick={handleExport}>Copy to Clipboard</Button>}
        >
            {exportOptions}
        </ResponsiveDialog>
    )
}
