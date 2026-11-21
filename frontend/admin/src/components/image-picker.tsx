import { CheckIcon } from "@phosphor-icons/react";

import { useImages } from "@/api/queries";
import { ImageDropzone } from "@/components/image-uploader";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  selectedId: number | null;
  onPick: (imageId: number) => void;
}

/** Choose one image from the library, or upload a new one and use it straight away. */
export function ImagePicker({ open, onOpenChange, title, selectedId, onPick }: ImagePickerProps) {
  const { data, isLoading } = useImages();
  const images = data?.images ?? [];

  const pick = (imageId: number): void => {
    onPick(imageId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86dvh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal">{title}</DialogTitle>
          <DialogDescription>Pick from your library, or upload a new image.</DialogDescription>
        </DialogHeader>
        <ImageDropzone compact onUploaded={(uploaded) => uploaded[0] && pick(uploaded[0].id)} />
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading images…</p>
          ) : images.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Your library is empty. Upload the first image above.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => pick(image.id)}
                    aria-pressed={image.id === selectedId}
                    className={cn(
                      "group relative block w-full border bg-mat text-left transition-colors hover:border-indigo",
                      image.id === selectedId ? "border-indigo ring-1 ring-indigo" : "border-border",
                    )}
                  >
                    <img
                      src={image.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full object-contain"
                    />
                    <span className="block truncate border-t border-border bg-card px-2 py-1.5 text-xs">
                      {image.filename}
                    </span>
                    {image.id === selectedId && (
                      <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center bg-indigo text-white">
                        <CheckIcon weight="bold" className="size-3.5" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
