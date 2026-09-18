export type ImagePoint = { x: number; y: number };

/** Maps a displayed image position to a source pixel, including drags past its edges. */
export function imagePoint(
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
  imageWidth: number,
  imageHeight: number,
): ImagePoint {
  if (
    ![x, y, displayWidth, displayHeight, imageWidth, imageHeight].every(
      Number.isFinite,
    ) ||
    displayWidth <= 0 ||
    displayHeight <= 0 ||
    imageWidth < 1 ||
    imageHeight < 1
  ) {
    throw new RangeError(
      "Image and display dimensions must be finite and positive.",
    );
  }
  return {
    x: Math.max(
      0,
      Math.min(
        Math.floor(imageWidth) - 1,
        Math.floor((x / displayWidth) * imageWidth),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        Math.floor(imageHeight) - 1,
        Math.floor((y / displayHeight) * imageHeight),
      ),
    ),
  };
}

/** Bounds canvas memory on phones; callers disclose when sampling a resized image. */
export function samplingSize(width: number, height: number) {
  if (![width, height].every(Number.isFinite) || width < 1 || height < 1) {
    throw new RangeError("Image dimensions must be positive.");
  }
  const scale = Math.min(
    1,
    4096 / Math.max(width, height),
    Math.sqrt(12_000_000 / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}
