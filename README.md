# Color Parser

Clipboard color bands, a photo color picker, and a shared TypeScript color parser, with a Next.js website and an Expo iOS app.

## Website

The home screen keeps the original full-height color bands arranged side by side. It reads your clipboard on open when permitted; pasting several colors into a band creates one band per color. The photo picker is a separate `/photo` view, available from the image button.

Each entered value is saved in the URL, for example `/%23ff0000` for `#ff0000`, with one encoded path segment per band. Use **Copy share link** or copy the address bar to share the full set of bands. Shared links and reloads restore their values without reading the recipient's clipboard. Back and Forward restore previous edits; continuous typing is grouped until a 600 ms pause, Enter, or leaving the field. Empty and reserved values are quoted in the path so they cannot collide with `/photo` or `/test`.

An unsupported value shows an error and clears its format outputs. The band background stays on the previous color while editing, but that preview cannot be copied as a conversion of invalid input. All format copy buttons use the shared formatter, including its higher-precision OKLCH output.

The **Precise / Rounded** button above each band's formats switches display and copy precision for every band. The preference persists in local storage and follows you across shared links and reloads. Precise is the default; Rounded uses whole RGB/HSL/CMYK channels and shorter decimals for perceptual formats. Opacity, the underlying color, and the share URL stay unchanged.

```sh
pnpm install
pnpm dev
```

Open the URL printed by Next.js. Photos and pasted text are processed on the device; no image upload service or color API is required.

In the photo picker at `/photo`:

- Open an image, take a photo on a supported phone browser, or drop an image onto the canvas.
- Drag to sample pixels with a large magnifier. Focus the image and use arrow keys to move one pixel; Shift moves ten.
- Inspect and copy HEX, RGB, HSL, HWB, OKLCH, OKLab, Lab, LCH, and CMYK.
- Switch to **From text** to extract colors from CSS, JSON palettes, or snippets, with source line numbers and custom property names.
- Save colors to a local palette, copy HEX JSON, or download it. Palettes persist in this browser.

The image canvas uses browser-decoded sRGB values. Images over 4,096 pixels on an edge or 12 megapixels are resized for phone memory limits; the displayed dimensions indicate the sampling resolution. Images must be under 30 MB. HEIC support depends on the browser; JPEG and PNG are portable alternatives. Clipboard buttons require a browser context that allows clipboard access; direct paste and JSON download remain available.

Saved palettes use HEX, so transparency is quantized to an alpha byte and out-of-sRGB colors use the displayed clipped approximation. The current color inspector preserves the original perceptual color values until a saved HEX color is selected. CMYK is a mathematical approximation without a printer profile.

## iOS

The app lives in [`apps/mobile`](apps/mobile/README.md) and imports the same parser and converter. See its README for installation, simulator/device commands, and native image normalization details. App Store signing and distribution are separate from local development.

## Shared parser

```ts
import { parseColors } from './lib/build-color-object'
import { formatColor } from './lib/format-color'

const colors = parseColors('--brand: oklch(72% 0.09 310 / 80%); #ff8800')
const hex = colors.map(color => formatColor(color, 'hex'))
```

`parseColors` is synchronous and independent of React, DOM, Node, or a server. The previous asynchronous `buildColorObject` entry point remains available. Invalid colors are omitted; source occurrences retain deterministic IDs, exact UTF-16 offsets, line numbers, and CSS custom property names. Conversion math keeps fractional precision until formatting and identifies out-of-sRGB colors.

This is a literal-color parser, not a complete CSS evaluator. `var()`, `calc()`, `color()`, relative colors, `color-mix()`, system colors, and CSS escapes are unsupported. See the [parser contract](docs/parser-contract.md) for grammar, extraction policy, and conversion limits.

## Verification

```sh
pnpm test                       # Parser adversarial corpus + image coordinate tests
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:browser               # Desktop + phone viewport checks in Chromium and WebKit
```

The parser was hardened by separate adversarial-test and implementation agents. The original engine failed 60 of the initial 98 tests. A second attack wave found eight additional bugs; the final independent corpus has 145 passing tests, including seeded generated cases. The [test record](docs/parser-testing.md) documents the red/green rounds and coverage limits.

Browser checks cover the original clipboard-to-bands home screen, editing and splitting bands, reset, transparent-color export, and navigation to the separate photo picker. They also exercise real PNG upload and sampling, pointer dragging, keyboard movement, transparency, malformed-image recovery, tab retention, modern text parsing, clipboard formats, palette persistence, and viewport overflow. Phone viewport tests run in Chromium and WebKit; seeded clipboard reads run in Chromium because WebKit automation does not provide those permissions. These do not substitute for testing on a physical iPhone.
