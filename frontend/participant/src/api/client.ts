import type { DeviceType, PreviewPayload, SessionState, StepResult, StudyInfo } from "./types";

/** An HTTP error the server answered with; `status` decides what the app does next. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// How long to wait between attempts while the connection is down.
const RETRY_DELAY_MS = 2000;

let onConnectionChange: (isDown: boolean) => void = () => {};

/** Lets the shell show a "reconnecting" notice while a request keeps failing. */
export function watchConnection(listener: (isDown: boolean) => void): void {
  onConnectionChange = listener;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (;;) {
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      // A dropped connection must not lose an answer: keep trying until it goes through.
      onConnectionChange(true);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
    onConnectionChange(false);
    if (response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
      throw new ApiError(response.status, error.code ?? "error", error.message ?? "Something went wrong.");
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}

export interface Viewport {
  device_type: DeviceType;
  viewport_width: number;
  viewport_height: number;
}

export const api = {
  study: (slug: string) => request<StudyInfo>("GET", `/api/p/studies/${encodeURIComponent(slug)}`),
  startSession: (slug: string, consentVersion: number, viewport: Viewport) =>
    request<SessionState>("POST", `/api/p/studies/${encodeURIComponent(slug)}/sessions`, {
      agreed: true,
      consent_version: consentVersion,
      ...viewport,
    }),
  resume: (token: string) => request<SessionState>("GET", `/api/p/sessions/${token}`),
  startStep: (token: string, stepKey: string) =>
    request<undefined>("POST", `/api/p/sessions/${token}/steps/${stepKey}/start`),
  finishStep: (token: string, stepKey: string, result: StepResult) =>
    request<SessionState>("POST", `/api/p/sessions/${token}/steps/${stepKey}/finish`, { result }),
  withdraw: (token: string) => request<undefined>("DELETE", `/api/p/sessions/${token}`),
  preview: (formId: string, variant: string) =>
    request<PreviewPayload>(
      "GET",
      `/api/admin/forms/${encodeURIComponent(formId)}/preview?variant=${encodeURIComponent(variant)}`,
    ),
};
