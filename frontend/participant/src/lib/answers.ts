import type { QuestionValue } from "../api/types";

// The value the server expects when the participant picked the free-text "Other" option.
export const OTHER_KEY = "__other__";

export interface QuestionData {
  value: QuestionValue;
  other: string | null;
}

/** True when an answer is filled in enough to submit. */
export function isAnswered(data: QuestionData): boolean {
  const { value } = data;
  const usesOther = value === OTHER_KEY || (Array.isArray(value) && value.includes(OTHER_KEY));
  if (usesOther && !data.other) return false;
  return !(value === null || value === "" || (Array.isArray(value) && value.length === 0));
}
