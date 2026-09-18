"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Camera, ImagePlus, Move, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  imagePoint,
  samplingSize,
  type ImagePoint,
} from "@/lib/image-sampling";

export function PhotoPicker({ onPick }: { onPick: (color: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lensRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const frame = useRef<number | null>(null);
  const selection = useRef<ImagePoint>({ x: 0, y: 0 });
  const onPickRef = useRef(onPick);
  const [photo, setPhoto] = useState({
    name: "Color study · sample image",
    width: 1200,
    height: 900,
    resized: false,
  });
  const [point, setPoint] = useState<ImagePoint>({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const sample = useCallback((next: ImagePoint) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    const lens = lensRef.current?.getContext("2d");
    if (!canvas || !context || !lens) return;
    const x = Math.max(0, Math.min(canvas.width - 1, next.x));
    const y = Math.max(0, Math.min(canvas.height - 1, next.y));
    const [r, g, b, alpha] = context.getImageData(x, y, 1, 1).data;
    selection.current = { x, y };
    setPoint({ x, y });
    lens.clearRect(0, 0, 180, 180);
    lens.imageSmoothingEnabled = false;
    // Drawing the full source with an offset preserves the crosshair at image edges.
    lens.drawImage(
      canvas,
      90 - (x + 0.5) * 12,
      90 - (y + 0.5) * 12,
      canvas.width * 12,
      canvas.height * 12,
    );
    onPickRef.current(`rgb(${r} ${g} ${b} / ${alpha / 255})`);
  }, []);

  const loadPhoto = useCallback(
    async (source: string, name: string) => {
      const request = ++generation.current;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      setLoading(true);
      setError("");
      try {
        const image = new Image();
        image.src = source;
        await image.decode();
        if (generation.current !== request) return;
        const size = samplingSize(image.naturalWidth, image.naturalHeight);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !context)
          throw new Error("Your browser could not open the image canvas.");
        canvas.width = size.width;
        canvas.height = size.height;
        context.drawImage(image, 0, 0, size.width, size.height);
        setPhoto({
          name,
          ...size,
          resized:
            size.width !== image.naturalWidth ||
            size.height !== image.naturalHeight,
        });
        setReady(true);
        sample({
          x: Math.floor(size.width * 0.4),
          y: Math.floor(size.height * 0.4),
        });
      } catch {
        if (generation.current === request)
          setError(
            "Could not read this image. Try a JPEG, PNG, WebP, or a HEIC supported by your browser.",
          );
      } finally {
        if (source.startsWith("blob:")) URL.revokeObjectURL(source);
        if (generation.current === request) setLoading(false);
      }
    },
    [sample],
  );

  useEffect(() => {
    void loadPhoto("/color-study.svg", "Color study · sample image");
    return () => {
      generation.current += 1;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [loadPhoto]);

  function openFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setError("Choose an image file to pick a color.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("Choose an image smaller than 30 MB.");
      return;
    }
    void loadPhoto(URL.createObjectURL(file), file.name);
  }

  function pickAt(event: PointerEvent<HTMLCanvasElement>) {
    if (!ready || loading) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = imagePoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      photo.width,
      photo.height,
    );
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      sample(next);
      frame.current = null;
    });
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLCanvasElement>) {
    const directions: Record<string, ImagePoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction || !ready || loading) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    sample({
      x: selection.current.x + direction.x * step,
      y: selection.current.y + direction.y * step,
    });
  }

  return (
    <section className="photo-picker" aria-label="Photo color picker">
      <div className="workspace-toolbar">
        <div className="file-name">
          <ImagePlus size={17} aria-hidden="true" />
          <span>{photo.name}</span>
        </div>
        <div className="toolbar-actions">
          <Button
            variant="outline"
            onClick={() => cameraRef.current?.click()}
            disabled={loading}
          >
            <Camera data-icon="inline-start" />
            <span>Camera</span>
          </Button>
          <Button onClick={() => uploadRef.current?.click()} disabled={loading}>
            <Upload data-icon="inline-start" />
            Open image
          </Button>
        </div>
      </div>
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        aria-label="Upload image"
        hidden
        onChange={(event) => {
          openFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take a photo"
        hidden
        onChange={(event) => {
          openFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div
        className="photo-stage"
        data-dragging={dragging}
        aria-busy={loading}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          openFile(event.dataTransfer.files[0]);
        }}
      >
        <div
          className="photo-canvas-wrap"
          style={{
            aspectRatio: `${photo.width} / ${photo.height}`,
            maxWidth: `${(630 * photo.width) / photo.height}px`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="photo-canvas"
            tabIndex={0}
            role="group"
            aria-label="Image color sampling area"
            aria-describedby="photo-instructions"
            onKeyDown={moveWithKeyboard}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              pickAt(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                pickAt(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                pickAt(event);
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              if (frame.current !== null) cancelAnimationFrame(frame.current);
            }}
          />
          {ready && (
            <div
              className="sample-target"
              aria-hidden="true"
              style={{
                left: `${((point.x + 0.5) / photo.width) * 100}%`,
                top: `${((point.y + 0.5) / photo.height) * 100}%`,
              }}
            />
          )}
        </div>
        <div
          className="magnifier"
          data-side={point.x > photo.width / 2 ? "left" : "right"}
          aria-label="Pixel magnifier"
        >
          <canvas ref={lensRef} width={180} height={180} aria-hidden="true" />
          <div className="lens-crosshair" aria-hidden="true" />
          <span className="lens-zoom">12×</span>
        </div>
        {loading && (
          <div className="photo-loading" role="status">
            Opening image…
          </div>
        )}
      </div>
      <div className="photo-caption">
        <p id="photo-instructions">
          <Move size={14} aria-hidden="true" />
          Drag to explore. Arrow keys for one-pixel precision.
        </p>
        <span>
          {photo.resized ? "Resized · " : ""}
          {photo.width} × {photo.height}
        </span>
      </div>
      <p className="privacy-note">
        Your photos stay on this device. Drop an image here, or open one above.
      </p>
    </section>
  );
}
