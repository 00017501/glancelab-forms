import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, api } from "@/api/client";
import { keys, useForm } from "@/api/queries";
import type { FormContent, FormDetail } from "@/api/types";

/** "incomplete" means a required name is empty, so the draft is held back until it is filled in. */
export type SaveState = "saved" | "unsaved" | "saving" | "failed" | "incomplete";

// Quiet time after the last edit before a save is sent.
const AUTOSAVE_DELAY_MS = 700;

function contentOf(detail: FormDetail): FormContent {
  return {
    title: detail.title,
    block_repeats: detail.block_repeats,
    variants: detail.variants,
    steps: detail.steps,
  };
}

export interface Draft {
  detail: FormDetail | undefined;
  content: FormContent | null;
  isLoading: boolean;
  isMissing: boolean;
  saveState: SaveState;
  /** Change the draft; the change is saved automatically. */
  update: (change: (current: FormContent) => FormContent) => void;
  /** Save now if anything is unsaved. Resolves false when the save failed. */
  flush: () => Promise<boolean>;
  /** Replace the server copy after an action such as publish or close. */
  setDetail: (detail: FormDetail) => void;
}

/** The editor's working copy of a study, autosaved after each pause in editing. */
export function useDraft(formId: number): Draft {
  const query = useForm(formId);
  const client = useQueryClient();
  const [content, setContent] = useState<FormContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const latest = useRef<FormContent | null>(null);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const loadedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!query.data || loadedFor.current === formId) return;
    loadedFor.current = formId;
    latest.current = contentOf(query.data);
    revision.current = 0;
    savedRevision.current = 0;
    setContent(latest.current);
    setSaveState("saved");
  }, [formId, query.data]);

  const setDetail = useCallback(
    (detail: FormDetail) => {
      client.setQueryData(keys.form(formId), detail);
      void client.invalidateQueries({ queryKey: keys.forms, exact: true });
    },
    [client, formId],
  );

  const save = useCallback(async (): Promise<boolean> => {
    // Saves go out one at a time, oldest first, so an older request can never land after a newer one.
    while (inFlight.current) await inFlight.current;
    const toSave = latest.current;
    const savingRevision = revision.current;
    if (!toSave || savingRevision === savedRevision.current) return true;
    if (!toSave.title.trim() || toSave.variants.some((variant) => !variant.label.trim())) {
      setSaveState("incomplete");
      return false;
    }

    setSaveState("saving");
    const attempt = (async (): Promise<boolean> => {
      try {
        setDetail(await api.saveForm(formId, toSave));
        savedRevision.current = savingRevision;
        setSaveState(revision.current === savingRevision ? "saved" : "unsaved");
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          // The server refused a structural change on a study that is live or has responses.
          // Show its copy again, unless newer edits were made while this request was on its way.
          toast.error(error.message);
          const fresh = await client.fetchQuery({ queryKey: keys.form(formId), queryFn: () => api.getForm(formId) });
          if (revision.current === savingRevision) {
            latest.current = contentOf(fresh);
            savedRevision.current = revision.current;
            setContent(latest.current);
            setSaveState("saved");
          }
          return false;
        }
        // Anything else, including a value the server finds invalid, keeps the draft so nothing typed is lost.
        if (error instanceof ApiError && error.status === 422) toast.error(error.message);
        setSaveState("failed");
        return false;
      }
    })();
    inFlight.current = attempt;
    const ok = await attempt;
    // A later save may already have replaced this one; only clear our own marker.
    if (inFlight.current === attempt) inFlight.current = null;
    return ok;
  }, [client, formId, setDetail]);

  const update = useCallback(
    (change: (current: FormContent) => FormContent) => {
      if (!latest.current) return;
      latest.current = change(latest.current);
      revision.current += 1;
      setContent(latest.current);
      setSaveState("unsaved");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    },
    [save],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    return save();
  }, [save]);

  // Leaving the editor must not drop the last few keystrokes.
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      void save();
    };
  }, [save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (revision.current !== savedRevision.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return {
    detail: query.data,
    content,
    isLoading: query.isPending,
    isMissing: query.isError,
    saveState,
    update,
    flush,
    setDetail,
  };
}
