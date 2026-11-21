import { el, loadImage, mount, nextFrame, wait } from "./dom";

// How long the fixation cross is shown before a timed image appears.
export const FIXATION_MS = 1000;

/** While a timed image is on screen the page shows nothing else: no footer, no links. */
export function setTimedMode(isOn: boolean): void {
  document.body.classList.toggle("is-timed", isOn);
}

export interface ShownImage {
  image: HTMLImageElement;
  /** Timestamp of the first frame after the image became visible. */
  shownAt: number;
}

/**
 * Show a fixation cross, then the image, filling the viewport without scrolling.
 * The image is decoded before the cross appears, so the cross lasts exactly `FIXATION_MS`.
 */
export async function showAfterFixation(container: HTMLElement, url: string): Promise<ShownImage> {
  const image = await loadImage(url);
  image.className = "stage-image";
  image.style.visibility = "hidden";
  const cross = el("div", { class: "fixation", text: "+", attrs: { "aria-hidden": "true" } });
  mount(container, el("div", { class: "stage" }, cross, image));

  await wait(FIXATION_MS);
  await nextFrame();
  cross.remove();
  image.style.visibility = "visible";
  // The change above is painted in this frame; the next frame's timestamp marks when it was on screen.
  const shownAt = await nextFrame();
  return { image, shownAt };
}
