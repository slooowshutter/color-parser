import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { AlphaType, Canvas, Circle, ColorType, FilterMode, Image, MipmapMode, Skia, type SkImage } from '@shopify/react-native-skia';
import { imagePoint, type ImagePoint } from '../../lib/image-sampling';
import type { SamplingPhoto } from './photo';
import { theme } from './theme';

/** Byte channels are unpremultiplied so transparent pixels retain their actual RGB value. */
export type PixelSample = { r: number; g: number; b: number; alpha: number };

type Props = {
  photo: SamplingPhoto;
  onSample: (sample: PixelSample) => void;
};

const HEIGHT = 340;
const LOUPE = 156;
const PIXEL_ZOOM = 12;
const nearest = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

export function PhotoSampler({ photo, onSample }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<SkImage | null>(null);
  const [width, setWidth] = useState(0);
  const [point, setPoint] = useState<ImagePoint>({ x: 0, y: 0 });
  const sourceWidth = image?.width() ?? photo.width;
  const sourceHeight = image?.height() ?? photo.height;
  const scale = Math.min(width / sourceWidth, HEIGHT / sourceHeight);
  const displayWidth = sourceWidth * scale;
  const displayHeight = sourceHeight * scale;
  const offsetX = (width - displayWidth) / 2;
  const offsetY = (HEIGHT - displayHeight) / 2;
  const cursorX = offsetX + (point.x + 0.5) * scale;
  const cursorY = offsetY + (point.y + 0.5) * scale;

  useEffect(() => {
    let active = true;
    void Skia.Data.fromURI(photo.uri).then((data) => {
      const decoded = Skia.Image.MakeImageFromEncoded(data);
      if (!decoded) throw new Error('Unsupported image');
      if (active) setImage(decoded);
    }).catch(() => {
      if (active) setError('This photo could not be decoded. Try a different image.');
    });
    return () => { active = false; };
  }, [photo.uri]);

  useEffect(() => {
    if (image) {
      setPoint({ x: Math.floor(image.width() / 2), y: Math.floor(image.height() / 2) });
    }
  }, [image]);

  useEffect(() => {
    if (!image) return;
    try {
      const bytes = image.readPixels(point.x, point.y, {
        width: 1,
        height: 1,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!bytes || bytes.length < 4) throw new Error('No pixels');
      onSample({ r: bytes[0], g: bytes[1], b: bytes[2], alpha: bytes[3] / 255 });
      setError(null);
    } catch {
      setError('The pixel could not be read. Try a different image.');
    }
  }, [image, point, onSample]);

  const updatePoint = useCallback((event: GestureResponderEvent) => {
    if (!image || displayWidth <= 0 || displayHeight <= 0) return;
    setPoint(imagePoint(
      event.nativeEvent.locationX - offsetX,
      event.nativeEvent.locationY - offsetY,
      displayWidth,
      displayHeight,
      sourceWidth,
      sourceHeight,
    ));
  }, [image, displayWidth, displayHeight, offsetX, offsetY, sourceWidth, sourceHeight]);

  function nudge(dx: number, dy: number) {
    setPoint((current) => ({
      x: Math.max(0, Math.min(sourceWidth - 1, current.x + dx)),
      y: Math.max(0, Math.min(sourceHeight - 1, current.y + dy)),
    }));
  }

  const loupeX = Math.max(8, Math.min(width - LOUPE - 8, cursorX - LOUPE / 2));
  const loupeY = cursorY > LOUPE + 36 ? cursorY - LOUPE - 28 : Math.min(HEIGHT - LOUPE - 8, cursorY + 28);

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.stage}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => Boolean(image)}
        onStartShouldSetResponderCapture={() => Boolean(image)}
        onMoveShouldSetResponder={() => Boolean(image)}
        onResponderGrant={updatePoint}
        onResponderMove={updatePoint}
        onResponderRelease={updatePoint}
        onResponderTerminationRequest={() => false}
        accessibilityLabel="Photo color picker. Drag on the image to select a pixel, or use the pixel arrow buttons below."
      >
        {image && width > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Canvas style={{ width, height: HEIGHT }}>
              <Image image={image} x={offsetX} y={offsetY} width={displayWidth} height={displayHeight} fit="fill" />
              <Circle cx={cursorX} cy={cursorY} r={10} color="white" style="stroke" strokeWidth={3} />
              <Circle cx={cursorX} cy={cursorY} r={13} color="#163A32" style="stroke" strokeWidth={1} />
            </Canvas>
            <View style={[styles.loupe, { left: loupeX, top: loupeY }]}>
              <Canvas style={{ width: LOUPE, height: LOUPE }}>
                <Image
                  image={image}
                  x={LOUPE / 2 - (point.x + 0.5) * PIXEL_ZOOM}
                  y={LOUPE / 2 - (point.y + 0.5) * PIXEL_ZOOM}
                  width={sourceWidth * PIXEL_ZOOM}
                  height={sourceHeight * PIXEL_ZOOM}
                  fit="fill"
                  sampling={nearest}
                />
              </Canvas>
              <View style={styles.loupeRing} />
              <View style={styles.crosshairOuter}><View style={styles.crosshairInner} /></View>
              <View style={styles.zoomBadge}><Text style={styles.zoomText}>12×</Text></View>
            </View>
          </View>
        ) : (
          <View style={styles.loading}>
            {!error ? <ActivityIndicator color={theme.accent} /> : null}
            <Text style={styles.loadingText}>{error ?? 'Opening your photo…'}</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.coordinate}>
          <Text style={styles.coordinateTitle}>PIXEL</Text>
          <Text style={styles.coordinateValue}>{point.x + 1}, {point.y + 1}</Text>
        </View>
        {[
          { label: 'left', symbol: '←', dx: -1, dy: 0 },
          { label: 'up', symbol: '↑', dx: 0, dy: -1 },
          { label: 'down', symbol: '↓', dx: 0, dy: 1 },
          { label: 'right', symbol: '→', dx: 1, dy: 0 },
        ].map(({ label, symbol, dx, dy }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Move one pixel ${label}`}
            disabled={!image}
            onPress={() => nudge(dx, dy)}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          ><Text style={styles.arrowText}>{symbol}</Text></Pressable>
        ))}
      </View>
      {error && image ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.help}>
        Drag to explore. Arrows move one pixel. {sourceWidth} × {sourceHeight} · sRGB{photo.resized ? ' · reduced for memory' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  stage: { height: HEIGHT, backgroundColor: '#253A32', overflow: 'hidden', borderRadius: 24 },
  loupe: { position: 'absolute', width: LOUPE, height: LOUPE, borderRadius: LOUPE / 2, overflow: 'hidden', backgroundColor: '#EDF0E8' },
  loupeRing: { ...StyleSheet.absoluteFill, borderWidth: 3, borderColor: 'white', borderRadius: LOUPE / 2 },
  crosshairOuter: { position: 'absolute', left: LOUPE / 2 - PIXEL_ZOOM / 2 - 1, top: LOUPE / 2 - PIXEL_ZOOM / 2 - 1, width: PIXEL_ZOOM + 2, height: PIXEL_ZOOM + 2, borderWidth: 1, borderColor: 'black' },
  crosshairInner: { width: PIXEL_ZOOM, height: PIXEL_ZOOM, borderWidth: 1, borderColor: 'white' },
  zoomBadge: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: '#163A32DF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  zoomText: { color: 'white', fontSize: 11, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coordinate: { flex: 1, gap: 3 },
  coordinateTitle: { fontSize: 9, letterSpacing: 1, fontWeight: '700', color: theme.secondary },
  coordinateValue: { color: theme.ink, fontVariant: ['tabular-nums'], fontSize: 13 },
  arrow: { minWidth: 44, minHeight: 44, borderRadius: 14, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center' },
  arrowText: { fontSize: 22, color: theme.ink },
  help: { color: theme.secondary, fontSize: 11, lineHeight: 16 },
  error: { color: theme.error, fontSize: 13 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 12 },
  loadingText: { color: 'white', fontSize: 13, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
