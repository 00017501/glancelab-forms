import { describe, expect, it } from "vitest";

import { isAnswered } from "./answers";
import { deviceType, isHit, makeSum, normalise, pointerKind } from "./measure";

describe("normalise", () => {
  const image = { left: 100, top: 50, width: 400, height: 200 };

  it("measures from the image's top-left corner, not the page's", () => {
    expect(normalise(100, 50, image)).toEqual({ x: 0, y: 0 });
    expect(normalise(300, 150, image)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalise(500, 250, image)).toEqual({ x: 1, y: 1 });
  });

  it("gives the same fractions whatever size the image is displayed at", () => {
    const small = { left: 0, top: 0, width: 200, height: 100 };
    expect(normalise(50, 25, small)).toEqual(normalise(200, 100, image));
  });

  it("ignores positions outside the image", () => {
    expect(normalise(99, 100, image)).toBeNull();
    expect(normalise(300, 251, image)).toBeNull();
    expect(normalise(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });
});

describe("isHit", () => {
  it("includes the edges of the box", () => {
    const box = { x: 0.2, y: 0.2, w: 0.2, h: 0.1 };
    expect(isHit({ x: 0.2, y: 0.2 }, box)).toBe(true);
    expect(isHit({ x: 0.4, y: 0.3 }, box)).toBe(true);
    expect(isHit({ x: 0.41, y: 0.25 }, box)).toBe(false);
  });
});

describe("deviceType", () => {
  it("separates phones, tablets and desktops", () => {
    expect(deviceType(true, 390)).toBe("phone");
    expect(deviceType(true, 820)).toBe("tablet");
    expect(deviceType(false, 390)).toBe("desktop");
  });
});

describe("pointerKind", () => {
  it("falls back to unknown", () => {
    expect(pointerKind("touch")).toBe("touch");
    expect(pointerKind("")).toBe("unknown");
  });
});

describe("makeSum", () => {
  it("never asks for a negative answer and states the answer it expects", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      let state = seed;
      const random = (): number => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
      };
      const sum = makeSum(random);
      const [left, operator, right] = sum.text.split(" ");
      const expected = operator === "+" ? Number(left) + Number(right) : Number(left) - Number(right);
      expect(sum.answer).toBe(expected);
      expect(sum.answer).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("isAnswered", () => {
  it("needs text when Other is chosen", () => {
    expect(isAnswered({ value: "__other__", other: null })).toBe(false);
    expect(isAnswered({ value: ["a", "__other__"], other: "sofa" })).toBe(true);
  });

  it("treats empty values as unanswered and zero as an answer", () => {
    expect(isAnswered({ value: null, other: null })).toBe(false);
    expect(isAnswered({ value: [], other: null })).toBe(false);
    expect(isAnswered({ value: 0, other: null })).toBe(true);
  });
});
