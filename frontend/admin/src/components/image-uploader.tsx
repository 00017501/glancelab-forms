import { UploadSimpleIcon } from "@phosphor-icons/react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { ApiError, api } from "@/api/client";
import { useRefreshImages } from "@/api/queries";
import type { LibraryImage } from "@/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Upload files and report each failure by name. Returns the images that were stored. */
export function useImageUpload(): { upload: (files: File[]) => Promise<LibraryImage[]>; isUploading: boolean } {
  const refresh = useRefreshImages();
  const [isUploading, setUploading] = useState(false);

  const upload = async (files: File[]): Promise<LibraryImage[]> => {
    if (files.length === 0) return [];
    setUploading(true);
    try {
      const outcome = await api.uploadImages(files);
      await refresh();
      for (const failure of outcome.failed) toast.error(`${failure.filename}: ${failure.message}`);
      if (outcome.uploaded.length > 0) {
        toast.success(outcome.uploaded.length === 1 ? "Image uploaded" : `${outcome.uploaded.length} images uploaded`);
      }
      return outcome.uploaded;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The upload failed. Please try again.");
      return [];
    } finally {
      setUploading(false);
    }
  };
  return { upload, isUploading };
}

interface DropzoneProps {
  onUploaded?: (images: LibraryImage[]) => void;
  compact?: boolean;
}

/** Drag-and-drop area with a file button. Accepts several images at once. */
export function ImageDropzone({ onUploaded, compact = false }: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setOver] = useState(false);
  const { upload, isUploading } = useImageUpload();

  const handle = async (list: FileList | null): Promise<void> => {
    const uploaded = await upload(Array.from(list ?? []));
    if (uploaded.length > 0) onUploaded?.(uploaded);
    if (input.current) input.current.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setOver(false);
    void handle(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex items-center justify-between gap-4 border border-dashed border-input bg-card transition-colors",
        compact ? "px-4 py-3" : "px-6 py-7",
        isOver && "border-indigo bg-indigo/8",
      )}
    >
      <div>
        <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {isUploading ? "Uploading…" : "Drop images here"}
        </p>
        <p className="text-sm text-muted-foreground">JPEG, PNG or WebP, up to 15 MB each. Large images are resized.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => void handle(event.target.files)}
      />
      <Button variant="outline" disabled={isUploading} onClick={() => input.current?.click()}>
        <UploadSimpleIcon data-icon="inline-start" />
        Choose files
      </Button>
    </div>
  );
}
