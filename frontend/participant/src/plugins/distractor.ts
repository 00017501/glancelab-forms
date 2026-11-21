import { type JsPsychPlugin, ParameterType, type TrialType } from "jspsych";

import { el, mount } from "../lib/dom";
import { makeSum, type Sum } from "../lib/measure";

const info = {
  name: "glance-distractor",
  version: "1.0.0",
  parameters: {
    instruction: { type: ParameterType.STRING, default: "" },
    duration_ms: { type: ParameterType.INT, default: 20000 },
    /** Awaited after "Start" and before the first sum, so the server knows this step began. */
    before_show: { type: ParameterType.FUNCTION, default: undefined },
  },
  data: {
    attempted: { type: ParameterType.INT },
    correct: { type: ParameterType.INT },
  },
} as const;

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"] as const;
// Longest answer a sum can have, so stray taps cannot build an endless number.
const MAX_DIGITS = 3;

/** Simple sums for a fixed time: a filler task between seeing the ad and being asked about it. */
export class DistractorPlugin implements JsPsychPlugin<typeof info> {
  static info = info;

  async trial(display: HTMLElement, trial: TrialType<typeof info>): Promise<{ attempted: number; correct: number }> {
    await this.showInstruction(display, trial.instruction ?? "");
    await (trial.before_show as () => Promise<void>)();
    return this.runSums(display, trial.duration_ms ?? 20000);
  }

  private showInstruction(display: HTMLElement, instruction: string): Promise<void> {
    return new Promise((resolve) => {
      mount(
        display,
        el(
          "main",
          { class: "page" },
          el("h1", { class: "page-title", text: instruction }),
          el(
            "div",
            { class: "actions" },
            el("button", {
              class: "button button-primary",
              text: "Start",
              attrs: { type: "button" },
              on: { click: () => resolve() },
            }),
          ),
        ),
      );
    });
  }

  private runSums(display: HTMLElement, durationMs: number): Promise<{ attempted: number; correct: number }> {
    return new Promise((resolve) => {
      let sum: Sum = makeSum();
      let typed = "";
      let attempted = 0;
      let correct = 0;

      const question = el("p", { class: "sum", attrs: { "aria-live": "polite" } });
      const answer = el("p", { class: "sum-answer", attrs: { "aria-label": "Your answer" } });
      const render = (): void => {
        question.textContent = `${sum.text} =`;
        answer.textContent = typed || " ";
      };

      const press = (key: string): void => {
        if (key === "⌫") typed = typed.slice(0, -1);
        else if (key === "OK") {
          if (!typed) return;
          attempted += 1;
          if (Number(typed) === sum.answer) correct += 1;
          sum = makeSum();
          typed = "";
        } else if (typed.length < MAX_DIGITS) typed += key;
        render();
      };

      const onKey = (event: KeyboardEvent): void => {
        if (/^\d$/.test(event.key)) press(event.key);
        else if (event.key === "Backspace") press("⌫");
        else if (event.key === "Enter") press("OK");
        else return;
        event.preventDefault();
      };

      const pad = el("div", { class: "pad" });
      for (const key of PAD_KEYS) {
        pad.append(
          el("button", {
            class: key === "OK" ? "pad-key pad-key-ok" : "pad-key",
            text: key,
            attrs: { type: "button", "aria-label": key === "⌫" ? "Delete" : key },
            on: { click: () => press(key) },
          }),
        );
      }
      const bar = el("div", { class: "timebar-fill" });
      bar.style.animationDuration = `${durationMs}ms`;

      document.addEventListener("keydown", onKey);
      render();
      mount(display, el("main", { class: "page page-sums" }, el("div", { class: "timebar" }, bar), question, answer, pad));

      window.setTimeout(() => {
        document.removeEventListener("keydown", onKey);
        resolve({ attempted, correct });
      }, durationMs);
    });
  }
}
