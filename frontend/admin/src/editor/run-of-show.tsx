import type { Step } from "@/api/types";
import { formatSeconds, stepSummary, timedMs } from "@/lib/steps";

import { StepIcon } from "./step-icon";

/**
 * The study as a sequence: every step in order with the time it takes on a fixed clock.
 * Clicking a row jumps to that step's card.
 */
export function RunOfShow({ steps }: { steps: Step[] }) {
  const timedTotal = steps.reduce((total, step) => total + (timedMs(step.config) ?? 0), 0);
  const selfPaced = steps.filter((step) => timedMs(step.config) === null).length;

  const jump = (key: string): void => {
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav aria-label="Steps in this study" className="flex max-h-[calc(100dvh-10.5rem)] flex-col">
      <h2 className="label-mono pb-2.5">Run of show</h2>
      <ol className="min-h-0 flex-1 overflow-y-auto border-y border-border">
        {steps.map((step, index) => {
          const ms = timedMs(step.config);
          return (
            <li key={step.key} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => jump(step.key)}
                className="grid w-full grid-cols-[1.5rem_1rem_1fr_auto] items-baseline gap-2 px-1 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="data text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <StepIcon type={step.config.type} className="size-4 self-start translate-y-0.5 text-muted-foreground" />
                <span className="line-clamp-2 leading-snug">{stepSummary(step.config)}</span>
                {step.config.type === "timed_search" ? (
                  <span className="data text-xs">max {formatSeconds(step.config.timeout_ms)}</span>
                ) : (
                  <span className={ms === null ? "text-xs text-muted-foreground" : "data text-xs"}>
                    {ms === null ? "own pace" : formatSeconds(ms)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 pt-3 text-sm">
        <dt className="text-muted-foreground">On a fixed clock</dt>
        <dd className="data text-right">{formatSeconds(timedTotal)}</dd>
        <dt className="text-muted-foreground">At their own pace</dt>
        <dd className="data text-right">
          {selfPaced} {selfPaced === 1 ? "step" : "steps"}
        </dd>
      </dl>
    </nav>
  );
}
