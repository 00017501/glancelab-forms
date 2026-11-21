import type { Step, StepConfig, StepType, Variant } from "@/api/types";

/** A short random key for a new step, variant or option. Matches the server's allowed characters. */
export function newKey(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const STEP_NAMES: Record<StepType, string> = {
  consent: "Consent",
  text: "Text screen",
  stimulus: "Ad exposure",
  distractor: "Distractor",
  question: "Question",
  click_image: "Click on image",
  timed_search: "Timed search",
};

export const STEP_HINTS: Record<Exclude<StepType, "consent">, string> = {
  text: "Instructions or a thank-you message",
  stimulus: "Show the ad for a fixed time",
  distractor: "Simple sums, to clear short-term memory",
  question: "Multiple choice, dropdown, text or scale",
  click_image: "Ask people to click a spot on a picture",
  timed_search: "Find something as fast as possible",
};

export const ADDABLE_STEPS: Exclude<StepType, "consent">[] = [
  "text",
  "stimulus",
  "distractor",
  "question",
  "click_image",
  "timed_search",
];

// Shown before every timed image; mirrors FIXATION_MS in the participant app.
export const FIXATION_MS = 1000;

export function defaultConfig(type: Exclude<StepType, "consent">): StepConfig {
  switch (type) {
    case "text":
      return { type, title: "", body_html: "", button_label: "Continue" };
    case "stimulus":
      return { type, duration_ms: 5000, images: {} };
    case "distractor":
      return {
        type,
        instruction: "Solve as many sums as you can. Type the answer and press OK.",
        duration_ms: 20000,
      };
    case "question":
      return {
        type,
        kind: "choice",
        prompt: "",
        help_text: "",
        options: [
          { key: newKey(), label: "Option 1" },
          { key: newKey(), label: "Option 2" },
        ],
        multiple: false,
        allow_other: false,
        scale_min: 1,
        scale_max: 7,
        scale_min_label: "",
        scale_max_label: "",
      };
    case "click_image":
      return { type, prompt: "", image_id: null };
    case "timed_search":
      return {
        type,
        instruction: "Click the price as fast as you can.",
        ready_label: "I'm ready",
        timeout_ms: 10000,
        images: {},
        targets: {},
      };
  }
}

export function newStep(type: Exclude<StepType, "consent">): Step {
  return { key: newKey(), required: true, config: defaultConfig(type) };
}

/** A copy of a step with fresh keys, so the copy and the original record separate answers. */
export function duplicateStep(step: Step): Step {
  const config = structuredClone(step.config);
  if (config.type === "question") {
    config.options = config.options.map((option) => ({ ...option, key: newKey() }));
  }
  return { key: newKey(), required: step.required, config };
}

/** The line shown for a step in the run-of-show: its own wording, or its type when it has none yet. */
export function stepSummary(config: StepConfig): string {
  switch (config.type) {
    case "consent":
      return config.title || "Consent";
    case "text":
      return config.title || stripHtml(config.body_html) || "Untitled text";
    case "question":
      return config.prompt || "Untitled question";
    case "click_image":
      return config.prompt || "Untitled click task";
    case "timed_search":
      return config.instruction || "Untitled search";
    case "distractor":
      return STEP_NAMES.distractor;
    case "stimulus":
      return STEP_NAMES.stimulus;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** How long a step is on a fixed clock, in milliseconds; null when the participant sets the pace. */
export function timedMs(config: StepConfig): number | null {
  if (config.type === "stimulus") return FIXATION_MS + config.duration_ms;
  if (config.type === "distractor") return config.duration_ms;
  return null;
}

export function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

/** Remove a deleted variant's images and target boxes from every step. */
export function dropVariantFromSteps(steps: Step[], variantKey: string): Step[] {
  return steps.map((step) => {
    const config = structuredClone(step.config);
    if (config.type === "stimulus" || config.type === "timed_search") delete config.images[variantKey];
    if (config.type === "timed_search") delete config.targets[variantKey];
    return { ...step, config };
  });
}

export function nextVariantLabel(variants: Variant[]): string {
  const used = new Set(variants.map((variant) => variant.label));
  for (let index = 0; index < 26; index += 1) {
    const label = String.fromCharCode(65 + index);
    if (!used.has(label)) return label;
  }
  return `Variant ${variants.length + 1}`;
}
