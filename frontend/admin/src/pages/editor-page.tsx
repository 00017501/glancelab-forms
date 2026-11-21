import { ArrowLeftIcon, CaretDownIcon, EyeIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ApiError, api } from "@/api/client";
import type { FormDetail } from "@/api/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VariantTile } from "@/components/variant-tile";
import { BuildPanel } from "@/editor/build-panel";
import { ResponsesPanel } from "@/editor/responses-panel";
import { ProblemsDialog, ShareDialog } from "@/editor/share-dialog";
import { useDraft, type SaveState } from "@/editor/use-draft";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const SAVE_LABELS: Record<SaveState, string> = {
  saved: "Saved",
  unsaved: "Saving…",
  saving: "Saving…",
  failed: "Not saved",
  incomplete: "Fill in the empty name to save",
};

function errorText(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

/** True when the consent text promised deletion by a date that has now passed and data is still held. */
function isDeletionOverdue(detail: FormDetail): string | null {
  const consent = detail.steps[0]?.config;
  if (
    !consent ||
    consent.type !== "consent" ||
    !consent.deletion_date ||
    detail.response_count === 0
  )
    return null;
  const today = new Date().toISOString().slice(0, 10);
  return consent.deletion_date < today ? consent.deletion_date : null;
}

export function EditorPage({ tab }: { tab: "build" | "responses" }) {
  const formId = Number(useParams().formId);
  const draft = useDraft(formId);
  const [isSharing, setSharing] = useState(false);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [isConfirmingClose, setConfirmingClose] = useState(false);

  const { detail, content } = draft;
  if (draft.isMissing) {
    return (
      <main className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-light">
            This study could not be opened
          </h1>
          <p className="mt-2 text-muted-foreground">
            It may have been deleted.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/">Back to studies</Link>
          </Button>
        </div>
      </main>
    );
  }
  if (!detail || !content) {
    return (
      <main className="flex-1 p-10 text-center text-muted-foreground">
        Loading study…
      </main>
    );
  }

  const publish = async (): Promise<void> => {
    setBusy(true);
    try {
      if (!(await draft.flush())) return;
      draft.setDetail(await api.publishForm(formId));
      setSharing(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "form_not_ready")
        setProblems(error.details);
      else toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const close = async (): Promise<void> => {
    try {
      draft.setDetail(await api.closeForm(formId));
      setSharing(false);
      toast.success(
        "Study closed. The link no longer accepts new participants.",
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const preview = async (variantKey: string): Promise<void> => {
    // Open the tab first, while the click is still "user initiated", or the browser blocks it.
    const tab = window.open("about:blank", "_blank");
    const saved = await draft.flush();
    if (!tab) return;
    if (!saved) {
      tab.close();
      return;
    }
    tab.location.href = `/s/preview?preview=${formId}&variant=${encodeURIComponent(variantKey)}`;
  };

  const overdue = isDeletionOverdue(detail);
  const isFailed =
    draft.saveState === "failed" || draft.saveState === "incomplete";

  return (
    <main className="flex flex-1 flex-col">
      <div className="shell sticky top-14 z-30 border-b border-shell-line bg-shell-raised text-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Back to all studies"
          >
            <Link to="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <input
            value={content.title}
            aria-label="Study name"
            maxLength={200}
            onChange={(event) =>
              draft.update((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            className="h-9 min-w-0 flex-1 basis-[calc(100%-3.5rem)] border sm:basis-56 border-transparent bg-transparent px-2 text-xl font-light text-ellipsis outline-none transition-colors hover:border-shell-line focus:border-ring"
          />
          <StatusBadge status={detail.status} />
          <span
            role="status"
            className={cn(
              "font-mono text-xs",
              isFailed ? "text-destructive" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {SAVE_LABELS[draft.saveState]}
            {draft.saveState === "failed" && (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void draft.flush()}
              >
                Try again
              </button>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <EyeIcon data-icon="inline-start" />
                  Preview
                  <CaretDownIcon data-icon="inline-end" className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Try it as a participant. Nothing is saved.
                </DropdownMenuLabel>
                {content.variants.map((variant, index) => (
                  <DropdownMenuItem
                    key={variant.key}
                    onSelect={() => void preview(variant.key)}
                  >
                    <VariantTile
                      index={index}
                      label={variant.label}
                      size="sm"
                    />
                    Version {variant.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {detail.status === "published" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmingClose(true)}
                >
                  Close study
                </Button>
                <Button onClick={() => setSharing(true)}>Share link</Button>
              </>
            ) : (
              <Button onClick={() => void publish()} disabled={isBusy}>
                {detail.status === "closed" ? "Reopen" : "Publish"}
              </Button>
            )}
          </div>
        </div>
        <nav aria-label="Study sections" className="flex gap-1 px-4 sm:px-6">
          {[
            { to: `/studies/${formId}`, label: "Build", end: true },
            {
              to: `/studies/${formId}/responses`,
              label: `Responses (${detail.response_count})`,
              end: false,
            },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isActive &&
                    "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[linear-gradient(90deg,var(--violet),var(--indigo))]",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {overdue && (
        <p
          role="alert"
          className="border-b border-amber-ink/40 bg-amber/20 px-4 py-3 text-center text-sm sm:px-6"
        >
          The consent text promised that data would be deleted by{" "}
          {formatDate(overdue)}. When grading is finished, download what you
          need and clear the responses.
        </p>
      )}

      {tab === "build" ? (
        <BuildPanel detail={detail} content={content} update={draft.update} />
      ) : (
        <ResponsesPanel detail={detail} />
      )}

      <ShareDialog
        open={isSharing}
        onOpenChange={setSharing}
        slug={detail.slug}
        onClose={() => {
          setSharing(false);
          setConfirmingClose(true);
        }}
      />
      <ConfirmDialog
        open={isConfirmingClose}
        onOpenChange={setConfirmingClose}
        title="Close this study?"
        description="The link stops accepting new participants. People who have already started can finish, and no responses are deleted. You can reopen it later."
        confirmLabel="Close study"
        onConfirm={() => void close()}
      />
      <ProblemsDialog
        open={problems !== null}
        onOpenChange={(open) => !open && setProblems(null)}
        problems={problems ?? []}
      />
    </main>
  );
}
