type Child = Node | string | null | undefined | false;

interface Props {
  class?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string | boolean | undefined>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => void }>;
}

/** Create an element. Text goes in through `textContent`, so participant-visible strings are never parsed as HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  // Only rich text that the server has already sanitised is passed as `html`.
  if (props.html !== undefined) node.innerHTML = props.html;
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value === true) node.setAttribute(name, "");
    else if (value !== false && value !== undefined) node.setAttribute(name, value);
  }
  for (const [name, handler] of Object.entries(props.on ?? {})) {
    node.addEventListener(name, handler as EventListener);
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

export function mount(container: HTMLElement, ...children: Child[]): void {
  container.replaceChildren(...children.filter((child): child is Node | string => Boolean(child)));
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves with the timestamp of the next frame, in the same clock as `performance.now()`. */
export function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Load and fully decode an image, so showing it later costs no extra frames. */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "sync";
  image.draggable = false;
  image.alt = "";
  image.src = url;
  await image.decode();
  return image;
}
