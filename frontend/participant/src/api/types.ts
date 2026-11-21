// Mirrors backend/app/schemas/participant.py and results.py.

export type StepType =
  | "text"
  | "stimulus"
  | "distractor"
  | "question"
  | "click_image"
  | "timed_search";

export type QuestionKind = "choice" | "dropdown" | "short_text" | "paragraph" | "scale";
export type DeviceType = "phone" | "tablet" | "desktop";
export type Pointer = "mouse" | "touch" | "pen" | "unknown";

export interface ConsentContent {
  version: number;
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

export interface StudyInfo {
  title: string;
  is_open: boolean;
  block_repeats: boolean;
  consent: ConsentContent;
}

export interface QuestionOption {
  key: string;
  label: string;
}

export interface TargetBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParticipantStep {
  key: string;
  type: StepType;
  required: boolean;
  title: string | null;
  body_html: string | null;
  button_label: string | null;
  prompt: string | null;
  help_text: string | null;
  instruction: string | null;
  ready_label: string | null;
  duration_ms: number | null;
  timeout_ms: number | null;
  image_url: string | null;
  kind: QuestionKind | null;
  options: QuestionOption[] | null;
  multiple: boolean | null;
  allow_other: boolean | null;
  scale_min: number | null;
  scale_max: number | null;
  scale_min_label: string | null;
  scale_max_label: string | null;
  target: TargetBox | null;
}

export interface SessionState {
  participant_id: string;
  token: string;
  steps: ParticipantStep[];
  next_index: number | null;
  interrupted: boolean;
}

export interface PreviewPayload {
  title: string;
  variant_label: string;
  consent: ConsentContent;
  steps: ParticipantStep[];
}

export type QuestionValue = string | number | string[] | null;

export type StepResult =
  | { type: "text" }
  | { type: "stimulus"; shown_ms: number }
  | { type: "distractor"; attempted: number; correct: number }
  | { type: "question"; value: QuestionValue; other: string | null }
  | { type: "click_image"; x: number | null; y: number | null; pointer: Pointer }
  | { type: "timed_search"; rt_ms: number | null; x: number | null; y: number | null; pointer: Pointer };
