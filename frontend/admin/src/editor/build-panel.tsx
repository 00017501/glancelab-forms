import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon } from "@phosphor-icons/react";

import { useImageMap } from "@/api/queries";
import type { FormContent, FormDetail, Step, StepType } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADDABLE_STEPS, STEP_HINTS, STEP_NAMES, duplicateStep, newStep } from "@/lib/steps";

import { RunOfShow } from "./run-of-show";
import { StepCard } from "./step-card";
import { StepIcon } from "./step-icon";
import { StudyOptions } from "./study-options";

interface BuildPanelProps {
  detail: FormDetail;
  content: FormContent;
  update: (change: (current: FormContent) => FormContent) => void;
}

function AddStepMenu({ onAdd, disabled }: { onAdd: (type: Exclude<StepType, "consent">) => void; disabled: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" className="w-full border-dashed" disabled={disabled}>
          <PlusIcon data-icon="inline-start" weight="bold" />
          Add step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-80">
        {ADDABLE_STEPS.map((type) => (
          <DropdownMenuItem key={type} onSelect={() => onAdd(type)} className="items-start gap-3 py-2.5">
            <StepIcon type={type} className="mt-0.5 size-4" />
            <span>
              <span className="block text-sm font-medium">{STEP_NAMES[type]}</span>
              <span className="block text-xs text-muted-foreground">{STEP_HINTS[type]}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Build tab: run-of-show on the left, ad versions and step cards in the middle. */
export function BuildPanel({ detail, content, update }: BuildPanelProps) {
  const images = useImageMap();
  const locked = detail.structure_locked;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setStep = (step: Step): void =>
    update((current) => ({
      ...current,
      steps: current.steps.map((item) => (item.key === step.key ? step : item)),
    }));

  const addStep = (type: Exclude<StepType, "consent">): void => {
    const step = newStep(type);
    update((current) => ({ ...current, steps: [...current.steps, step] }));
    // Wait for the new card to exist before scrolling to it.
    window.setTimeout(() => {
      document.getElementById(`step-${step.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update((current) => {
      const from = current.steps.findIndex((step) => step.key === active.id);
      const to = current.steps.findIndex((step) => step.key === over.id);
      // Position 0 is consent; nothing may move above it.
      if (from < 1 || to < 1) return current;
      return { ...current, steps: arrayMove(current.steps, from, to) };
    });
  };

  const movable = content.steps.slice(1);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,720px)] lg:justify-center">
      <aside className="hidden lg:block">
        <div className="sticky top-36">
          <RunOfShow steps={content.steps} />
        </div>
      </aside>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        {locked && (
          <p role="status" className="border border-amber-ink/40 bg-amber/15 px-4 py-3 text-sm leading-relaxed">
            {detail.status === "published"
              ? "This study is live, so its structure is frozen. You can still fix wording."
              : "This study has responses, so its structure is frozen. You can still fix wording."}{" "}
            To change steps, options, timings, images or versions, close the study and clear its responses, or
            duplicate it and edit the copy.
          </p>
        )}

        <StudyOptions content={content} locked={locked} update={update} />

        <h2 className="label-mono mt-4">Steps</h2>
        {content.steps[0] && (
          <StepCard
            step={content.steps[0]}
            number={1}
            variants={content.variants}
            images={images}
            locked={locked}
            onChange={setStep}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
          />
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={movable.map((step) => step.key)} strategy={verticalListSortingStrategy}>
            {movable.map((step, index) => (
              <StepCard
                key={step.key}
                step={step}
                number={index + 2}
                variants={content.variants}
                images={images}
                locked={locked}
                onChange={setStep}
                onDuplicate={() =>
                  update((current) => {
                    const at = current.steps.findIndex((item) => item.key === step.key);
                    const steps = [...current.steps];
                    steps.splice(at + 1, 0, duplicateStep(step));
                    return { ...current, steps };
                  })
                }
                onDelete={() =>
                  update((current) => ({ ...current, steps: current.steps.filter((item) => item.key !== step.key) }))
                }
              />
            ))}
          </SortableContext>
        </DndContext>

        <AddStepMenu onAdd={addStep} disabled={locked} />
        {movable.length === 0 && !locked && (
          <p className="text-center text-sm text-muted-foreground">
            A typical study: a text screen with instructions, the ad exposure, a distractor, then questions about the
            price, and a thank-you screen.
          </p>
        )}
      </div>
    </div>
  );
}
