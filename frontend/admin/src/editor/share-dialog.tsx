import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  onClose: () => void;
}

/** The public link, a copy button and a QR code for a live study. */
export function ShareDialog({ open, onOpenChange, slug, onClose }: ShareDialogProps) {
  const link = `${window.location.origin}/s/${slug}`;
  const [isCopied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal">Your study is live</DialogTitle>
          <DialogDescription>Send this link to participants, or let them scan the code.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label="Study link" className="data" onFocus={(event) => event.target.select()} />
          <Button onClick={() => void copy()} className="w-28 shrink-0">
            {isCopied ? <CheckIcon data-icon="inline-start" weight="bold" /> : <CopyIcon data-icon="inline-start" />}
            {isCopied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <div className="grid place-items-center border border-border bg-white p-5">
          <QRCodeSVG value={link} size={196} marginSize={0} level="M" title="QR code for the study link" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">Closing stops new participants. People already in can finish.</p>
          <Button variant="outline" onClick={onClose}>
            Close study
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProblemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problems: string[];
}

/** What still has to be filled in before a study can go live. */
export function ProblemsDialog({ open, onOpenChange, problems }: ProblemsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal">Almost ready to publish</DialogTitle>
          <DialogDescription>
            {problems.length === 1 ? "One thing is" : `${problems.length} things are`} still missing.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto text-[15px]">
          {problems.map((problem) => (
            <li key={problem} className="flex gap-3">
              <span aria-hidden className="mt-2 size-2 shrink-0 bg-amber" />
              {problem}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back to editing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
