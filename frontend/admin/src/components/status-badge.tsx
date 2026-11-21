import type { FormStatus } from "@/api/types";
import { cn } from "@/lib/utils";

const LABELS: Record<FormStatus, string> = { draft: "Draft", published: "Live", closed: "Closed" };

/** Study status: a filled mint square means participants can take part right now. */
export function StatusBadge({ status, className }: { status: FormStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-xs", className)}>
      <span
        aria-hidden
        className={cn(
          "size-2",
          status === "published" && "bg-mint",
          status === "draft" && "border border-current opacity-60",
          status === "closed" && "bg-current opacity-45",
        )}
      />
      {LABELS[status]}
    </span>
  );
}
