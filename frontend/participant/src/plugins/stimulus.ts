import { type JsPsychPlugin, ParameterType, type TrialType } from "jspsych";

import { mount, nextFrame } from "../lib/dom";
import { setTimedMode, showAfterFixation } from "../lib/stage";

const info = {
  name: "glance-stimulus",
  version: "1.0.0",
  parameters: {
    image_url: { type: ParameterType.STRING, default: undefined },
    duration_ms: { type: ParameterType.INT, default: undefined },
    /** Awaited before anything is shown, so the server knows this step began and will never replay it. */
    before_show: { type: ParameterType.FUNCTION, default: undefined },
  },
  data: {
    /** How long the image was actually on screen, measured frame to frame. */
    shown_ms: { type: ParameterType.INT },
  },
} as const;

/** Shows the assigned ad for a fixed time. No pause, no way back, no controls. */
export class StimulusPlugin implements JsPsychPlugin<typeof info> {
  static info = info;

  async trial(display: HTMLElement, trial: TrialType<typeof info>): Promise<{ shown_ms: number }> {
    await (trial.before_show as () => Promise<void>)();
    setTimedMode(true);
    const { shownAt } = await showAfterFixation(display, trial.image_url);

    // Wait on frames rather than a timer, so the image leaves on the first frame past the duration.
    let now = shownAt;
    while (now - shownAt < trial.duration_ms) {
      now = await nextFrame();
    }
    mount(display);
    const hiddenAt = await nextFrame();
    setTimedMode(false);
    return { shown_ms: Math.round(hiddenAt - shownAt) };
  }
}
