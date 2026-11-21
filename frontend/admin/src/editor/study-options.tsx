import { PlusIcon, XIcon } from "@phosphor-icons/react";

import type { FormContent } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { VariantTile } from "@/components/variant-tile";
import { dropVariantFromSteps, newKey, nextVariantLabel } from "@/lib/steps";

// The server accepts at most this many variants per study.
const MAX_VARIANTS = 12;

interface StudyOptionsProps {
  content: FormContent;
  locked: boolean;
  update: (change: (current: FormContent) => FormContent) => void;
}

/** The ad versions being compared, and whether one browser may take part more than once. */
export function StudyOptions({ content, locked, update }: StudyOptionsProps) {
  const rename = (key: string, label: string): void =>
    update((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.key === key ? { ...variant, label } : variant)),
    }));

  const remove = (key: string): void =>
    update((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.key !== key),
      steps: dropVariantFromSteps(current.steps, key),
    }));

  const add = (): void =>
    update((current) => ({
      ...current,
      variants: [...current.variants, { key: newKey(), label: nextVariantLabel(current.variants) }],
    }));

  return (
    <section aria-labelledby="variants-heading" className="border border-border bg-card">
      <div className="p-4 sm:p-5">
        <h2 id="variants-heading" className="text-[15px] font-medium">
          Ad versions
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Each participant is given one version at random, and the versions are kept even.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2.5">
          {content.variants.map((variant, index) => (
            <li key={variant.key} className="flex items-center">
              <VariantTile index={index} label={variant.label || "?"} className="size-9" />
              <Input
                value={variant.label}
                maxLength={60}
                aria-label={`Name of version ${index + 1}`}
                className="w-28 border-l-0"
                onChange={(event) => rename(variant.key, event.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove version ${variant.label}`}
                disabled={locked || content.variants.length <= 1}
                onClick={() => remove(variant.key)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
          <li>
            <Button variant="outline" disabled={locked || content.variants.length >= MAX_VARIANTS} onClick={add}>
              <PlusIcon data-icon="inline-start" />
              Add version
            </Button>
          </li>
        </ul>
      </div>
      <label className="flex items-start gap-3 border-t border-border p-4 sm:px-5">
        <Switch
          checked={content.block_repeats}
          className="mt-0.5"
          onCheckedChange={(block_repeats) => update((current) => ({ ...current, block_repeats }))}
        />
        <span className="text-sm">
          Each person can take part once
          <span className="block text-muted-foreground">
            Remembered in their browser only. Turn this off if several people share one laptop.
          </span>
        </span>
      </label>
    </section>
  );
}
