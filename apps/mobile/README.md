# Color Studio for iPhone

An iOS app for taking or choosing a photo, dragging a large 12× pixel magnifier, and copying the selected color as HEX, RGB, HSL, HWB, OKLCH, OKLab, Lab, LCH, or CMYK. The text tab extracts colors from pasted text with the same parser as the website.

## Run

Requires macOS, Node.js 22.13 or newer, Xcode 26.4 or newer, and an installed iOS simulator. The app targets iOS 16.4 or newer. See the [Expo SDK 57 requirements](https://docs.expo.dev/versions/v57.0.0/).

From the repository root:

```sh
cd apps/mobile
npm ci
npm run ios
```

The first run generates the ignored `ios/` project, installs CocoaPods dependencies, builds the development app, and starts Metro. Subsequent JavaScript-only sessions can use `npm start` and open the installed Color Studio app.

To build onto a connected iPhone:

```sh
npm run ios:device
```

Select your iPhone when prompted. Device builds require Apple signing configured in Xcode and Developer Mode on the phone. Camera capture requires a physical iPhone; the simulator can exercise the photo library and parser.

**Use a development build, not Expo Go.** The app includes a local Swift image module for color-managed photo decoding, which Expo Go does not contain. Re-run `npm run ios` after changing native module code. Android is not implemented in this package; use the repository's Next.js app for the website.

## Photo accuracy and privacy

- `modules/color-image/ios/ColorImageNormalizer.swift` uses ImageIO to bake EXIF orientation into the pixels and CoreGraphics/ColorSync to convert embedded image profiles, including Display-P3, to an explicit 8-bit sRGB PNG. This conversion happens once, before sampling.
- `PhotoSampler.tsx` displays and samples that same image with Skia. Pixel reads request RGBA byte order and unpremultiplied alpha. The loupe uses nearest-neighbor scaling; arrows move by one source pixel.
- Images larger than 4096 pixels on an edge or 12 megapixels are reduced before rendering to bound memory. The app displays the sampling dimensions and indicates reduction. Sampled values describe this normalized image, not RAW sensor measurements. Colors outside sRGB are limited by the conversion to sRGB; CMYK is an unprofiled approximation, not a print proof.
- Original files are not changed. Normalized cache PNGs are released when a photo is replaced or the screen unmounts; native path validation prevents deleting originals. iOS can purge cache files after an interrupted session.
- Photos and pasted color text are processed on the device. There is no upload endpoint or account requirement. Development builds connect to your local Metro server to load app code.

## Shared engine

The app imports the dependency-free parser and formatters from `../../lib`, and shares the image-coordinate mapping with the website. `metro.config.js` watches that directory. This is a standalone npm package with its own lockfile; install it separately from the Next.js package.

## Verification

```sh
npm run typecheck
npm run check
npm run test:native
npm run bundle:ios
npm run ios
```

The native tests compile and exercise the real image normalizer on macOS: sRGB identity, a Display-P3 reference conversion, EXIF rotation and pixel order, transparency, the image memory limit, rejection of remote sources, and cache cleanup protection. The iOS development app compiled and ran on the iPhone 17 simulator. A known photo fixture verified exact color values, pixel nudging, and dragging without page scrolling; the text parser returned all three sample colors. Physical iPhone camera behavior has not been tested.

For a manual device check, capture a photo, choose a portrait HEIC and a transparent PNG, drag to image corners, use all four pixel arrows, copy each format, cancel a replacement photo, and deny camera permission. Check an embedded Display-P3 test image against its converted sRGB values.
