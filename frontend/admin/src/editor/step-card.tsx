import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CopyIcon,
  DotsSixVerticalIcon,
  LockSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import type { LibraryImage, Step, StepConfig, Variant } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STEP_NAMES, stepSummary } from "@/lib/steps";
import { cn } from "@/lib/utils";

import {
  ClickImageBody,
  ConsentBody,
  DistractorBody,
  QuestionBody,
  StimulusBody,
  TextBody,
  TimedSearchBody,
} from "./step-bodies";
import { StepIcon } from "./step-icon";

interface StepCardProps {
  step: Step;
  /** Position in the study, starting at 1 for consent; matches the CSV column prefix. */
  number: number;
  variants: Variant[];
  images: Map<number, LibraryImage>;
  locked: boolean;
  onChange: (step: Step) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function Body(
  props: Omit<StepCardProps, "number" | "onDuplicate" | "onDelete">,
) {
  const { step, variants, images, locked } = props;
  const set = (config: StepConfig): void => props.onChange({ ...step, config });
  const { config } = step;

  switch (config.type) {
    case "consent":
      return <ConsentBody config={config} onChange={set} locked={locked} />;
    case "text":
      return <TextBody config={config} onChange={set} locked={locked} />;
    case "stimulus":
      return (
        <StimulusBody
          config={config}
          onChange={set}
          locked={locked}
          variants={variants}
          images={images}
        />
      );
    case "distractor":
      return <DistractorBody config={config} onChange={set} locked={locked} />;
    case "question":
      return <QuestionBody config={config} onChange={set} locked={locked} />;
    case "click_image":
      return (
        <ClickImageBody
          config={config}
          onChange={set}
          locked={locked}
          images={images}
        />
      );
    case "timed_search":
      return (
        <TimedSearchBody
          config={config}
          onChange={set}
          locked={locked}
          variants={variants}
          images={images}
        />
      );
  }
}

/** One step of the study as an editable card. Every card but consent can be dragged, copied and deleted. */
export function StepCard(props: StepCardProps) {
  const { step, number, locked } = props;
  const isConsent = step.config.type === "consent";
  const canBeOptional =
    step.config.type === "question" || step.config.type === "click_image";
  const sortable = useSortable({ id: step.key, disabled: isConsent || locked });

  return (
    <article
      ref={sortable.setNodeRef}
      id={`step-${step.key}`}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        "scroll-mt-36 border border-border bg-card",
        sortable.isDragging &&
          "relative z-10 border-indigo shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)]",
      )}
    >
      <header className="flex h-12 items-center gap-2 border-b border-border pr-2 pl-1">
        {isConsent ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="grid size-9 place-items-center text-muted-foreground"
                tabIndex={0}
              >
                <LockSimpleIcon className="size-4" aria-label="Always first" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Consent is always the first step and cannot be removed.
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            aria-label={`Drag to reorder step ${number}`}
            disabled={locked}
            className={cn(
              "grid size-9 touch-none place-items-center text-muted-foreground",
              locked
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab hover:text-foreground active:cursor-grabbing",
            )}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <DotsSixVerticalIcon weight="bold" className="size-4" />
          </button>
        )}
        <span className="data w-6 text-sm text-muted-foreground">
          {String(number).padStart(2, "0")}
        </span>
        <StepIcon type={step.config.type} className="size-4" />
        {/* Named as in the run-of-show: by its own wording, with the step type beside it. */}
        <h3 className="min-w-0 truncate text-[15px] font-medium">
          {stepSummary(step.config)}
        </h3>
        {stepSummary(step.config) !== STEP_NAMES[step.config.type] && (
          <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
            {STEP_NAMES[step.config.type]}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {canBeOptional && (
            <label className="mr-2 flex items-center gap-2 text-sm text-muted-foreground">
              Required
              <Switch
                checked={step.required}
                disabled={locked}
                onCheckedChange={(required) =>
                  props.onChange({ ...step, required })
                }
              />
            </label>
          )}
          {!isConsent && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Duplicate step ${number}`}
                disabled={locked}
                onClick={props.onDuplicate}
              >
                <CopyIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete step ${number}`}
                disabled={locked}
                onClick={props.onDelete}
              >
                <TrashIcon />
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="p-4 sm:p-5">
        <Body
          step={step}
          variants={props.variants}
          images={props.images}
          locked={locked}
          onChange={props.onChange}
        />
      </div>
    </article>
  );
}
