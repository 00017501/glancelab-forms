// Mirrors backend/app/schemas (forms.py, steps.py, admin.py).

export type FormStatus = "draft" | "published" | "closed";
export type StepType =
  | "consent"
  | "text"
  | "stimulus"
  | "distractor"
  | "question"
  | "click_image"
  | "timed_search";
export type QuestionKind = "choice" | "dropdown" | "short_text" | "paragraph" | "scale";

export interface Variant {
  key: string;
  label: string;
}

export interface TargetBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Maps a variant key to an image id; null until an image is chosen. */
export type VariantImages = Record<string, number | null>;

export interface ConsentConfig {
  type: "consent";
  title: string;
  organiser: string;
  purpose: string;
  collected: string;
  not_collected: string;
  voluntary: string;
  anonymity: string;
  age: string;
  contact: string;
  deletion_date: string | null;
}

export interface TextConfig {
  type: "text";
  title: string;
  body_html: string;
  button_label: string;
}

export interface StimulusConfig {
  type: "stimulus";
  duration_ms: number;
  images: VariantImages;
}

export interface DistractorConfig {
  type: "distractor";
  instruction: string;
  duration_ms: number;
}

export interface QuestionOption {
  key: string;
  label: string;
}

export interface QuestionConfig {
  type: "question";
  kind: QuestionKind;
  prompt: string;
  help_text: string;
  options: QuestionOption[];
  multiple: boolean;
  allow_other: boolean;
  scale_min: number;
  scale_max: number;
  scale_min_label: string;
  scale_max_label: string;
}

export interface ClickImageConfig {
  type: "click_image";
  prompt: string;
  image_id: number | null;
}

export interface TimedSearchConfig {
  type: "timed_search";
  instruction: string;
  ready_label: string;
  timeout_ms: number;
  images: VariantImages;
  targets: Record<string, TargetBox | null>;
}

export type StepConfig =
  | ConsentConfig
  | TextConfig
  | StimulusConfig
  | DistractorConfig
  | QuestionConfig
  | ClickImageConfig
  | TimedSearchConfig;

export interface Step {
  key: string;
  required: boolean;
  config: StepConfig;
}

export interface FormContent {
  title: string;
  block_repeats: boolean;
  variants: Variant[];
  steps: Step[];
}

export interface FormDetail extends FormContent {
  id: number;
  slug: string;
  status: FormStatus;
  consent_version: number;
  response_count: number;
  structure_locked: boolean;
  publish_problems: string[];
  updated_at: string;
}

export interface FormSummary {
  id: number;
  slug: string;
  title: string;
  status: FormStatus;
  created_at: string;
  updated_at: string;
  variant_count: number;
  step_count: number;
  completed_count: number;
  partial_count: number;
}

export interface ImageUsage {
  form_id: number;
  form_title: string;
}

export interface LibraryImage {
  id: number;
  filename: string;
  width: number;
  height: number;
  size_bytes: number;
  created_at: string;
  url: string;
  thumbnail_url: string;
  used_by: ImageUsage[];
}

export interface ImageLibrary {
  images: LibraryImage[];
  total_bytes: number;
}

export interface UploadOutcome {
  uploaded: LibraryImage[];
  failed: { filename: string; message: string }[];
}

export interface ResponseRow {
  participant_id: string;
  variant: string;
  status: "active" | "completed";
  interrupted: boolean;
  device_type: string;
  viewport_width: number;
  viewport_height: number;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  steps_done: number;
  steps_total: number;
}

export interface ResponseList {
  rows: ResponseRow[];
  variants: { label: string; completed: number; partial: number }[];
}
