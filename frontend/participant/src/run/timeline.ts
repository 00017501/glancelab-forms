import PreloadPlugin from "@jspsych/plugin-preload";
import { initJsPsych } from "jspsych";

import type { ParticipantStep, StepResult } from "../api/types";
import { ClickImagePlugin, type ClickImageData } from "../plugins/click-image";
import { DistractorPlugin } from "../plugins/distractor";
import type { QuestionData } from "../lib/answers";
import { QuestionPlugin } from "../plugins/question";
import { StimulusPlugin } from "../plugins/stimulus";
import { TextPlugin } from "../plugins/text";
import { TimedSearchPlugin, type TimedSearchData } from "../plugins/timed-search";
import type { Recorder } from "./recorder";

type Trial = Record<string, unknown>;

/** Turn one step into a jsPsych trial that reports its start and result to the recorder. */
function toTrial(step: ParticipantStep, recorder: Recorder): Trial {
  const beforeShow = (): Promise<void> => recorder.start(step.key);
  const report = (result: StepResult): void => recorder.finish(step.key, result);

  switch (step.type) {
    case "text":
      return {
        type: TextPlugin,
        title: step.title ?? "",
        body_html: step.body_html ?? "",
        button_label: step.button_label ?? "Continue",
        on_finish: () => report({ type: "text" }),
      };
    case "stimulus":
      return {
        type: StimulusPlugin,
        image_url: step.image_url,
        duration_ms: step.duration_ms,
        before_show: beforeShow,
        on_finish: (data: { shown_ms: number }) => report({ type: "stimulus", shown_ms: data.shown_ms }),
      };
    case "distractor":
      return {
        type: DistractorPlugin,
        instruction: step.instruction ?? "",
        duration_ms: step.duration_ms,
        before_show: beforeShow,
        on_finish: (data: { attempted: number; correct: number }) =>
          report({ type: "distractor", attempted: data.attempted, correct: data.correct }),
      };
    case "question":
      return {
        type: QuestionPlugin,
        kind: step.kind,
        prompt: step.prompt ?? "",
        help_text: step.help_text ?? "",
        options: step.options ?? [],
        multiple: step.multiple ?? false,
        allow_other: step.allow_other ?? false,
        scale_min: step.scale_min ?? 1,
        scale_max: step.scale_max ?? 7,
        scale_min_label: step.scale_min_label ?? "",
        scale_max_label: step.scale_max_label ?? "",
        required: step.required,
        on_finish: (data: QuestionData) => report({ type: "question", value: data.value, other: data.other }),
      };
    case "click_image":
      return {
        type: ClickImagePlugin,
        prompt: step.prompt ?? "",
        image_url: step.image_url,
        required: step.required,
        on_finish: (data: ClickImageData) =>
          report({ type: "click_image", x: data.x, y: data.y, pointer: data.pointer }),
      };
    case "timed_search":
      return {
        type: TimedSearchPlugin,
        instruction: step.instruction ?? "",
        ready_label: step.ready_label ?? "I'm ready",
        image_url: step.image_url,
        timeout_ms: step.timeout_ms,
        before_show: beforeShow,
        on_finish: (data: TimedSearchData) =>
          report({ type: "timed_search", rt_ms: data.rt_ms, x: data.x, y: data.y, pointer: data.pointer }),
      };
  }
}

/**
 * Run the given steps in order. Every image is loaded before the first step appears.
 * Resolves true only when every result was stored.
 */
export async function runSteps(display: HTMLElement, steps: ParticipantStep[], recorder: Recorder): Promise<boolean> {
  // jsPsych adds to the element it is given; whatever screen came before must be gone first.
  display.replaceChildren();
  const jsPsych = initJsPsych({ display_element: display });
  const images = [...new Set(steps.map((step) => step.image_url).filter((url): url is string => Boolean(url)))];
  const preload: Trial = {
    type: PreloadPlugin,
    images,
    message: "<p class='hint'>Loading…</p>",
    show_progress_bar: false,
    max_load_time: 60000,
    error_message: "<p>The pictures could not be loaded. Check your connection and reload this page.</p>",
  };
  const timeline = [...(images.length ? [preload] : []), ...steps.map((step) => toTrial(step, recorder))];
  await jsPsych.run(timeline as Parameters<typeof jsPsych.run>[0]);
  return recorder.idle();
}
