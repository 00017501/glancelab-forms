import {
  CalculatorIcon,
  CrosshairIcon,
  CursorClickIcon,
  ImageIcon,
  QuestionIcon,
  ShieldCheckIcon,
  TextAlignLeftIcon,
  type Icon,
} from "@phosphor-icons/react";

import type { StepType } from "@/api/types";

const ICONS: Record<StepType, Icon> = {
  consent: ShieldCheckIcon,
  text: TextAlignLeftIcon,
  stimulus: ImageIcon,
  distractor: CalculatorIcon,
  question: QuestionIcon,
  click_image: CursorClickIcon,
  timed_search: CrosshairIcon,
};

export function StepIcon({ type, className }: { type: StepType; className?: string }) {
  const Glyph = ICONS[type];
  return <Glyph className={className} aria-hidden />;
}
