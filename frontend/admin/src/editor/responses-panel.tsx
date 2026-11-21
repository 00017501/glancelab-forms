import { DownloadSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError, api, codebookCsvUrl, responsesCsvUrl } from "@/api/client";
import { keys, useResponses } from "@/api/queries";
import type { FormDetail, ResponseRow } from "@/api/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VariantTile } from "@/components/variant-tile";
import { formatDateTime, formatDuration, variantColour } from "@/lib/format";

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

/** How evenly the versions have filled: one bar per version, completed solid and partial faded. */
function Balance({ variants }: { variants: { label: string; completed: number; partial: number }[] }) {
  const most = Math.max(1, ...variants.map((variant) => variant.completed + variant.partial));
  return (
    <ul className="grid gap-2.5">
      {variants.map((variant, index) => {
        const colour = variantColour(index).background;
        return (
          <li key={variant.label} className="grid grid-cols-[auto_minmax(4rem,8rem)_1fr_auto] items-center gap-3">
            <VariantTile index={index} label={variant.label} size="sm" />
            <span className="truncate text-sm">{variant.label}</span>
            <span className="flex h-3 bg-muted" aria-hidden>
              <span style={{ width: `${(variant.completed / most) * 100}%`, background: colour }} />
              <span style={{ width: `${(variant.partial / most) * 100}%`, background: colour, opacity: 0.35 }} />
            </span>
            <span className="data text-sm">
              {variant.completed}
              {variant.partial > 0 && <span className="text-muted-foreground"> + {variant.partial} partial</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ResponsesPanel({ detail }: { detail: FormDetail }) {
  const responses = useResponses(detail.id);
  const client = useQueryClient();
  const [toDelete, setToDelete] = useState<ResponseRow | null>(null);
  const [isClearing, setClearing] = useState(false);

  const refresh = async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: keys.responses(detail.id) }),
      client.invalidateQueries({ queryKey: keys.form(detail.id) }),
      client.invalidateQueries({ queryKey: keys.forms, exact: true }),
    ]);
  };

  const removeOne = async (row: ResponseRow): Promise<void> => {
    try {
      await api.deleteResponse(detail.id, row.participant_id);
      await refresh();
      toast.success("Response deleted");
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const clearAll = async (): Promise<void> => {
    try {
      const result = await api.clearResponses(detail.id);
      await refresh();
      toast.success(`${result.deleted} ${result.deleted === 1 ? "response" : "responses"} deleted`);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const rows = responses.data?.rows ?? [];
  const variantIndex = new Map(detail.variants.map((variant, index) => [variant.label, index]));
  const completed = rows.filter((row) => row.status === "completed").length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light">Responses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="data text-foreground">{completed}</span> completed,{" "}
            <span className="data text-foreground">{rows.length - completed}</span> partial. This list refreshes by
            itself.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={rows.length > 0 ? "default" : "outline"}>
            <a href={responsesCsvUrl(detail.id)} download>
              <DownloadSimpleIcon data-icon="inline-start" />
              Download CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={codebookCsvUrl(detail.id)} download title="Explains what every CSV column means">
              Column guide
            </a>
          </Button>
          <Button variant="outline" disabled={rows.length === 0} onClick={() => setClearing(true)}>
            <TrashIcon data-icon="inline-start" />
            Clear responses
          </Button>
        </div>
      </div>

      {responses.isPending ? (
        <p className="py-16 text-center text-muted-foreground">Loading responses…</p>
      ) : responses.isError ? (
        <div className="py-16 text-center">
          <p>Could not load the responses.</p>
          <Button variant="outline" className="mt-4" onClick={() => void responses.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <section aria-label="Responses per version" className="mt-6 border border-border bg-card p-4 sm:p-5">
            <Balance variants={responses.data.variants} />
          </section>

          {rows.length === 0 ? (
            <p className="py-14 text-center text-muted-foreground">
              No responses yet.{" "}
              {detail.status === "published"
                ? "They appear here as people take part."
                : "Publish the study and share its link to collect some."}
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="label-mono h-10 pl-4">ID</TableHead>
                    <TableHead className="label-mono h-10">Version</TableHead>
                    <TableHead className="label-mono h-10">Status</TableHead>
                    <TableHead className="label-mono h-10 text-right">Steps</TableHead>
                    <TableHead className="label-mono h-10">Device</TableHead>
                    <TableHead className="label-mono h-10 text-right">Screen</TableHead>
                    <TableHead className="label-mono h-10">Started</TableHead>
                    <TableHead className="label-mono h-10 text-right">Took</TableHead>
                    <TableHead className="h-10 w-12">
                      <span className="sr-only">Delete</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.participant_id}>
                      <TableCell className="data pl-4">{row.participant_id}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <VariantTile index={variantIndex.get(row.variant) ?? 0} label={row.variant} size="sm" />
                          {row.variant}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.status === "completed" ? "Completed" : <span className="text-muted-foreground">Partial</span>}
                        {row.interrupted && (
                          <span
                            className="ml-2 border border-amber-ink/50 bg-amber/20 px-1.5 py-0.5 font-mono text-[11px]"
                            title="The page was reloaded during a timed step, which was skipped. Consider leaving this response out."
                          >
                            reloaded
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="data text-right">
                        {row.steps_done}/{row.steps_total}
                      </TableCell>
                      <TableCell className="capitalize">{row.device_type}</TableCell>
                      <TableCell className="data text-right text-muted-foreground">
                        {row.viewport_width}×{row.viewport_height}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(row.started_at)}</TableCell>
                      <TableCell className="data text-right">{formatDuration(row.duration_seconds)}</TableCell>
                      <TableCell className="pr-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete response ${row.participant_id}`}
                          onClick={() => setToDelete(row)}
                        >
                          <TrashIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete response ${toDelete?.participant_id ?? ""}?`}
        description="This participant's answers are deleted for good."
        confirmLabel="Delete response"
        onConfirm={() => toDelete && void removeOne(toDelete)}
      />
      <ConfirmDialog
        open={isClearing}
        onOpenChange={setClearing}
        title={`Clear all ${rows.length} ${rows.length === 1 ? "response" : "responses"}?`}
        description="Every response to this study is deleted for good, test runs and real ones alike. Download the CSV first if you need the data."
        confirmLabel="Clear responses"
        onConfirm={() => void clearAll()}
      />
    </div>
  );
}
