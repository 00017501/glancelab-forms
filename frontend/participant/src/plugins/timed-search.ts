import { type JsPsychPlugin, ParameterType, type TrialType } from "jspsych";

import type { Pointer } from "../api/types";
import { el, mount } from "../lib/dom";
import { normalise, pointerKind } from "../lib/measure";
import { setTimedMode, showAfterFixation } from "../lib/stage";

const info = {
  name: "glance-timed-search",
  version: "1.0.0",
  parameters: {
    instruction: { type: ParameterType.STRING, default: "" },
    ready_label: { type: ParameterType.STRING, default: "I'm ready" },
    image_url: { type: ParameterType.STRING, default: undefined },
    timeout_ms: { type: ParameterType.INT, default: 10000 },
    /** Awaited after "ready" and before the image, so the server knows this step began. */
    before_show: { type: ParameterType.FUNCTION, default: undefined },
  },
  data: {
    /** Milliseconds from the image being on screen to the first press; null on timeout. */
    rt_ms: { type: ParameterType.INT },
    /** Press position as fractions of the displayed image. */
    x: { type: ParameterType.FLOAT },
    y: { type: ParameterType.FLOAT },
    pointer: { type: ParameterType.STRING },
  },
} as const;

export interface TimedSearchData {
  rt_ms: number | null;
  x: number | null;
  y: number | null;
  pointer: Pointer;
}

/** Instruction, a ready button, a fixation cross, then the image: the first press on it ends the trial. */
export class TimedSearchPlugin implements JsPsychPlugin<typeof info> {
  static info = info;

  async trial(display: HTMLElement, trial: TrialType<typeof info>): Promise<TimedSearchData> {
    await this.waitUntilReady(display, trial);
    await (trial.before_show as () => Promise<void>)();
    setTimedMode(true);
    const { image, shownAt } = await showAfterFixation(display, trial.image_url);

    const data = await new Promise<TimedSearchData>((resolve) => {
      const timer = window.setTimeout(
        () => resolve({ rt_ms: null, x: null, y: null, pointer: "unknown" }),
        trial.timeout_ms,
      );
      // `pointerdown` fires at the moment of contact; `click` would add the time until release.
      image.addEventListener("pointerdown", (event) => {
        const point = normalise(event.clientX, event.clientY, image.getBoundingClientRect());
        if (!point) return;
        window.clearTimeout(timer);
        resolve({
          rt_ms: Math.max(0, Math.round(event.timeStamp - shownAt)),
          x: point.x,
          y: point.y,
          pointer: pointerKind(event.pointerType),
        });
      });
    });

    mount(display);
    setTimedMode(false);
    return data;
  }

  private waitUntilReady(display: HTMLElement, trial: TrialType<typeof info>): Promise<void> {
    return new Promise((resolve) => {
      const button = el("button", {
        class: "button button-primary",
        text: trial.ready_label || "I'm ready",
        attrs: { type: "button" },
        on: { click: () => resolve() },
      });
      mount(
        display,
        el(
          "main",
          { class: "page" },
          el("h1", { class: "page-title", text: trial.instruction }),
          el("p", { class: "hint", text: "The picture appears after a short “+”. You get one try." }),
          el("div", { class: "actions" }, button),
        ),
      );
    });
  }
}
