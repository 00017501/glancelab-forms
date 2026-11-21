import { CheckIcon, PlusIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type {
  ClickImageConfig,
  ConsentConfig,
  DistractorConfig,
  LibraryImage,
  QuestionConfig,
  QuestionKind,
  StimulusConfig,
  TextConfig,
  TimedSearchConfig,
  Variant,
} from "@/api/types";
import { RichText } from "@/components/rich-text";
import { TargetBoxEditor } from "@/components/target-box-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { VariantTile } from "@/components/variant-tile";
import { newKey } from "@/lib/steps";

import { Field, SecondsField } from "./fields";
import { ImageSlot } from "./image-slot";

interface BodyProps<Config> {
  config: Config;
  onChange: (config: Config) => void;
  /** True when the study is live or has responses: wording may change, structure may not. */
  locked: boolean;
}

interface VariantBodyProps<Config> extends BodyProps<Config> {
  variants: Variant[];
  images: Map<number, LibraryImage>;
}

const CONSENT_STATEMENTS: { field: keyof ConsentConfig; label: string }[] = [
  { field: "collected", label: "What we collect" },
  { field: "not_collected", label: "What we do not collect" },
  { field: "voluntary", label: "Taking part is voluntary" },
  { field: "anonymity", label: "How the data is used" },
  { field: "age", label: "Age" },
];

export function ConsentBody({ config, onChange }: BodyProps<ConsentConfig>) {
  const set = <K extends keyof ConsentConfig>(field: K, value: ConsentConfig[K]): void =>
    onChange({ ...config, [field]: value });

  return (
    <div className="grid gap-4">
      <Field label="Heading">
        {(id) => <Input maxLength={300} id={id} value={config.title} onChange={(event) => set("title", event.target.value)} />}
      </Field>
      <Field label="Who is running this study" hint="For example: Group 4, Neuromarketing module, your university.">
        {(id) => (
          <Textarea maxLength={2000} id={id} rows={2} value={config.organiser} onChange={(event) => set("organiser", event.target.value)} />
        )}
      </Field>
      <Field label="Purpose of the study" hint="One or two plain sentences. Do not give away what you are measuring.">
        {(id) => (
          <Textarea maxLength={2000} id={id} rows={2} value={config.purpose} onChange={(event) => set("purpose", event.target.value)} />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Contact for questions">
          {(id) => (
            <Input maxLength={300}
              id={id}
              value={config.contact}
              placeholder="An email address or a name"
              onChange={(event) => set("contact", event.target.value)}
            />
          )}
        </Field>
        <Field label="Data will be deleted by">
          {(id) => (
            <Input maxLength={300}
              id={id}
              type="date"
              value={config.deletion_date ?? ""}
              className="data w-44"
              onChange={(event) => set("deletion_date", event.target.value || null)}
            />
          )}
        </Field>
      </div>
      <details className="group border border-border">
        <summary className="cursor-pointer px-3 py-2.5 text-sm select-none marker:text-muted-foreground">
          Standard statements <span className="text-muted-foreground">(already written; edit the wording if needed)</span>
        </summary>
        <div className="grid gap-4 border-t border-border p-3">
          {CONSENT_STATEMENTS.map(({ field, label }) => (
            <Field key={field} label={label}>
              {(id) => (
                <Textarea maxLength={2000}
                  id={id}
                  rows={3}
                  value={String(config[field] ?? "")}
                  onChange={(event) => set(field, event.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
      </details>
      <p className="text-sm text-muted-foreground">
        Participants must tick “I am 18 or older and I agree to take part” to start. “I don’t agree” ends the study with
        nothing saved.
      </p>
    </div>
  );
}

export function TextBody({ config, onChange }: BodyProps<TextConfig>) {
  return (
    <div className="grid gap-4">
      <Field label="Title">
        {(id) => (
          <Input maxLength={300} id={id} value={config.title} onChange={(event) => onChange({ ...config, title: event.target.value })} />
        )}
      </Field>
      <div className="grid gap-1.5">
        <span className="text-[13px] text-muted-foreground">Text</span>
        <RichText
          value={config.body_html}
          ariaLabel="Text"
          onChange={(body_html) => onChange({ ...config, body_html })}
        />
      </div>
      <Field label="Button text" hint="Pressing it goes to the next step." className="max-w-72">
        {(id) => (
          <Input
            id={id}
            value={config.button_label}
            maxLength={40}
            onChange={(event) => onChange({ ...config, button_label: event.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

function variantGridClass(count: number): string {
  return count <= 2 ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3";
}

export function StimulusBody({ config, onChange, locked, variants, images }: VariantBodyProps<StimulusConfig>) {
  return (
    <div className="grid gap-4">
      <Field
        label="Show the ad for"
        hint="A “+” is shown for 1 second first. Then the ad fills the screen, and moves on by itself."
      >
        {(id) => (
          <SecondsField
            id={id}
            valueMs={config.duration_ms}
            minSeconds={0.1}
            maxSeconds={120}
            disabled={locked}
            onChange={(duration_ms) => onChange({ ...config, duration_ms })}
          />
        )}
      </Field>
      <div className={variantGridClass(variants.length)}>
        {variants.map((variant, index) => {
          const imageId = config.images[variant.key] ?? null;
          return (
            <ImageSlot
              key={variant.key}
              heading={
                <>
                  <VariantTile index={index} label={variant.label} size="sm" />
                  <span className="truncate text-sm">{variant.label}</span>
                </>
              }
              pickerTitle={`Choose the ad for variant ${variant.label}`}
              image={imageId === null ? undefined : images.get(imageId)}
              imageId={imageId}
              disabled={locked}
              onPick={(picked) => onChange({ ...config, images: { ...config.images, [variant.key]: picked } })}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DistractorBody({ config, onChange, locked }: BodyProps<DistractorConfig>) {
  return (
    <div className="grid gap-4">
      <Field label="Instruction">
        {(id) => (
          <Textarea maxLength={2000}
            id={id}
            rows={2}
            value={config.instruction}
            onChange={(event) => onChange({ ...config, instruction: event.target.value })}
          />
        )}
      </Field>
      <Field label="Sums run for" hint="Starts when the participant presses Start, and ends by itself.">
        {(id) => (
          <SecondsField
            id={id}
            valueMs={config.duration_ms}
            minSeconds={1}
            maxSeconds={300}
            disabled={locked}
            onChange={(duration_ms) => onChange({ ...config, duration_ms })}
          />
        )}
      </Field>
    </div>
  );
}

const QUESTION_KINDS: { value: QuestionKind; label: string }[] = [
  { value: "choice", label: "Multiple choice" },
  { value: "dropdown", label: "Dropdown" },
  { value: "short_text", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "scale", label: "Linear scale" },
];

function OptionsEditor({ config, onChange, locked }: BodyProps<QuestionConfig>) {
  const setLabel = (key: string, label: string): void =>
    onChange({ ...config, options: config.options.map((option) => (option.key === key ? { ...option, label } : option)) });

  return (
    <div className="grid gap-2">
      <span className="text-[13px] text-muted-foreground">Options</span>
      {config.options.map((option, index) => (
        <div key={option.key} className="flex items-center gap-2">
          <span aria-hidden className="data w-5 text-right text-xs text-muted-foreground">
            {index + 1}
          </span>
          <Input maxLength={300}
            value={option.label}
            aria-label={`Option ${index + 1}`}
            onChange={(event) => setLabel(option.key, event.target.value)}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove option ${index + 1}`}
            disabled={locked || config.options.length <= 2}
            onClick={() => onChange({ ...config, options: config.options.filter((item) => item.key !== option.key) })}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={locked || config.options.length >= 50}
          onClick={() =>
            onChange({
              ...config,
              options: [...config.options, { key: newKey(), label: `Option ${config.options.length + 1}` }],
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add option
        </Button>
      </div>
    </div>
  );
}

function ScaleEditor({ config, onChange, locked }: BodyProps<QuestionConfig>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-2 sm:col-span-2">
        <span className="text-sm text-muted-foreground">From</span>
        <Select
          value={String(config.scale_min)}
          disabled={locked}
          onValueChange={(value) => onChange({ ...config, scale_min: Number(value) })}
        >
          <SelectTrigger className="data w-20" aria-label="Lowest value">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="1">1</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">to</span>
        <Select
          value={String(config.scale_max)}
          disabled={locked}
          onValueChange={(value) => onChange({ ...config, scale_max: Number(value) })}
        >
          <SelectTrigger className="data w-20" aria-label="Highest value">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, index) => index + 2).map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Field label={`Label for ${config.scale_min}`}>
        {(id) => (
          <Input maxLength={300}
            id={id}
            value={config.scale_min_label}
            placeholder="Not at all"
            onChange={(event) => onChange({ ...config, scale_min_label: event.target.value })}
          />
        )}
      </Field>
      <Field label={`Label for ${config.scale_max}`}>
        {(id) => (
          <Input maxLength={300}
            id={id}
            value={config.scale_max_label}
            placeholder="Very much"
            onChange={(event) => onChange({ ...config, scale_max_label: event.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

export function QuestionBody(props: BodyProps<QuestionConfig>) {
  const { config, onChange, locked } = props;
  const hasOptions = config.kind === "choice" || config.kind === "dropdown";

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Question">
          {(id) => (
            <Textarea maxLength={2000}
              id={id}
              rows={2}
              value={config.prompt}
              placeholder="What was the price in the advert?"
              onChange={(event) => onChange({ ...config, prompt: event.target.value })}
            />
          )}
        </Field>
        <Field label="Answer type">
          {(id) => (
            <Select
              value={config.kind}
              disabled={locked}
              onValueChange={(kind) => onChange({ ...config, kind: kind as QuestionKind })}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_KINDS.map((kind) => (
                  <SelectItem key={kind.value} value={kind.value}>
                    {kind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Help text (optional)">
        {(id) => (
          <Input maxLength={300} id={id} value={config.help_text} onChange={(event) => onChange({ ...config, help_text: event.target.value })} />
        )}
      </Field>
      {hasOptions && <OptionsEditor {...props} />}
      {config.kind === "choice" && (
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <label className="flex items-center gap-2.5 text-sm">
            <Switch
              checked={config.multiple}
              disabled={locked}
              onCheckedChange={(multiple) => onChange({ ...config, multiple })}
            />
            Allow several answers
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <Switch
              checked={config.allow_other}
              disabled={locked}
              onCheckedChange={(allow_other) => onChange({ ...config, allow_other })}
            />
            Add an “Other” answer with a text box
          </label>
        </div>
      )}
      {config.kind === "scale" && <ScaleEditor {...props} />}
    </div>
  );
}

export function ClickImageBody({
  config,
  onChange,
  locked,
  images,
}: BodyProps<ClickImageConfig> & { images: Map<number, LibraryImage> }) {
  return (
    <div className="grid gap-4">
      <Field label="Instruction" hint="Everyone sees the same picture here. The click position is recorded; it is not timed.">
        {(id) => (
          <Textarea maxLength={2000}
            id={id}
            rows={2}
            value={config.prompt}
            placeholder="Click where you looked first."
            onChange={(event) => onChange({ ...config, prompt: event.target.value })}
          />
        )}
      </Field>
      <div className="max-w-xs">
        <ImageSlot
          pickerTitle="Choose the picture to click on"
          image={config.image_id === null ? undefined : images.get(config.image_id)}
          imageId={config.image_id}
          disabled={locked}
          onPick={(image_id) => onChange({ ...config, image_id })}
        />
      </div>
    </div>
  );
}

export function TimedSearchBody({ config, onChange, locked, variants, images }: VariantBodyProps<TimedSearchConfig>) {
  const [drawingFor, setDrawingFor] = useState<string | null>(null);
  const drawingVariant = variants.find((variant) => variant.key === drawingFor);
  const drawingImageId = drawingFor ? (config.images[drawingFor] ?? null) : null;
  const drawingImage = drawingImageId === null ? undefined : images.get(drawingImageId);

  return (
    <div className="grid gap-4">
      <Field label="Instruction">
        {(id) => (
          <Textarea maxLength={2000}
            id={id}
            rows={2}
            value={config.instruction}
            onChange={(event) => onChange({ ...config, instruction: event.target.value })}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ready button text" hint="Pressing it shows a “+” for 1 second, then the picture.">
          {(id) => (
            <Input
              id={id}
              value={config.ready_label}
              maxLength={40}
              onChange={(event) => onChange({ ...config, ready_label: event.target.value })}
            />
          )}
        </Field>
        <Field label="Give up after" hint="Recorded as “timeout” if they have not clicked by then.">
          {(id) => (
            <SecondsField
              id={id}
              valueMs={config.timeout_ms}
              minSeconds={1}
              maxSeconds={120}
              disabled={locked}
              onChange={(timeout_ms) => onChange({ ...config, timeout_ms })}
            />
          )}
        </Field>
      </div>
      <div className={variantGridClass(variants.length)}>
        {variants.map((variant, index) => {
          const imageId = config.images[variant.key] ?? null;
          const image = imageId === null ? undefined : images.get(imageId);
          const box = config.targets[variant.key] ?? null;
          return (
            <ImageSlot
              key={variant.key}
              heading={
                <>
                  <VariantTile index={index} label={variant.label} size="sm" />
                  <span className="truncate text-sm">{variant.label}</span>
                </>
              }
              pickerTitle={`Choose the picture for variant ${variant.label}`}
              image={image}
              imageId={imageId}
              disabled={locked}
              targetBox={box}
              onPick={(picked) =>
                onChange({
                  ...config,
                  images: { ...config.images, [variant.key]: picked },
                  // A box drawn on the old picture does not describe the new one.
                  targets: { ...config.targets, [variant.key]: null },
                })
              }
              footer={
                <Button
                  variant={box ? "ghost" : "outline"}
                  size="sm"
                  className="w-full justify-start"
                  disabled={locked || !image}
                  onClick={() => setDrawingFor(variant.key)}
                >
                  {box ? (
                    <CheckIcon data-icon="inline-start" className="text-mint-ink" weight="bold" />
                  ) : (
                    <WarningIcon data-icon="inline-start" className="text-amber-ink" />
                  )}
                  {box ? "Target box set" : "Draw target box"}
                </Button>
              }
            />
          );
        })}
      </div>
      {drawingVariant && drawingImage && (
        <TargetBoxEditor
          open
          onOpenChange={(open) => !open && setDrawingFor(null)}
          imageUrl={drawingImage.url}
          variantLabel={drawingVariant.label}
          value={config.targets[drawingVariant.key] ?? null}
          onSave={(box) => onChange({ ...config, targets: { ...config.targets, [drawingVariant.key]: box } })}
        />
      )}
    </div>
  );
}
