import type { DeviceType, Pointer, TargetBox } from "../api/types";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Convert a pointer position to fractions of the displayed image, measured from its top-left corner.
 * Returns null when the position is outside the image.
 */
export function normalise(clientX: number, clientY: number, image: Rect): Point | null {
  if (image.width <= 0 || image.height <= 0) return null;
  const x = (clientX - image.left) / image.width;
  const y = (clientY - image.top) / image.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: round4(x), y: round4(y) };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Used only by the admin's preview; real runs are scored on the server. */
export function isHit(point: Point, box: TargetBox): boolean {
  return point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;
}

export function pointerKind(type: string): Pointer {
  return type === "mouse" || type === "touch" || type === "pen" ? type : "unknown";
}

/** A coarse guess from input type and screen size; the user agent is stored separately. */
export function deviceType(hasCoarsePointer: boolean, shortestScreenEdge: number): DeviceType {
  if (!hasCoarsePointer) return "desktop";
  return shortestScreenEdge < 600 ? "phone" : "tablet";
}

export interface Sum {
  text: string;
  answer: number;
}

/** A small addition or subtraction whose answer is never negative. */
export function makeSum(random: () => number = Math.random): Sum {
  const a = 2 + Math.floor(random() * 18);
  const b = 2 + Math.floor(random() * 18);
  if (random() < 0.5) return { text: `${a} + ${b}`, answer: a + b };
  const [high, low] = a >= b ? [a, b] : [b, a];
  return { text: `${high} − ${low}`, answer: high - low };
}
