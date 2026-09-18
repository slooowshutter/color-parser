"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COLOR_FORMATS, formatColor } from "@/lib/format-color";
import type { ColorObject } from "@/lib/types";

export function ColorInspector({
  color,
  onSave,
}: {
  color: ColorObject;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState("");
  const hex = formatColor(color, "hex");
  const rgb = formatColor(color, "rgb");

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(""), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);

  async function copy(value: string, format: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(format);
    } catch {
      toast.error("Could not copy. Select the value and copy it manually.");
    }
  }

  return (
    <aside className="color-inspector" aria-label="Selected color">
      <div className="inspector-heading">
        <span className="eyebrow">THE COLOR</span>
        <span className="opacity-value">
          {Math.round((color.parsedColor.alpha ?? 1) * 100)}% opacity
        </span>
      </div>
      <div className="selected-swatch checkerboard">
        <div style={{ backgroundColor: rgb }} />
      </div>
      <div className="selected-color-heading">
        <h2>{hex.toUpperCase()}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy selected HEX"
          onClick={() => copy(hex, "headline")}
        >
          {copied === "headline" ? <Check /> : <Copy />}
        </Button>
      </div>
      <Button className="w-full" onClick={onSave}>
        <Plus data-icon="inline-start" />
        Save to palette
      </Button>
      <div className="format-heading">
        <h3>Every way to say it</h3>
        <span>{COLOR_FORMATS.length} formats</span>
      </div>
      <dl className="format-list">
        {COLOR_FORMATS.map((format) => {
          const value = formatColor(color, format);
          return (
            <div className="format-row" key={format}>
              <div>
                <dt>{format.toUpperCase()}</dt>
                <dd>
                  <code>{value}</code>
                </dd>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Copy ${format.toUpperCase()}`}
                onClick={() => copy(value, format)}
              >
                {copied === format ? <Check /> : <Copy />}
              </Button>
            </div>
          );
        })}
      </dl>
      {color.outOfGamut && (
        <p className="inspector-note">
          Outside sRGB. The preview and RGB/HEX values are clipped; perceptual
          formats preserve the original color.
        </p>
      )}
      <p className="inspector-note">
        CMYK is an approximation. Print output depends on your printer and color
        profile.
      </p>
      <span className="sr-only" role="status">
        {copied ? `${copied.toUpperCase()} copied` : ""}
      </span>
    </aside>
  );
}
