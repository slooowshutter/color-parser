import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

enum ColorImageNormalizer {
  /// Converts source profiles once, before the JavaScript sampler interprets the channels as sRGB.
  static func prepare(uri: String) throws -> [String: Any] {
    guard let sourceURL = URL(string: uri), sourceURL.isFileURL,
          let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let originalWidth = properties[kCGImagePropertyPixelWidth] as? Int,
          let originalHeight = properties[kCGImagePropertyPixelHeight] as? Int,
          originalWidth > 0, originalHeight > 0 else {
      throw failure("The selected photo could not be decoded.")
    }

    let longestEdge = Double(max(originalWidth, originalHeight))
    let pixelCount = Double(originalWidth) * Double(originalHeight)
    let scale = min(1, 4096 / longestEdge, sqrt(12_000_000 / pixelCount))
    let maximumSize = max(1, Int(floor(longestEdge * scale)))
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maximumSize,
      kCGImageSourceShouldCacheImmediately: true,
    ]

    // ImageIO applies EXIF orientation while downsampling, avoiding a full 48 MP bitmap allocation
    guard let oriented = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
          let srgb = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: nil,
            width: oriented.width,
            height: oriented.height,
            bitsPerComponent: 8,
            bytesPerRow: oriented.width * 4,
            space: srgb,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
          ) else {
      throw failure("The selected photo could not be converted to sRGB.")
    }

    // Drawing into an explicitly tagged context lets ColorSync handle P3 and other embedded ICC profiles
    context.setRenderingIntent(.relativeColorimetric)
    context.setBlendMode(.copy)
    context.draw(oriented, in: CGRect(x: 0, y: 0, width: oriented.width, height: oriented.height))

    guard let output = context.makeImage() else {
      throw failure("The normalized image could not be created.")
    }
    let directory = try cacheDirectory()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let outputURL = directory.appendingPathComponent("\(UUID().uuidString).png")

    guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
      throw failure("The normalized image could not be saved.")
    }
    CGImageDestinationAddImage(destination, output, nil)
    guard CGImageDestinationFinalize(destination) else {
      try? FileManager.default.removeItem(at: outputURL)
      throw failure("The normalized image could not be saved.")
    }

    return [
      "uri": outputURL.absoluteString,
      "width": output.width,
      "height": output.height,
      "resized": scale < 1,
      "colorSpace": "sRGB",
      "originalProfile": oriented.colorSpace?.name.map { $0 as String } ?? "Untagged RGB",
    ]
  }

  /// Only UUID PNGs created in this module's cache can be removed; original photos are never writable here.
  static func release(uri: String) throws {
    guard let url = URL(string: uri)?.standardizedFileURL,
          url.isFileURL,
          url.deletingLastPathComponent() == (try cacheDirectory()).standardizedFileURL,
          url.pathExtension == "png",
          UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil else {
      throw failure("Only normalized photo cache files can be released.")
    }
    if FileManager.default.fileExists(atPath: url.path) {
      try FileManager.default.removeItem(at: url)
    }
  }

  private static func cacheDirectory() throws -> URL {
    guard let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      throw failure("The image cache is unavailable.")
    }
    return cache.appendingPathComponent("ColorLab", isDirectory: true)
  }

  private static func failure(_ message: String) -> NSError {
    NSError(domain: "ColorImage", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
