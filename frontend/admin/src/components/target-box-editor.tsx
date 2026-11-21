import { useRef, useState, type PointerEvent } from "react";

import type { TargetBox } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TargetBoxEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  variantLabel: string;
  value: TargetBox | null;
  onSave: (box: TargetBox | null) => void;
}

// A drag smaller than this, as a fraction of the image, is treated as a stray click.
const MIN_SIZE = 0.01;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Draw the rectangle that counts as "found it". Stored as fractions of the image, so it fits any screen. */
export function TargetBoxEditor({ open, onOpenChange, imageUrl, variantLabel, value, onSave }: TargetBoxEditorProps) {
  const surface = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<TargetBox | null>(value);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const position = (event: PointerEvent<HTMLDivElement>): { x: number; y: number } => {
    const rect = surface.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = position(event);
    setOrigin(start);
    setBox({ x: start.x, y: start.y, w: 0, h: 0 });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!origin) return;
    const current = position(event);
    setBox({
      x: round(Math.min(origin.x, current.x)),
      y: round(Math.min(origin.y, current.y)),
      w: round(Math.abs(current.x - origin.x)),
      h: round(Math.abs(current.y - origin.y)),
    });
  };

  const onPointerUp = (): void => {
    setOrigin(null);
    setBox((current) => (current && current.w >= MIN_SIZE && current.h >= MIN_SIZE ? current : value));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setBox(value);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[92dvh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal">Target box for variant {variantLabel}</DialogTitle>
          <DialogDescription>
            Drag a rectangle around what people should find, such as the price. A click inside it counts as a hit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-mat p-3">
          <div
            ref={surface}
            className="relative cursor-crosshair touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img src={imageUrl} alt="" draggable={false} className="block max-h-[62dvh] max-w-full" />
            {box && box.w > 0 && box.h > 0 && (
              <div
                className="pointer-events-none absolute border-2 border-mint bg-mint/20 outline outline-1 outline-black/70"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.w * 100}%`,
                  height: `${box.h * 100}%`,
                }}
              />
            )}
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <p className="data self-center text-xs text-muted-foreground">
            {box
              ? `x ${(box.x * 100).toFixed(1)}%  y ${(box.y * 100).toFixed(1)}%  ${(box.w * 100).toFixed(1)} × ${(box.h * 100).toFixed(1)}%`
              : "No box drawn yet"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBox(null)} disabled={!box}>
              Clear
            </Button>
            <Button
              onClick={() => {
                onSave(box);
                onOpenChange(false);
              }}
            >
              Save box
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
