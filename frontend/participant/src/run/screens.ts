import type { ConsentContent } from "../api/types";
import { el, mount } from "../lib/dom";
import type { PreviewEntry } from "./recorder";
import { consentSections } from "./shell";

/** The mandatory first screen. Resolves true on agreement, false on "I don't agree". */
export function showConsent(display: HTMLElement, studyTitle: string, consent: ConsentContent): Promise<boolean> {
  return new Promise((resolve) => {
    const checkbox = el("input", { attrs: { type: "checkbox", id: "consent-agree" } });
    const start = el("button", {
      class: "button button-primary",
      text: "Start",
      attrs: { type: "button", disabled: true },
      on: { click: () => resolve(true) },
    });
    const decline = el("button", {
      class: "button",
      text: "I don't agree",
      attrs: { type: "button" },
      on: { click: () => resolve(false) },
    });
    checkbox.addEventListener("change", () => (start.disabled = !checkbox.checked));

    mount(
      display,
      el(
        "main",
        { class: "page" },
        el("p", { class: "eyebrow", text: studyTitle }),
        el("h1", { class: "page-title", text: consent.title }),
        consentSections(consent),
        el(
          "label",
          { class: "choice consent-agree", attrs: { for: "consent-agree" } },
          checkbox,
          el("span", { class: "choice-label", text: "I am 18 or older and I agree to take part." }),
        ),
        el("div", { class: "actions" }, start, decline),
      ),
    );
  });
}

function describe(entry: PreviewEntry): string {
  const { result } = entry;
  switch (result.type) {
    case "text":
      return "Continued";
    case "stimulus":
      return `Shown for ${result.shown_ms} ms`;
    case "distractor":
      return `${result.correct} of ${result.attempted} sums correct`;
    case "question": {
      const labels = new Map((entry.step.options ?? []).map((option) => [option.key, option.label]));
      const values = Array.isArray(result.value) ? result.value : result.value === null ? [] : [result.value];
      const text = values.map((value) => labels.get(String(value)) ?? (value === "__other__" ? "Other" : value));
      return (text.join(", ") || "No answer") + (result.other ? ` (${result.other})` : "");
    }
    case "click_image":
      return result.x === null ? "No click" : `Clicked at x ${result.x}, y ${result.y} (${result.pointer})`;
    case "timed_search":
      if (result.rt_ms === null) return "Timed out";
      return `${entry.hit ? "Hit" : "Miss"} in ${result.rt_ms} ms at x ${result.x}, y ${result.y} (${result.pointer})`;
  }
}

const STEP_NAMES: Record<string, string> = {
  text: "Text screen",
  stimulus: "Ad exposure",
  distractor: "Distractor",
  question: "Question",
  click_image: "Click on image",
  timed_search: "Timed search",
};

/** Shown at the end of a preview: what a real run would have recorded. */
export function showPreviewSummary(display: HTMLElement, entries: PreviewEntry[], onRestart: () => void): void {
  const rows = entries.map((entry, index) =>
    el(
      "tr",
      {},
      el("td", { text: String(index + 2) }),
      el("td", { text: STEP_NAMES[entry.step.type] ?? entry.step.type }),
      el("td", { text: describe(entry) }),
    ),
  );
  mount(
    display,
    el(
      "main",
      { class: "page" },
      el("h1", { class: "page-title", text: "End of preview" }),
      el("p", { class: "lead", text: "This is what would have been recorded. Nothing was saved." }),
      el(
        "table",
        { class: "summary" },
        el("thead", {}, el("tr", {}, el("th", { text: "Step" }), el("th", { text: "Type" }), el("th", { text: "Recorded" }))),
        el("tbody", {}, ...rows),
      ),
      el(
        "div",
        { class: "actions" },
        el("button", {
          class: "button button-primary",
          text: "Run again",
          attrs: { type: "button" },
          on: { click: onRestart },
        }),
      ),
    ),
  );
}
