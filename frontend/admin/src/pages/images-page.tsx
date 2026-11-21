import { TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ApiError, api } from "@/api/client";
import { useImages, useRefreshImages } from "@/api/queries";
import type { LibraryImage } from "@/api/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageDropzone } from "@/components/image-uploader";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";

export function ImagesPage() {
  const library = useImages();
  const refresh = useRefreshImages();
  const [toDelete, setToDelete] = useState<LibraryImage | null>(null);

  const remove = async (image: LibraryImage): Promise<void> => {
    try {
      await api.deleteImage(image.id);
      await refresh();
      toast.success("Image deleted");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete the image.");
    }
  };

  const images = library.data?.images ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light">Images</h1>
          <p className="mt-1.5 text-muted-foreground">Upload once, then use an image in any study.</p>
        </div>
        {library.data && (
          <p className="data text-sm text-muted-foreground">
            {images.length} {images.length === 1 ? "image" : "images"} · {formatBytes(library.data.total_bytes)} stored
          </p>
        )}
      </div>

      <div className="mt-6">
        <ImageDropzone />
      </div>

      {library.isPending ? (
        <p className="py-16 text-center text-muted-foreground">Loading images…</p>
      ) : library.isError ? (
        <div className="py-16 text-center">
          <p>Could not load your images.</p>
          <Button variant="outline" className="mt-4" onClick={() => void library.refetch()}>
            Try again
          </Button>
        </div>
      ) : images.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Nothing here yet. Drop your ad versions above to get started.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="flex flex-col border border-border bg-card">
              <a href={image.url} target="_blank" rel="noreferrer" className="block bg-mat">
                <img
                  src={image.thumbnail_url}
                  alt={image.filename}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-contain"
                />
              </a>
              <div className="flex flex-1 flex-col gap-1 border-t border-border p-3">
                <p className="truncate text-sm font-medium" title={image.filename}>
                  {image.filename}
                </p>
                <p className="data truncate text-xs whitespace-nowrap text-muted-foreground">
                  {image.width}×{image.height} · {formatBytes(image.size_bytes)}
                </p>
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <p className="min-w-0 text-xs text-muted-foreground">
                    {image.used_by.length === 0 ? (
                      "Not used yet"
                    ) : (
                      <>
                        Used in{" "}
                        {image.used_by.map((usage, index) => (
                          <span key={usage.form_id}>
                            {index > 0 && ", "}
                            <Link to={`/studies/${usage.form_id}`} className="text-foreground underline">
                              {usage.form_title}
                            </Link>
                          </span>
                        ))}
                      </>
                    )}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${image.filename}`}
                    disabled={image.used_by.length > 0}
                    title={image.used_by.length > 0 ? "Remove it from the studies that use it first" : "Delete"}
                    onClick={() => setToDelete(image)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete "${toDelete?.filename ?? ""}"?`}
        description="The image is removed from your library and from storage. This cannot be undone."
        confirmLabel="Delete image"
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </main>
  );
}
