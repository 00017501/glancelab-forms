import { ImageIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";

import type { LibraryImage, TargetBox } from "@/api/types";
import { ImagePicker } from "@/components/image-picker";
import { cn } from "@/lib/utils";

interface ImageSlotProps {
  /** Shown above the picture: a variant tile and name, or nothing for a single image. */
  heading?: ReactNode;
  pickerTitle: string;
  image: LibraryImage | undefined;
  imageId: number | null;
  onPick: (imageId: number) => void;
  disabled?: boolean;
  /** Drawn over the picture when set: the timed-search target. */
  targetBox?: TargetBox | null;
  footer?: ReactNode;
}

/** One picture position in a step: shows the chosen image on a neutral mat, or asks for one. */
export function ImageSlot({ heading, pickerTitle, image, imageId, onPick, disabled, targetBox, footer }: ImageSlotProps) {
  const [isPicking, setPicking] = useState(false);

  return (
    <div className="flex min-w-0 flex-col border border-border">
      {heading && <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">{heading}</div>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setPicking(true)}
        aria-label={image ? `Change image, currently ${image.filename}` : pickerTitle}
        className={cn(
          "group relative grid aspect-[4/3] place-items-center bg-mat text-muted-foreground transition-colors",
          !disabled && "hover:text-foreground",
          disabled && "cursor-not-allowed",
        )}
      >
        {image ? (
          // The wrapper takes the picture's own shape, so the target box overlay lines up with it exactly.
          <span
            className="relative block"
            style={{
              aspectRatio: `${image.width} / ${image.height}`,
              ...(image.width / image.height >= 4 / 3 ? { width: "100%" } : { height: "100%" }),
            }}
          >
            <img src={image.thumbnail_url} alt="" className="block size-full" />
            {targetBox && (
              <span
                className="absolute border-2 border-mint bg-mint/20 outline outline-1 outline-black/70"
                style={{
                  left: `${targetBox.x * 100}%`,
                  top: `${targetBox.y * 100}%`,
                  width: `${targetBox.w * 100}%`,
                  height: `${targetBox.h * 100}%`,
                }}
              />
            )}
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-sm">
            <ImageIcon className="size-6" />
            {imageId !== null ? "Image was deleted" : "Choose image"}
          </span>
        )}
        {image && !disabled && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center font-mono text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Change
          </span>
        )}
      </button>
      {footer && <div className="border-t border-border px-2.5 py-2">{footer}</div>}
      <ImagePicker
        open={isPicking}
        onOpenChange={setPicking}
        title={pickerTitle}
        selectedId={imageId}
        onPick={onPick}
      />
    </div>
  );
}
