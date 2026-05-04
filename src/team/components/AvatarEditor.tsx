import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Props = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  /** Returns cropped square PNG blob ready to upload. */
  onApply: (blob: Blob) => void;
};

/**
 * Simple square crop editor: load the image, let the user pan and zoom
 * inside a circular preview, then render the visible region to a 512×512
 * canvas and emit a PNG blob. GIFs are handled outside this component
 * (they're uploaded as-is so animation is preserved).
 */
export default function AvatarEditor({ open, file, onCancel, onApply }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Stage size in CSS pixels — the visible square viewport.
  const STAGE = 320;
  const OUTPUT = 512;

  useEffect(() => {
    if (!open || !file) {
      setSrc(null);
      setImg(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  useEffect(() => {
    if (!src) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  // Base scale: cover the stage so smallest dimension fills.
  const baseScale = img ? Math.max(STAGE / img.width, STAGE / img.height) : 1;
  const scale = baseScale * zoom;
  const drawW = img ? img.width * scale : 0;
  const drawH = img ? img.height * scale : 0;

  function clamp(next: { x: number; y: number }) {
    const minX = STAGE - drawW;
    const minY = STAGE - drawH;
    return {
      x: Math.min(0, Math.max(minX, next.x)),
      y: Math.min(0, Math.max(minY, next.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!img) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clamp({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy }));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  // Re-clamp on zoom change so the image still covers the stage.
  useEffect(() => {
    if (!img) return;
    setOffset((o) => clamp(o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, img]);

  async function apply() {
    if (!img) return;
    setWorking(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");
      // Map stage → output pixel ratio.
      const ratio = OUTPUT / STAGE;
      ctx.drawImage(img, offset.x * ratio, offset.y * ratio, drawW * ratio, drawH * ratio);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Render failed"))), "image/png", 0.95),
      );
      onApply(blob);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust photo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative overflow-hidden bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: STAGE, height: STAGE, borderRadius: "9999px" }}
          >
            {img && (
              <img
                src={src!}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: offset.x,
                  top: offset.y,
                  width: drawW,
                  height: drawH,
                  maxWidth: "none",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
          <div className="w-full">
            <div className="text-xs text-muted-foreground mb-1.5">Zoom</div>
            <Slider
              min={1}
              max={4}
              step={0.01}
              value={[zoom]}
              onValueChange={(v) => setZoom(v[0])}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Drag to reposition. Use the slider to zoom.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={working}>Cancel</Button>
          <Button onClick={apply} disabled={!img || working}>
            {working ? "Saving…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}