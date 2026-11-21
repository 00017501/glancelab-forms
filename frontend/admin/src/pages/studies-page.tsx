import {
  CopyIcon,
  DotsThreeIcon,
  PlusIcon,
  ProhibitIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ApiError, api } from "@/api/client";
import { keys, useForms } from "@/api/queries";
import type { FormSummary } from "@/api/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VariantTile } from "@/components/variant-tile";
import { formatDateTime } from "@/lib/format";

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

function describeLoss(form: FormSummary): string {
  const responses = form.completed_count + form.partial_count;
  if (responses === 0)
    return "The study and its steps will be deleted. This cannot be undone.";
  return `The study, its steps and its ${responses} ${responses === 1 ? "response" : "responses"} will be deleted. Download the CSV first if you need the data. This cannot be undone.`;
}

export function StudiesPage() {
  const forms = useForms();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [isCreating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<FormSummary | null>(null);
  const [toClose, setToClose] = useState<FormSummary | null>(null);

  const refresh = (): Promise<void> =>
    client.invalidateQueries({ queryKey: keys.forms });

  const create = async (): Promise<void> => {
    setCreating(true);
    try {
      const form = await api.createForm("Untitled study");
      await refresh();
      navigate(`/studies/${form.id}`);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setCreating(false);
    }
  };

  const duplicate = async (form: FormSummary): Promise<void> => {
    try {
      const copy = await api.duplicateForm(form.id);
      await refresh();
      toast.success(`Copied as "${copy.title}"`);
    } catch (error) {
      toast.error(message(error));
    }
  };

  const remove = async (form: FormSummary): Promise<void> => {
    try {
      await api.deleteForm(form.id);
      await refresh();
      toast.success("Study deleted");
    } catch (error) {
      toast.error(message(error));
    }
  };

  const closeStudy = async (form: FormSummary): Promise<void> => {
    try {
      await api.closeForm(form.id);
      await Promise.all([
        refresh(),
        client.invalidateQueries({ queryKey: keys.form(form.id) }),
      ]);
      toast.success(
        "Study closed. The link no longer accepts new participants.",
      );
    } catch (error) {
      toast.error(message(error));
    }
  };

  const list = forms.data ?? [];

  const rowMenu = (form: FormSummary) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${form.title}`}
        >
          <DotsThreeIcon weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => navigate(`/studies/${form.id}`)}>
          Open
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate(`/studies/${form.id}/responses`)}
        >
          Responses
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void duplicate(form)}>
          <CopyIcon />
          Duplicate
        </DropdownMenuItem>
        {form.status === "published" && (
          <DropdownMenuItem onSelect={() => setToClose(form)}>
            <ProhibitIcon />
            Close study
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setToDelete(form)}
        >
          <TrashIcon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const tiles = (form: FormSummary) => (
    <span className="flex gap-1">
      {Array.from({ length: form.variant_count }, (_, index) => (
        <VariantTile
          key={index}
          index={index}
          label={String.fromCharCode(65 + index)}
          size="sm"
        />
      ))}
    </span>
  );

  return (
    <main className="flex-1">
      <div className="shell aurora border-b border-shell-line text-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pt-12 pb-8 sm:px-6">
          <div>
            <h1 className="text-4xl font-light">Studies</h1>
            <p className="mt-2 max-w-lg font-light text-foreground/80">
              Each study shows every participant one version of your ad, then
              asks what they noticed.
            </p>
          </div>
          <Button size="lg" onClick={() => void create()} disabled={isCreating}>
            <PlusIcon data-icon="inline-start" weight="bold" />
            New study
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {forms.isPending ? (
          <p className="py-16 text-center text-muted-foreground">
            Loading studies…
          </p>
        ) : forms.isError ? (
          <div className="py-16 text-center">
            <p>Could not load your studies.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void forms.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="border border-dashed border-input bg-card px-6 py-14 text-center">
            <h2 className="text-2xl font-light">No studies yet</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Start one, add your ad versions, and you get a link to share. You
              can make as many as you like and delete the ones you were only
              trying out.
            </p>
            <Button
              className="mt-6"
              size="lg"
              onClick={() => void create()}
              disabled={isCreating}
            >
              <PlusIcon data-icon="inline-start" weight="bold" />
              Create your first study
            </Button>
          </div>
        ) : (
          <>
            {/* On a phone each study is a stacked row, so its actions never scroll out of reach. */}
            <ul className="grid gap-3 sm:hidden">
              {list.map((form) => (
                <li key={form.id} className="border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/studies/${form.id}`}
                      className="min-w-0 text-base font-medium underline-offset-4 hover:underline"
                    >
                      {form.title}
                    </Link>
                    {rowMenu(form)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <StatusBadge status={form.status} />
                    {tiles(form)}
                    <span className="text-muted-foreground">
                      <span className="data text-foreground">
                        {form.completed_count}
                      </span>{" "}
                      completed
                      {form.partial_count > 0 && (
                        <>
                          ,{" "}
                          <span className="data text-foreground">
                            {form.partial_count}
                          </span>{" "}
                          partial
                        </>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto border border-border bg-card sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="label-mono h-10 pl-4">
                      Study
                    </TableHead>
                    <TableHead className="label-mono h-10">Status</TableHead>
                    <TableHead className="label-mono h-10">Variants</TableHead>
                    <TableHead className="label-mono h-10 text-right">
                      Steps
                    </TableHead>
                    <TableHead className="label-mono h-10 text-right">
                      Completed
                    </TableHead>
                    <TableHead className="label-mono h-10 text-right">
                      Partial
                    </TableHead>
                    <TableHead className="label-mono h-10">
                      Last edited
                    </TableHead>
                    <TableHead className="h-10 w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((form) => (
                    <TableRow key={form.id} className="group">
                      <TableCell className="max-w-xs py-3 pl-4">
                        <Link
                          to={`/studies/${form.id}`}
                          className="block truncate text-[15px] font-medium underline-offset-4 group-hover:underline"
                        >
                          {form.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={form.status} />
                      </TableCell>
                      <TableCell>{tiles(form)}</TableCell>
                      <TableCell className="data text-right">
                        {form.step_count}
                      </TableCell>
                      <TableCell className="data text-right">
                        {form.completed_count}
                      </TableCell>
                      <TableCell className="data text-right text-muted-foreground">
                        {form.partial_count}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(form.updated_at)}
                      </TableCell>
                      <TableCell className="pr-2">{rowMenu(form)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={toClose !== null}
        onOpenChange={(open) => !open && setToClose(null)}
        title={`Close "${toClose?.title ?? ""}"?`}
        description="The link stops accepting new participants. People who have already started can finish, and no responses are deleted. You can reopen it later."
        confirmLabel="Close study"
        onConfirm={() => toClose && void closeStudy(toClose)}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete "${toDelete?.title ?? ""}"?`}
        description={toDelete ? describeLoss(toDelete) : ""}
        confirmLabel="Delete study"
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </main>
  );
}
