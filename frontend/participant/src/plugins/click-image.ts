import { type JsPsychPlugin, ParameterType, type TrialType } from "jspsych";

import type { Pointer } from "../api/types";
import { el, loadImage, mount } from "../lib/dom";
import { normalise, pointerKind, type Point } from "../lib/measure";

const info = {
  name: "glance-click-image",
  version: "1.0.0",
  parameters: {
    prompt: { type: ParameterType.STRING, default: "" },
    image_url: { type: ParameterType.STRING, default: undefined },
    required: { type: ParameterType.BOOL, default: true },
  },
  data: {
    /** Chosen position as fractions of the displayed image; null when skipped. */
    x: { type: ParameterType.FLOAT },
    y: { type: ParameterType.FLOAT },
    pointer: { type: ParameterType.STRING },
  },
} as const;

export interface ClickImageData {
  x: number | null;
  y: number | null;
  pointer: Pointer;
}

/** An untimed image the participant marks with one point. They can move the mark before continuing. */
export class ClickImagePlugin implements JsPsychPlugin<typeof info> {
  static info = info;

  async trial(display: HTMLElement, trial: TrialType<typeof info>): Promise<ClickImageData> {
    const image = await loadImage(trial.image_url);
    image.className = "mark-image";

    return new Promise((resolve) => {
      let chosen: Point | null = null;
      let pointer: Pointer = "unknown";
      const marker = el("div", { class: "marker", attrs: { hidden: true, "aria-hidden": "true" } });
      const frame = el("div", { class: "mark-frame" }, image, marker);
      // The image is centred inside the frame, so the mark is placed from the image's own box.
      const placeMarker = (): void => {
        if (!chosen) return;
        marker.style.left = `${image.offsetLeft + chosen.x * image.offsetWidth}px`;
        marker.style.top = `${image.offsetTop + chosen.y * image.offsetHeight}px`;
        marker.hidden = false;
      };
      window.addEventListener("resize", placeMarker);
      const button = el("button", {
        class: "button button-primary",
        text: "Continue",
        attrs: { type: "button", disabled: trial.required },
        on: {
          click: () => {
            window.removeEventListener("resize", placeMarker);
            resolve({ x: chosen?.x ?? null, y: chosen?.y ?? null, pointer });
          },
        },
      });

      image.addEventListener("pointerdown", (event) => {
        const point = normalise(event.clientX, event.clientY, image.getBoundingClientRect());
        if (!point) return;
        chosen = point;
        pointer = pointerKind(event.pointerType);
        placeMarker();
        button.disabled = false;
      });

      mount(
        display,
        el(
          "main",
          { class: "page page-with-image" },
          el("h1", { class: "page-title", text: trial.prompt }),
          frame,
          el("div", { class: "actions" }, button),
        ),
      );
    });
  }
}
