import { api } from "../api/client";
import type { ParticipantStep, StepResult } from "../api/types";
import { isHit } from "../lib/measure";

/** Where step events go: the server for a real run, memory for the admin's preview. */
export interface Recorder {
  /** Resolves once it is safe to show a timed step. */
  start(stepKey: string): Promise<void>;
  finish(stepKey: string, result: StepResult): void;
  /** Resolves when the queue is empty: true when everything was stored, false when the server refused something. */
  idle(): Promise<boolean>;
}

/**
 * Sends events to the server strictly in order. jsPsych does not wait for a result to be stored
 * before it starts the next trial, so the queue is what keeps "finish step 3" ahead of "start step 4".
 *
 * Once the server refuses one event, nothing queued behind it is sent: the page and the server
 * disagree about where the run is, and sending "start" for the next timed step would mark a
 * step the participant never saw as begun.
 */
export function serverRecorder(token: string, onFailure: (error: unknown) => void): Recorder {
  let queue: Promise<unknown> = Promise.resolve();
  let hasFailed = false;
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(() => {
      if (hasFailed) throw new Error("An earlier event was refused.");
      return task();
    });
    queue = next.catch((error: unknown) => {
      if (hasFailed) return;
      hasFailed = true;
      onFailure(error);
    });
    return next;
  };
  return {
    start: (stepKey) => enqueue(() => api.startStep(token, stepKey)),
    finish: (stepKey, result) => void enqueue(() => api.finishStep(token, stepKey, result)).catch(() => {}),
    idle: () => queue.then(() => !hasFailed),
  };
}

export interface PreviewEntry {
  step: ParticipantStep;
  result: StepResult;
  /** Present for timed search only: whether the press landed in the target box. */
  hit: boolean | null;
}

/** Keeps results in memory and never calls a write endpoint. */
export function previewRecorder(steps: ParticipantStep[]): Recorder & { entries: PreviewEntry[] } {
  const entries: PreviewEntry[] = [];
  return {
    entries,
    start: () => Promise.resolve(),
    finish: (stepKey, result) => {
      const step = steps.find((candidate) => candidate.key === stepKey);
      if (!step) return;
      let hit: boolean | null = null;
      if (result.type === "timed_search" && result.x !== null && result.y !== null && step.target) {
        hit = isHit({ x: result.x, y: result.y }, step.target);
      }
      entries.push({ step, result, hit });
    },
    idle: () => Promise.resolve(true),
  };
}
