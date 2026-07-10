"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Modal } from "./Modal";
import { SpinnerIcon } from "./icons";

type Props = {
  file: File;
  /** Crop frame ratio, width / height. */
  aspect: number;
  /** Width of the exported JPEG; height follows the aspect. */
  outputWidth: number;
  label: string;
  /** Show the frame as a circle (avatars). */
  round?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

const MAX_ZOOM = 5;

/**
 * Lets you position and zoom an image inside a fixed crop frame before it's
 * uploaded. The image is constrained to always cover the frame, so a crop can
 * never contain empty space.
 */
export function ImageCropper({
  file,
  aspect,
  outputWidth,
  label,
  round = false,
  onCancel,
  onConfirm,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(
    null,
  );

  const frameH = frameW / aspect;

  // Decode the picked file. The `alive` guard stops a superseded load (the
  // cleanup revokes its URL, firing onerror) from clobbering current state.
  useEffect(() => {
    let alive = true;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setImg(null);
    setError(null);
    const image = new Image();
    image.onload = () => {
      if (alive) setImg(image);
    };
    image.onerror = () => {
      if (alive) setError("That file isn't a readable image.");
    };
    image.src = objectUrl;
    return () => {
      alive = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Track the frame's rendered width.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrameW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [url]);

  // Start centred, scaled just enough to cover the frame.
  useEffect(() => {
    if (!img || !frameW) return;
    const cover = Math.max(
      frameW / img.naturalWidth,
      frameH / img.naturalHeight,
    );
    setMinScale(cover);
    setScale(cover);
    setPos({
      x: (frameW - img.naturalWidth * cover) / 2,
      y: (frameH - img.naturalHeight * cover) / 2,
    });
  }, [img, frameW, frameH]);

  /** Keep the image covering the frame — no gaps at any edge. */
  const clamp = useCallback(
    (p: { x: number; y: number }, s: number) => {
      if (!img) return p;
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      return {
        x: Math.min(0, Math.max(frameW - w, p.x)),
        y: Math.min(0, Math.max(frameH - h, p.y)),
      };
    },
    [img, frameW, frameH],
  );

  /** Zoom about the centre of the frame so the focus point stays put. */
  const zoomTo = useCallback(
    (next: number) => {
      if (!img) return;
      const s = Math.min(minScale * MAX_ZOOM, Math.max(minScale, next));
      const cx = frameW / 2;
      const cy = frameH / 2;
      const ix = (cx - pos.x) / scale;
      const iy = (cy - pos.y) / scale;
      setScale(s);
      setPos(clamp({ x: cx - ix * s, y: cy - iy * s }, s));
    },
    [img, minScale, frameW, frameH, pos, scale, clamp],
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; dragging still works without it.
    }
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPos(
      clamp(
        {
          x: drag.current.ox + (e.clientX - drag.current.px),
          y: drag.current.oy + (e.clientY - drag.current.py),
        },
        scale,
      ),
    );
  }
  function endDrag() {
    drag.current = null;
  }

  function apply() {
    if (!img) return;
    setBusy(true);
    const outW = outputWidth;
    const outH = Math.round(outputWidth / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      setError("Canvas isn't supported here.");
      return;
    }
    // The frame, expressed in the source image's own pixels.
    ctx.drawImage(
      img,
      -pos.x / scale,
      -pos.y / scale,
      frameW / scale,
      frameH / scale,
      0,
      0,
      outW,
      outH,
    );
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onConfirm(blob);
        else setError("Couldn't process that image.");
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <Modal open onClose={onCancel}>
      <div className="p-5">
        <h2 className="font-serif text-lg font-semibold text-ink">
          Frame your {label}
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Drag to reposition, and zoom to get it just right.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-hover">
            {error}
          </p>
        ) : (
          <>
            <div
              className={round ? "mx-auto mt-4 max-w-[300px]" : "mt-4"}
              style={{ touchAction: "none" }}
            >
              <div
                ref={frameRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={(e) => zoomTo(scale * (1 - e.deltaY * 0.0015))}
                style={{ aspectRatio: String(aspect) }}
                className={`relative w-full cursor-grab select-none overflow-hidden bg-ink/60 active:cursor-grabbing ${
                  round ? "rounded-full" : "rounded-xl"
                }`}
              >
                {url && img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    className="absolute max-w-none"
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: img.naturalWidth * scale,
                      height: img.naturalHeight * scale,
                    }}
                  />
                )}
                {!img && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SpinnerIcon className="h-6 w-6 animate-spin text-white/70" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-muted">Zoom</span>
              <input
                type="range"
                min={minScale}
                max={minScale * MAX_ZOOM}
                step="any"
                value={scale}
                disabled={!img}
                onChange={(e) => zoomTo(Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
              />
            </div>
          </>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-ivory hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!img || busy || Boolean(error)}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
