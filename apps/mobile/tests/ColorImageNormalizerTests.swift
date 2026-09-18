import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

@main
struct ColorImageNormalizerTests {
  static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let srgb = CGColorSpace(name: CGColorSpace.sRGB)!

    let regular = try fixture(directory, "srgb", width: 2, height: 1, pixels: [255, 0, 0, 255, 20, 100, 240, 255], space: srgb)
    let regularImage = try normalize(regular)
    precondition(pixels(regularImage) == [255, 0, 0, 255, 20, 100, 240, 255], "sRGB bytes must not be converted twice")

    let p3 = try fixture(directory, "p3", width: 1, height: 1, pixels: [204, 102, 51, 255], space: CGColorSpace(name: CGColorSpace.displayP3)!)
    let converted = pixels(try normalize(p3))
    // W3C Display-P3 → XYZ D65 → sRGB reference conversion of (0.8, 0.4, 0.2)
    for (actual, expected) in zip(converted, [219, 94, 31, 255]) {
      precondition(abs(Int(actual) - expected) <= 2, "P3 must be converted, not merely relabeled as sRGB")
    }

    let rotated = try fixture(directory, "rotated", width: 2, height: 1, pixels: [255, 0, 0, 255, 0, 0, 255, 255], space: srgb, orientation: 6)
    let rotatedImage = try normalize(rotated)
    precondition(rotatedImage.width == 1 && rotatedImage.height == 2, "EXIF orientation must be baked into dimensions")
    precondition(pixels(rotatedImage) == [255, 0, 0, 255, 0, 0, 255, 255], "Rotating must preserve pixel order")

    let transparent = try fixture(directory, "alpha", width: 1, height: 1, pixels: [255, 0, 0, 128], space: srgb)
    let transparentImage = try normalize(transparent)
    precondition(pixels(transparentImage) == [128, 0, 0, 128], "Alpha must survive normalization")

    let large = try fixture(directory, "large", width: 4100, height: 4100, pixels: Array(repeating: 255, count: 4100 * 4100 * 4), space: srgb)
    let largeImage = try normalize(large)
    precondition(max(largeImage.width, largeImage.height) <= 4096 && largeImage.width * largeImage.height <= 12_000_000, "Image memory limit must apply to both edge length and area")

    do {
      _ = try ColorImageNormalizer.prepare(uri: "https://example.com/photo.png")
      preconditionFailure("Remote sources must be rejected")
    } catch {}
    do {
      try ColorImageNormalizer.release(uri: regular.absoluteString)
      preconditionFailure("Original images must never be deleted")
    } catch {}
    precondition(FileManager.default.fileExists(atPath: regular.path))
    print("Passed: sRGB identity, P3 conversion, EXIF rotation, alpha, large image cap, local-only sources, safe cache cleanup")
  }

  private static func normalize(_ source: URL) throws -> CGImage {
    let result = try ColorImageNormalizer.prepare(uri: source.absoluteString)
    let url = URL(string: result["uri"] as! String)!
    let decoded = CGImageSourceCreateWithURL(url as CFURL, nil)!
    let image = CGImageSourceCreateImageAtIndex(decoded, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)!
    precondition(result["colorSpace"] as? String == "sRGB")
    precondition(image.colorSpace?.name == CGColorSpace.sRGB)
    try ColorImageNormalizer.release(uri: url.absoluteString)
    precondition(!FileManager.default.fileExists(atPath: url.path), "Normalized files must be released")
    return image
  }

  private static func pixels(_ image: CGImage) -> [UInt8] {
    let context = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    return Array(UnsafeBufferPointer(start: context.data!.assumingMemoryBound(to: UInt8.self), count: image.width * image.height * 4))
  }

  private static func fixture(_ directory: URL, _ name: String, width: Int, height: Int, pixels: [UInt8], space: CGColorSpace, orientation: Int = 1) throws -> URL {
    let url = directory.appendingPathComponent(name).appendingPathExtension("png")
    let data = Data(pixels)
    let provider = CGDataProvider(data: data as CFData)!
    let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: space, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue), provider: provider, decode: nil, shouldInterpolate: false, intent: .relativeColorimetric)!
    let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, image, [kCGImagePropertyOrientation: orientation] as CFDictionary)
    precondition(CGImageDestinationFinalize(destination))
    return url
  }
}
