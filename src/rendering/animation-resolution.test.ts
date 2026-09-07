import { describe, expect, it } from "vitest";
import type { Animation, Frame } from "../wasm/types.ts";
import {
  findAnimationByNumber,
  resolveCurrentFrame,
} from "./animation-resolution.ts";

function frame(overrides: Partial<Frame> = {}): Frame {
  return {
    group: 0,
    image: 0,
    x: 0,
    y: 0,
    time: 1,
    flip: "",
    blend: "",
    clsn1: [],
    clsn2: [],
    ...overrides,
  };
}

describe("resolveCurrentFrame", () => {
  it("returns the frame whose cumulative time window contains animTime", () => {
    const frames = [
      frame({ image: 0, time: 5 }),
      frame({ image: 1, time: 5 }),
      frame({ image: 2, time: 5 }),
    ];

    expect(resolveCurrentFrame(frames, 0, 0).image).toBe(0);
    expect(resolveCurrentFrame(frames, 0, 4).image).toBe(0);
    expect(resolveCurrentFrame(frames, 0, 5).image).toBe(1);
    expect(resolveCurrentFrame(frames, 0, 9).image).toBe(1);
    expect(resolveCurrentFrame(frames, 0, 10).image).toBe(2);
  });

  it("holds the frame forever once animTime exceeds every frame when the last frame's time is non-positive", () => {
    const frames = [
      frame({ image: 0, time: 5 }),
      frame({ image: 1, time: -1 }),
    ];

    expect(resolveCurrentFrame(frames, 0, 5).image).toBe(1);
    expect(resolveCurrentFrame(frames, 0, 100_000).image).toBe(1);
  });

  it("wraps back to loopStart once the sequence has played through once", () => {
    const frames = [
      frame({ image: 0, time: 5 }),
      frame({ image: 1, time: 5 }),
      frame({ image: 2, time: 5 }),
    ];

    // Total duration is 15; animTime 17 is 2 ticks into a second pass,
    // wrapping to loopStart (1) then walking 2 more ticks into frame 1.
    expect(resolveCurrentFrame(frames, 1, 17).image).toBe(1);
  });

  it("defaults an out-of-range loopStart to 0 rather than producing an invalid index", () => {
    const frames = [frame({ image: 0, time: 5 }), frame({ image: 1, time: 5 })];

    // loopStart 99 is out of range; after wrapping once (animTime 12), it
    // should fall back to index 0, not throw or return undefined.
    expect(resolveCurrentFrame(frames, 99, 12).image).toBe(0);
  });

  it("returns the zero Frame for an animation with no frames at all", () => {
    expect(resolveCurrentFrame([], 0, 0)).toEqual(frame({ time: 0 }));
  });
});

describe("findAnimationByNumber", () => {
  const animations: Animation[] = [
    { number: 0, frames: [], loopStart: 0 },
    { number: 200, frames: [], loopStart: 0 },
  ];

  it("returns the animation matching the given number", () => {
    expect(findAnimationByNumber(animations, 200)?.number).toBe(200);
  });

  it("returns undefined when no animation matches", () => {
    expect(findAnimationByNumber(animations, 999)).toBeUndefined();
  });

  it("returns undefined for an empty animation list", () => {
    expect(findAnimationByNumber([], 0)).toBeUndefined();
  });
});
