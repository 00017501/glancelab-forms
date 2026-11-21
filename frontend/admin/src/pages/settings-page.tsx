import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError, api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Must match WIPE_CONFIRMATION on the server.
const CONFIRMATION = "DELETE EVERYTHING";

const PROMISES = [
  "No IP address is stored or written to any log.",
  "Participant pages load nothing from other websites: no trackers, fonts or analytics.",
  "Nothing is saved before a participant agrees, and leaving the study deletes their data at once.",
  "Each response has only a random ID. Exports contain nothing that identifies a person.",
];

export function SettingsPage() {
  const client = useQueryClient();
  const [typed, setTyped] = useState("");
  const [includeAll, setIncludeAll] = useState(false);
  const [isWiping, setWiping] = useState(false);

  const wipe = async (): Promise<void> => {
    setWiping(true);
    try {
      const result = await api.wipe(typed, includeAll);
      await client.invalidateQueries();
      setTyped("");
      setIncludeAll(false);
      toast.success(
        includeAll
          ? "Everything was deleted"
          : `${result.deleted} ${result.deleted === 1 ? "response" : "responses"} deleted`,
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete the data.");
    } finally {
      setWiping(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-light">Settings</h1>

      <section className="mt-8 border border-border bg-card p-6">
        <h2 className="text-xl font-light">What GlanceLab promises participants</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          These are built in and cannot be switched off. Your consent text can rely on them.
        </p>
        <ul className="mt-4 grid gap-2.5">
          {PROMISES.map((promise) => (
            <li key={promise} className="flex gap-3 text-[15px]">
              <span aria-hidden className="mt-2 size-2 shrink-0 bg-mint" />
              {promise}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 border border-destructive/50 bg-card p-6">
        <h2 className="text-xl font-light">Delete all data</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Use this when the coursework has been graded. It deletes every response in every study, for good. Download
          any CSV you still need first.
        </p>
        <label className="mt-5 flex items-start gap-3 text-[15px]">
          <Checkbox
            checked={includeAll}
            onCheckedChange={(checked) => setIncludeAll(checked === true)}
            className="mt-0.5"
          />
          <span>
            Also delete all studies and all images
            <span className="block text-sm text-muted-foreground">Leaves GlanceLab completely empty.</span>
          </span>
        </label>
        <div className="mt-5 grid gap-1.5">
          <Label htmlFor="wipe-confirm">
            Type <span className="data">{CONFIRMATION}</span> to confirm
          </Label>
          <div className="flex flex-wrap gap-3">
            <Input
              id="wipe-confirm"
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
              className="data max-w-xs"
            />
            <Button
              variant="destructive"
              disabled={typed.trim() !== CONFIRMATION || isWiping}
              onClick={() => void wipe()}
            >
              {isWiping ? "Deleting…" : includeAll ? "Delete everything" : "Delete all responses"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
