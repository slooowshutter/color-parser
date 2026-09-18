# Parser contract and adversarial testing

The parser is a local, deterministic color extractor for pasted text and CSS. It preserves source order, repeated occurrences, exact source spans (UTF-16 offsets, end exclusive), and one-based line numbers. A failed candidate must not hide a later valid color.

`parseColors(text)` is the synchronous engine shared by the website and iOS app. `buildColorObject(text)` keeps its asynchronous public API. Each result contains its source token, parsed channels and opacity, conversions, and an `outOfGamut` flag. `parseToken` also validates directly supplied tokens; callers do not have to trust that a token came from the tokenizer. `formatColor` serializes each of the nine output formats.

## Supported values

- Hex requires `#` and exactly 3, 4, 6, or 8 digits. Ordinary words and unprefixed numbers are never inferred to be hex.
- RGB/RGBA support comma or whitespace syntax, finite decimal and scientific notation, and percentages. Modern syntax permits mixed number/percentage channels; legacy RGB does not. Only one alpha component is allowed.
- HSL/HSLA and OKLCH support angle units and normalized hue. Zero opacity remains zero. Numeric opacity uses the 0–1 scale; percentages use 0–100%, with clipping outside those ranges.
- HWB, Oklab, Lab, and LCH complete the nine supported formats. Named CSS colors and `transparent` are accepted. Modern missing components (`none`) resolve to zero for standalone conversion; interpolation is outside this engine's scope.
- CMYK is an application extension: comma-separated values accept percentages, fractional 0–1 values, or percentage-scale numbers. Conversion is a generic screen approximation, not an ICC print proof.
- CSS custom properties preserve their name without `--`. A whole wrapped color or raw three-channel value is accepted; raw `h s% l%` means HSL and other raw triples mean RGB. Comments, multiline values, and `!important` annotations are supported. Invalid declaration values and unresolved references are skipped as a unit.
- Hex output includes an alpha byte when opacity is below one. Parsing preserves fractional channel precision before display rounding.

Absolute CSS syntax and channel semantics follow [CSS Color 4](https://www.w3.org/TR/css-color-4/#color-syntax), including its [RGB grammar](https://www.w3.org/TR/css-color-4/#rgb-functions), [alpha range](https://www.w3.org/TR/css-color-4/#alpha-value), [hue units](https://www.w3.org/TR/css-color-4/#hue-syntax), and [OKLCH percentage ranges](https://www.w3.org/TR/css-color-4/#ok-lab). The XYZ reference test uses the specification's [sRGB conversion matrix](https://www.w3.org/TR/css-color-4/#color-conversion-code).

## Extraction policy

This is an extractor with a documented subset, not a browser CSS cascade evaluator. Unresolved `var()`, relative colors, `calc()`, `color-mix()`, and unsupported function containers must not leak internal colors as though those were the resulting color. Malformed numeric suffixes and malformed hex literals are rejected whole. Unsupported syntax is not labelled invalid CSS.

Gradient containers expose their supported color stops. Quoted JSON color values are extracted, while property names are ignored. CSS comments do not contribute colors. CSS channel separators are limited to space, tab, line feed, carriage return, and form feed; visually similar Unicode spaces are not silently substituted. Escape-bearing identifiers are skipped because CSS escape decoding is not implemented.

Lab/LCH use D50 and Oklab/OKLCH use D65. Out-of-gamut values retain their source-space channels, while sRGB preview outputs use channel clipping and set `outOfGamut`. This is not perceptual CSS gamut mapping. Extremely large values whose conversions overflow are skipped rather than producing non-finite output.

Source text may contain many colors, so duplicate colors are retained. Token identity may differ across separate parsing runs; token content, position, parsed values, and conversions must remain deterministic. Byte conversion uses a half-channel rounding tolerance where matrix floating-point error is expected.

## Break / fix loop

Run `pnpm test` or `pnpm exec tsx --test tests/parser.adversarial.test.ts`.

The test author and implementation author have separate ownership. Expected values come from CSS grammar, simple independently calculable colors, and published conversion matrices. A regression is reduced to a stable fixture before the implementation changes; expected values are never copied from the implementation under test.

The recorded red/green rounds, deterministic seeds, and coverage limits are in [parser-testing.md](parser-testing.md).
