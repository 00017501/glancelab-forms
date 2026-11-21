import { type JsPsychPlugin, ParameterType, type TrialType } from "jspsych";

import type { QuestionKind, QuestionOption } from "../api/types";
import { isAnswered, OTHER_KEY, type QuestionData } from "../lib/answers";
import { el, mount } from "../lib/dom";


const info = {
  name: "glance-question",
  version: "1.0.0",
  parameters: {
    kind: { type: ParameterType.STRING, default: "choice" },
    prompt: { type: ParameterType.STRING, default: "" },
    help_text: { type: ParameterType.STRING, default: "" },
    options: { type: ParameterType.COMPLEX, default: [] },
    multiple: { type: ParameterType.BOOL, default: false },
    allow_other: { type: ParameterType.BOOL, default: false },
    scale_min: { type: ParameterType.INT, default: 1 },
    scale_max: { type: ParameterType.INT, default: 7 },
    scale_min_label: { type: ParameterType.STRING, default: "" },
    scale_max_label: { type: ParameterType.STRING, default: "" },
    required: { type: ParameterType.BOOL, default: true },
  },
  data: {
    value: { type: ParameterType.COMPLEX },
    other: { type: ParameterType.STRING },
  },
} as const;

interface Field {
  node: HTMLElement;
  read: () => QuestionData;
}

let fieldCounter = 0;

function choiceField(options: QuestionOption[], multiple: boolean, allowOther: boolean): Field {
  const name = `question-${++fieldCounter}`;
  const inputs: HTMLInputElement[] = [];
  const otherText = el("input", {
    class: "text-input other-input",
    attrs: { type: "text", maxlength: "1000", "aria-label": "Other answer", placeholder: "Please say" },
  });
  const list = el("div", { class: "choices", attrs: { role: multiple ? "group" : "radiogroup" } });

  const all = allowOther ? [...options, { key: OTHER_KEY, label: "Other" }] : options;
  for (const option of all) {
    const input = el("input", { attrs: { type: multiple ? "checkbox" : "radio", name, value: option.key } });
    inputs.push(input);
    const isOther = option.key === OTHER_KEY;
    if (isOther) otherText.addEventListener("input", () => (input.checked = true));
    list.append(
      el(
        "label",
        { class: "choice" },
        input,
        el("span", { class: "choice-label", text: option.label }),
        isOther ? otherText : null,
      ),
    );
  }

  return {
    node: list,
    read: () => {
      const chosen = inputs.filter((input) => input.checked).map((input) => input.value);
      const other = chosen.includes(OTHER_KEY) ? otherText.value.trim() || null : null;
      return { value: multiple ? chosen : (chosen[0] ?? null), other };
    },
  };
}

function dropdownField(options: QuestionOption[]): Field {
  const select = el("select", { class: "text-input" }, el("option", { text: "Choose…", attrs: { value: "" } }));
  for (const option of options) select.append(el("option", { text: option.label, attrs: { value: option.key } }));
  return { node: select, read: () => ({ value: select.value || null, other: null }) };
}

function textField(kind: QuestionKind): Field {
  const input =
    kind === "paragraph"
      ? el("textarea", { class: "text-input", attrs: { rows: "5", maxlength: "5000" } })
      : el("input", { class: "text-input", attrs: { type: "text", maxlength: "300" } });
  return { node: input, read: () => ({ value: input.value.trim() || null, other: null }) };
}

function scaleField(min: number, max: number, minLabel: string, maxLabel: string): Field {
  const name = `question-${++fieldCounter}`;
  const inputs: HTMLInputElement[] = [];
  const row = el("div", { class: "scale", attrs: { role: "radiogroup" } });
  for (let value = min; value <= max; value += 1) {
    const input = el("input", { attrs: { type: "radio", name, value: String(value) } });
    inputs.push(input);
    row.append(el("label", { class: "scale-point" }, input, el("span", { text: String(value) })));
  }
  const labels = el(
    "div",
    { class: "scale-labels" },
    el("span", { text: minLabel }),
    el("span", { text: maxLabel }),
  );
  return {
    node: el("div", {}, row, minLabel || maxLabel ? labels : null),
    read: () => {
      const chosen = inputs.find((input) => input.checked);
      return { value: chosen ? Number(chosen.value) : null, other: null };
    },
  };
}

/** One question: choice, dropdown, short text, paragraph or linear scale. */
export class QuestionPlugin implements JsPsychPlugin<typeof info> {
  static info = info;

  trial(display: HTMLElement, trial: TrialType<typeof info>): Promise<QuestionData> {
    const kind = trial.kind as QuestionKind;
    const options = trial.options as QuestionOption[];
    let field: Field;
    if (kind === "choice") field = choiceField(options, trial.multiple ?? false, trial.allow_other ?? false);
    else if (kind === "dropdown") field = dropdownField(options);
    else if (kind === "scale") {
      field = scaleField(trial.scale_min ?? 1, trial.scale_max ?? 7, trial.scale_min_label ?? "", trial.scale_max_label ?? "");
    } else field = textField(kind);

    return new Promise((resolve) => {
      const button = el("button", { class: "button button-primary", text: "Continue", attrs: { type: "submit" } });
      const refresh = (): void => {
        button.disabled = trial.required ? !isAnswered(field.read()) : false;
      };
      const form = el(
        "form",
        { class: "page", attrs: { novalidate: true } },
        el("h1", { class: "page-title", text: trial.prompt }),
        trial.help_text ? el("p", { class: "hint", text: trial.help_text }) : null,
        field.node,
        trial.required ? null : el("p", { class: "hint", text: "Optional" }),
        el("div", { class: "actions" }, button),
      );
      form.addEventListener("input", refresh);
      form.addEventListener("change", refresh);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = field.read();
        if (trial.required && !isAnswered(data)) return;
        // An optional "Other" left empty is dropped rather than rejected.
        if (data.value === OTHER_KEY && !data.other) data.value = null;
        if (Array.isArray(data.value) && !data.other) data.value = data.value.filter((key) => key !== OTHER_KEY);
        resolve(data);
      });
      refresh();
      mount(display, form);
    });
  }
}
