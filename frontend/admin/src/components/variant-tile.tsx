import { cn } from "@/lib/utils";
import { variantColour } from "@/lib/format";

interface VariantTileProps {
  /** Position of the variant in the form; decides its colour everywhere it appears. */
  index: number;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** The solid colour square that stands for one ad variant across the whole admin. It shows the variant's letter by position; the name sits beside it. */
export function VariantTile({ index, label, size = "md", className }: VariantTileProps) {
  const colour = variantColour(index);
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center font-mono font-semibold leading-none",
        size === "md" ? "size-7 text-[13px]" : "size-5 text-[11px]",
        className,
      )}
      style={{ background: colour.background, color: colour.text }}
      title={`Variant ${label}`}
    >
      {String.fromCharCode(65 + (index % 26))}
    </span>
  );
}
