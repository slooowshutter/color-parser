# Adversarial parser test record

An independent test author created expected values and failing inputs; a separate implementation author repaired the parser. Expectations came from documented grammar, byte arithmetic, known colors, and published conversion matrices, not from copying the parser's output.

| Round | Tests | Passed | Failed |
| --- | ---: | ---: | ---: |
| Original parser (`0ece9ae`) | 98 | 38 | 60 |
| First repair, unchanged corpus | 98 | 98 | 0 |
| Generated and extended-format wave | 134 | 134 | 0 |
| New boundary attacks | 144 | 136 | 8 |
| Second repair plus format round trips | 145 | 145 | 0 |

The eight new failures exposed phantom named colors from JSON keys, two valid `!important` spellings being rejected, three non-CSS whitespace characters being accepted, and two unsupported escaped identifiers leaking partial colors. Each remains a regression test.

Run everything with `pnpm test`, or only this corpus:

```sh
pnpm exec tsx --test tests/parser.adversarial.test.ts
```

The 145 top-level tests contain 1,331 RGB/XYZ lattice points, all 256 alpha bytes, 512 independently calculated RGB fixtures (seed `0xc010a`), 40 malformed channel mutations, 800 corrupt strings plus five extreme numeric inputs (seed `0xbadc010`), and 54 format round trips. Seeds are fixed in the tests, so a rerun reproduces the same input sequence. Numeric tolerances are explicit; color bytes and extracted source spans are checked exactly.

This is regression coverage for the [documented subset](parser-contract.md), not proof of full CSS conformance. It does not cover cascade resolution, relative colors, interpolation, CSS escapes, arbitrary `color()` profiles, perceptual gamut mapping, or exhaustive Unicode syntax. The corrupt-input checks establish finite, ordered outputs for their corpus; they are not an exhaustive security or performance proof.

Primary references: [CSS Color 4 grammar](https://www.w3.org/TR/css-color-4/#color-syntax), [HSL conversion](https://www.w3.org/TR/css-color-4/#hsl-to-rgb), [color conversion matrices](https://www.w3.org/TR/css-color-4/#color-conversion-code), [CSS Syntax whitespace](https://www.w3.org/TR/css-syntax-3/#whitespace), and [important annotations](https://www.w3.org/TR/css-cascade-3/#importance).
