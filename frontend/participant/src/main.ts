import "./style.css";

import { api, ApiError, watchConnection } from "./api/client";
import type { ConsentContent, SessionState } from "./api/types";
import { deviceType } from "./lib/measure";
import { previewRecorder, serverRecorder } from "./run/recorder";
import { showConsent, showPreviewSummary } from "./run/screens";
import { confirmLeave, mountFooter, setConnectionNotice, showMessage, type Footer } from "./run/shell";
import { runSteps } from "./run/timeline";

const display = document.getElementById("app") as HTMLElement;
const footerElement = document.getElementById("footer") as HTMLElement;

const CLOSE_HINT = "You can close this page now.";
// A reload is how the app recovers from a session conflict; this stops it reloading forever.
const MAX_RECOVERY_RELOADS = 2;

/** Browser storage can be unavailable (private mode, blocked site data); the study must still run. */
function readStore(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    // Nothing to do: the run continues without persistence.
  }
}

const session = (): Storage => window.sessionStorage;
const local = (): Storage => window.localStorage;

function studySlug(): string {
  const fromPath = /^\/s\/([^/]+)/.exec(window.location.pathname)?.[1];
  return fromPath ?? new URLSearchParams(window.location.search).get("study") ?? "";
}

function currentViewport(): { device_type: ReturnType<typeof deviceType>; viewport_width: number; viewport_height: number } {
  return {
    device_type: deviceType(
      window.matchMedia("(pointer: coarse)").matches,
      Math.min(window.screen.width, window.screen.height),
    ),
    viewport_width: Math.max(1, Math.round(window.innerWidth)),
    viewport_height: Math.max(1, Math.round(window.innerHeight)),
  };
}

async function runPreview(formId: string, variant: string): Promise<void> {
  const payload = await api.preview(formId, variant);
  document.title = `Preview: ${payload.title}`;
  mountFooter(footerElement, payload.consent, `Preview, variant ${payload.variant_label}. Nothing is saved.`);
  const agreed = await showConsent(display, payload.title, payload.consent);
  if (!agreed) {
    showMessage(display, "No problem", "In a real run nothing would be saved at this point.");
    return;
  }
  const recorder = previewRecorder(payload.steps);
  await runSteps(display, payload.steps, recorder);
  showPreviewSummary(display, recorder.entries, () => window.location.reload());
}

async function runSession(slug: string, state: SessionState, footer: Footer, blockRepeats: boolean): Promise<void> {
  const tokenKey = `glancelab:session:${slug}`;
  const doneKey = `glancelab:done:${slug}`;
  const recoveryKey = `glancelab:recovery:${slug}`;
  writeStore(session, tokenKey, state.token);

  const finishLocally = (): void => {
    writeStore(session, tokenKey, null);
    writeStore(session, recoveryKey, null);
    // The only thing kept in the browser afterwards: a flag, no identifier.
    if (blockRepeats) writeStore(local, doneKey, "1");
    footer.setLeave(null);
  };

  footer.setLeave(() => {
    void confirmLeave().then(async (confirmed) => {
      if (!confirmed) return;
      try {
        await api.withdraw(state.token);
      } catch {
        // Only an already-deleted session is refused; either way no data is left on the server.
      }
      finishLocally();
      // A step may still be running on this page; a fresh load is the clean way to stop it.
      writeStore(session, `glancelab:left:${slug}`, "1");
      window.location.reload();
    });
  });

  const recover = (error: unknown): void => {
    // The server refused an event, so this page and the server disagree about where the run is.
    const reloads = Number(readStore(session, recoveryKey) ?? "0");
    if (error instanceof ApiError && reloads < MAX_RECOVERY_RELOADS) {
      writeStore(session, recoveryKey, String(reloads + 1));
      window.location.reload();
      return;
    }
    footer.setLeave(null);
    showMessage(display, "Something went wrong", "Sorry, this session cannot continue. Thank you for your time.");
  };

  if (state.next_index !== null) {
    const stored = await runSteps(display, state.steps.slice(state.next_index), serverRecorder(state.token, recover));
    // Something was refused: `recover` is reloading the page so the run can continue from the server's state.
    if (!stored) return;
  }
  finishLocally();
  showMessage(display, "Thank you", `Your answers have been saved. ${CLOSE_HINT}`);
}

async function runStudy(slug: string): Promise<void> {
  const tokenKey = `glancelab:session:${slug}`;
  const info = await api.study(slug);
  document.title = info.title;
  const footer = mountFooter(footerElement, info.consent, null);

  if (readStore(session, `glancelab:left:${slug}`)) {
    showMessage(display, "You have left the study", `Everything you entered has been deleted. ${CLOSE_HINT}`);
    return;
  }

  const savedToken = readStore(session, tokenKey);
  if (savedToken) {
    try {
      // A page load with a live session is a refresh or a return: the server skips any timed step in progress.
      await runSession(slug, await api.resume(savedToken), footer, info.block_repeats);
      return;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      writeStore(session, tokenKey, null);
    }
  }

  if (info.block_repeats && readStore(local, `glancelab:done:${slug}`)) {
    showMessage(display, "You have already taken part", `Thank you. Each person can take part once. ${CLOSE_HINT}`);
    return;
  }
  if (!info.is_open) {
    showMessage(display, "This study is closed", "It is no longer accepting responses. Thank you for your interest.");
    return;
  }

  const agreed = await showConsent(display, info.title, info.consent);
  if (!agreed) {
    showMessage(display, "No problem", `Nothing was saved. ${CLOSE_HINT}`);
    return;
  }
  await startAfterConsent(slug, info.consent, footer, info.block_repeats);
}

async function startAfterConsent(
  slug: string,
  consent: ConsentContent,
  footer: Footer,
  blockRepeats: boolean,
): Promise<void> {
  try {
    const state = await api.startSession(slug, consent.version, currentViewport());
    await runSession(slug, state, footer, blockRepeats);
  } catch (error) {
    if (error instanceof ApiError && error.code === "consent_required") {
      // The wording changed while this page was open: show the new text.
      window.location.reload();
      return;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  watchConnection(setConnectionNotice);
  // A page restored from the back/forward cache would resume mid-step; a real load lets the server decide.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });

  const params = new URLSearchParams(window.location.search);
  const previewForm = params.get("preview");
  try {
    if (previewForm) await runPreview(previewForm, params.get("variant") ?? "");
    else await runStudy(studySlug());
  } catch (error) {
    const isMissing = error instanceof ApiError && error.status === 404;
    showMessage(
      display,
      isMissing ? "Study not found" : "Something went wrong",
      isMissing ? "This link is not valid. Please check it with the person who sent it." : "Please reload this page.",
    );
  }
}

void main();
