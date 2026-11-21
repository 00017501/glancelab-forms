import { type JsPsychPlugin, ParameterType, type TrialType } from "jspsych";

import { el, mount } from "../lib/dom";

const info = {
  name: "glance-text",
  version: "1.0.0",
  parameters: {
    title: { type: ParameterType.STRING, default: "" },
    /** Rich text, already sanitised by the server. */
    body_html: { type: ParameterType.HTML_STRING, default: "" },
    button_label: { type: ParameterType.STRING, default: "Continue" },
  },
  data: {},
} as const;

/** A screen of text with one button: instructions, transitions, thank-you. */
export class TextPlugin implements JsPsychPlugin<typeof info> {
  static info = info;

  trial(display: HTMLElement, trial: TrialType<typeof info>): Promise<Record<string, never>> {
    return new Promise((resolve) => {
      const button = el("button", {
        class: "button button-primary",
        text: trial.button_label || "Continue",
        attrs: { type: "button" },
        on: { click: () => resolve({}) },
      });
      mount(
        display,
        el(
          "main",
          { class: "page" },
          trial.title ? el("h1", { class: "page-title", text: trial.title }) : null,
          trial.body_html ? el("div", { class: "prose", html: trial.body_html }) : null,
          el("div", { class: "actions" }, button),
        ),
      );
      button.focus({ preventScroll: true });
    });
  }
}
