import { describe, expect, it } from "vitest";
import { computeTicksToRun } from "./tick-scheduling.ts";

describe("computeTicksToRun", () => {
  it("runs zero ticks when less than one tick interval has accumulated", () => {
    const result = computeTicksToRun(10, 16.6, 5);
    expect(result.ticksToRun).toBe(0);
    expect(result.remainderMs).toBe(10);
  });

  it("runs exactly one tick and keeps the leftover remainder", () => {
    const result = computeTicksToRun(20, 16.6, 5);
    expect(result.ticksToRun).toBe(1);
    expect(result.remainderMs).toBeCloseTo(3.4, 5);
  });

  it("runs several ticks in one call when multiple intervals accumulated, under the cap", () => {
    const result = computeTicksToRun(50, 16.6, 5);
    expect(result.ticksToRun).toBe(3); // floor(50/16.6) = 3
  });

  it("caps ticks at maxTicksPerFrame and drops the rest of the backlog entirely", () => {
    // A very long gap (e.g. a backgrounded tab) would otherwise demand
    // dozens of ticks in one frame -- capped, and the remainder is
    // discarded (resync to wall time) rather than carried forward, per
    // .vibe/decisions/004 point 8.
    const result = computeTicksToRun(1000, 16.6, 5);
    expect(result.ticksToRun).toBe(5);
    expect(result.remainderMs).toBe(0);
  });

  it("runs zero ticks for zero accumulated time", () => {
    const result = computeTicksToRun(0, 16.6, 5);
    expect(result.ticksToRun).toBe(0);
    expect(result.remainderMs).toBe(0);
  });
});
