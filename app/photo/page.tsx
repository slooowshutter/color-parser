"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDownToLine,
  Braces,
  Clipboard,
  ImageIcon,
  Pipette,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ColorInspector } from "@/components/ColorInspector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { parseColors } from "@/lib/build-color-object";
import { formatColor } from "@/lib/format-color";
import type { ColorObject } from "@/lib/types";

const EXAMPLE = `/* A little of everything. Make it your own. */
--sunset: #f5a66c;
--moss: hsl(85deg 19% 47%);
--orchid: oklch(72% 0.09 310);
--ink: rgb(37 63 103 / 90%);
--soft: lab(85% 14 9);
rebeccapurple`;
const STORAGE_KEY = "color-studio.palette.v1";
const DEFAULT_COLOR = parseColors("#f5a66c")[0];

/** Samples photo colors and inspects their formats in a separate workspace. */
export default function PhotoStudio() {
  const [tab, setTab] = useState("photo");
  const [input, setInput] = useState(EXAMPLE);
  const deferredInput = useDeferredValue(input);
  const textColors = useMemo(() => parseColors(deferredInput), [deferredInput]);
  const [textIndex, setTextIndex] = useState(0);
  const [photoColor, setPhotoColor] = useState<ColorObject>(DEFAULT_COLOR);
  const [savedSelection, setSavedSelection] = useState<ColorObject | null>(
    null,
  );
  const [palette, setPalette] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const activeColor =
    savedSelection ??
    (tab === "photo" ? photoColor : (textColors[textIndex] ?? textColors[0]));

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]",
      );
      if (Array.isArray(saved))
        setPalette(
          saved
            .filter(
              (value): value is string =>
                typeof value === "string" &&
                /^#[\da-f]{6}([\da-f]{2})?$/i.test(value),
            )
            .slice(0, 100),
        );
    } catch {
      /* The picker remains usable when browser storage is unavailable. */
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
    } catch {
      /* A private session can still keep a palette in memory. */
    }
  }, [palette, storageReady]);

  const pickPhoto = useCallback((value: string) => {
    const color = parseColors(value)[0];
    if (color) {
      setPhotoColor(color);
      setSavedSelection(null);
    }
  }, []);

  function saveColor() {
    if (!activeColor) return;
    const value = formatColor(activeColor, "hex");
    if (palette.includes(value)) {
      toast("Already in your palette");
      return;
    }
    if (palette.length >= 100) {
      toast("Your palette is full. Remove a color to add another.");
      return;
    }
    setPalette((previous) => [...previous, value]);
    toast.success("Color saved");
  }

  async function pasteText() {
    try {
      const value = await navigator.clipboard.readText();
      if (value.length > 100_000) {
        toast.error("Paste up to 100,000 characters at a time.");
        return;
      }
      setInput(value);
      setTextIndex(0);
      setSavedSelection(null);
    } catch {
      toast.error(
        "Clipboard access is unavailable. Paste directly into the text box.",
      );
    }
  }

  async function exportPalette() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(palette, null, 2));
      toast.success("Palette copied as HEX JSON");
    } catch {
      toast.error("Could not copy the palette. Try the download button.");
    }
  }

  function downloadPalette() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(palette, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "color-palette.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="photo-studio-page"><div className="studio-shell">
      <header className="site-header">
        <Link href="/" className="wordmark" aria-label="Color Studio home">
          <span className="brand-mark">
            <Pipette size={20} />
          </span>
          color<span className="wordmark-light">studio</span>
          <span className="brand-dot">.</span>
        </Link>
        <Link className="header-link" href="/">← Color bands</Link>
        <a className="header-link" href="#palette">
          Your palette <span>{palette.length}</span>
        </a>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">NOTICE IT. PICK IT. MAKE IT YOURS.</p>
            <h1>
              Good colors are <span>everywhere.</span>
            </h1>
            <p>
              Find one in a photo. Untangle one from code. Get every value you
              need.
            </p>
          </div>
          <div className="intro-swatches" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        </section>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setSavedSelection(null);
          }}
        >
          <div className="studio-grid">
            <section className="workspace">
              <div className="workspace-heading">
                <TabsList aria-label="Color source">
                  <TabsTrigger value="photo">
                    <ImageIcon />
                    From a photo
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <Braces />
                    From text
                  </TabsTrigger>
                </TabsList>
                <span className="local-indicator">
                  <i />
                  All on your device
                </span>
              </div>
              <TabsContent value="photo" forceMount hidden={tab !== "photo"}>
                <PhotoPicker onPick={pickPhoto} />
              </TabsContent>
              <TabsContent value="text" forceMount hidden={tab !== "text"}>
                <div className="text-workspace">
                  <div className="workspace-toolbar">
                    <h2>Let’s find your colors.</h2>
                    <Button variant="outline" onClick={pasteText}>
                      <Clipboard data-icon="inline-start" />
                      Paste
                    </Button>
                  </div>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="color-input">
                        Colors, CSS, or a whole messy snippet
                      </FieldLabel>
                      <Textarea
                        id="color-input"
                        value={input}
                        spellCheck={false}
                        maxLength={100_000}
                        className="color-source"
                        onChange={(event) => {
                          setInput(event.target.value);
                          setTextIndex(0);
                          setSavedSelection(null);
                        }}
                        placeholder="#f5a66c · rgb(37 63 103 / 90%) · oklch(72% 0.09 310)"
                      />
                      <FieldDescription>
                        HEX, RGB, HSL, HWB, OKLab, OKLCH, Lab, LCH, CMYK, and
                        CSS names. Invalid values are skipped.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                  <div className="results-heading">
                    <span role="status">
                      {textColors.length}{" "}
                      {textColors.length === 1 ? "color" : "colors"} found
                      {deferredInput !== input ? " · updating…" : ""}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setInput(EXAMPLE);
                        setTextIndex(0);
                        setSavedSelection(null);
                      }}
                    >
                      Try an example
                    </Button>
                  </div>
                  {textColors.length ? (
                    <div className="parsed-colors">
                      {textColors.slice(0, 300).map((color, index) => (
                        <button
                          type="button"
                          className="parsed-color"
                          key={color.token.id}
                          aria-pressed={
                            !savedSelection &&
                            index === Math.min(textIndex, textColors.length - 1)
                          }
                          onClick={() => {
                            setTextIndex(index);
                            setSavedSelection(null);
                          }}
                        >
                          <span className="parsed-color-swatch checkerboard">
                            <i
                              style={{
                                backgroundColor: formatColor(color, "rgb"),
                              }}
                            />
                          </span>
                          <span>
                            <strong>
                              {color.parsedColor.cssVariable
                                ? `--${color.parsedColor.cssVariable}`
                                : formatColor(color, "hex").toUpperCase()}
                            </strong>
                            <code>{color.token.raw}</code>
                          </span>
                          <span className="source-line">
                            L{color.token.line}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>
                          {input.trim()
                            ? "No colors found yet"
                            : "A blank canvas"}
                        </EmptyTitle>
                        <EmptyDescription>
                          Paste a color or CSS snippet above. Try #f5a66c or
                          rgb(245 166 108).
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  {textColors.length > 300 && (
                    <p className="privacy-note">
                      Showing the first 300 colors. Narrow the input to inspect
                      more.
                    </p>
                  )}
                  <p className="parser-footnote">
                    Literal colors only. Expressions such as var(), calc(),
                    color(), and color-mix() need context and are skipped.
                  </p>
                </div>
              </TabsContent>
            </section>
            {activeColor ? (
              <ColorInspector color={activeColor} onSave={saveColor} />
            ) : (
              <aside className="color-inspector">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Your next color goes here</EmptyTitle>
                    <EmptyDescription>
                      Choose a color from your image, text, or saved palette.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </aside>
            )}
          </div>
        </Tabs>
        <section
          className="palette-section"
          id="palette"
          aria-label="Saved palette"
        >
          <div className="palette-heading">
            <div>
              <p className="eyebrow">KEEP THE GOOD ONES</p>
              <h2>
                Your palette{" "}
                <span>{palette.length.toString().padStart(2, "0")}</span>
              </h2>
            </div>
            <div className="toolbar-actions">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear palette"
                disabled={!palette.length}
                onClick={() => {
                  const previous = palette;
                  setPalette([]);
                  setSavedSelection(null);
                  toast("Palette cleared", {
                    action: {
                      label: "Undo",
                      onClick: () => setPalette(previous),
                    },
                  });
                }}
              >
                <Trash2 />
              </Button>
              <Button
                variant="outline"
                disabled={!palette.length}
                onClick={exportPalette}
              >
                <Clipboard data-icon="inline-start" />
                Copy JSON
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={!palette.length}
                onClick={downloadPalette}
                aria-label="Download palette JSON"
              >
                <ArrowDownToLine />
              </Button>
            </div>
          </div>
          {palette.length ? (
            <div className="palette-grid">
              {palette.map((value) => (
                <div className="palette-card" key={value}>
                  <button
                    className="palette-select"
                    aria-label={`Inspect ${value}`}
                    onClick={() => setSavedSelection(parseColors(value)[0])}
                  >
                    <span className="palette-swatch checkerboard">
                      <i style={{ backgroundColor: value }} />
                    </span>
                    <code>{value.toUpperCase()}</code>
                  </button>
                  <Button
                    className="palette-remove"
                    variant="secondary"
                    size="icon"
                    aria-label={`Remove ${value}`}
                    onClick={() => {
                      setPalette((previous) =>
                        previous.filter((color) => color !== value),
                      );
                      if (
                        savedSelection &&
                        formatColor(savedSelection, "hex") === value
                      )
                        setSavedSelection(null);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="palette-empty">
              <div className="empty-swatches" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <p>
                A collection waiting to happen.
                <span>Pick a color, then save it here.</span>
              </p>
            </div>
          )}
        </section>
      </main>
      <footer>
        <span>Made for curious eyes.</span>
        <span>Pick precisely. Create freely.</span>
      </footer>
    </div></div>
  );
}
