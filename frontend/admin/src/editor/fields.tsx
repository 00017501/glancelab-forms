import { useEffect, useId, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: (id: string) => ReactNode;
}

/** A labelled control with an optional line of help underneath. */
export function Field({ label, hint, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] text-muted-foreground">
        {label}
      </Label>
      {children(id)}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface SecondsFieldProps {
  id?: string;
  valueMs: number;
  onChange: (valueMs: number) => void;
  minSeconds: number;
  maxSeconds: number;
  disabled?: boolean;
}

/**
 * A duration typed in seconds and stored in milliseconds. The text is free while typing and is
 * committed when it is a number in range, so "0." or an empty box never turns into a wrong value.
 */
export function SecondsField({ id, valueMs, onChange, minSeconds, maxSeconds, disabled }: SecondsFieldProps) {
  const [text, setText] = useState(String(valueMs / 1000));
  useEffect(() => setText(String(valueMs / 1000)), [valueMs]);

  const parsed = Number(text);
  const isValid = text.trim() !== "" && Number.isFinite(parsed) && parsed >= minSeconds && parsed <= maxSeconds;

  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-invalid={!isValid}
        className="data w-24"
        onChange={(event) => {
          setText(event.target.value);
          const next = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(next) && next >= minSeconds && next <= maxSeconds) {
            onChange(Math.round(next * 1000));
          }
        }}
        onBlur={() => setText(String(valueMs / 1000))}
      />
      <span className="text-sm text-muted-foreground">seconds</span>
      {!isValid && (
        <span className="text-xs text-destructive">
          Between {minSeconds} and {maxSeconds}
        </span>
      )}
    </div>
  );
}
