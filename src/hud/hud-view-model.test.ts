import { describe, expect, it } from "vitest";
import { clampPercent, deriveHudViewModel } from "./hud-view-model.ts";

const MAX_HEALTH = 1000;
const MAX_POWER = 3000;

function validState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    round: 2,
    roundTimer: 3000,
    fighters: [
      { side: 0, health: 800, power: 450 },
      { side: 1, health: 300, power: 1500 },
    ],
    ...overrides,
  };
}

function validProgress(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    bestOf: 3,
    wins: [1, 0],
    roundsPlayed: 1,
    ...overrides,
  };
}

describe("clampPercent", () => {
  it("computes a plain percentage of value over max", () => {
    expect(clampPercent(50, 200)).toBe(25);
  });

  it("clamps a value above max to 100", () => {
    expect(clampPercent(5000, 3000)).toBe(100);
  });

  it("treats a non-positive max as 0% rather than dividing by zero", () => {
    expect(clampPercent(10, 0)).toBe(0);
    expect(clampPercent(10, -5)).toBe(0);
  });

  it("treats a non-finite value as 0%", () => {
    expect(clampPercent(Number.NaN, 100)).toBe(0);
    expect(clampPercent(Number.POSITIVE_INFINITY, 100)).toBe(0);
  });
});

describe("deriveHudViewModel", () => {
  it("derives both fighters' health/power percentages and the round info from valid state", () => {
    const result = deriveHudViewModel(
      validState(),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.data.fighters[0]).toEqual({
      healthPercent: 80,
      powerPercent: 15,
    });
    expect(result.data.fighters[1]).toEqual({
      healthPercent: 30,
      powerPercent: 50,
    });
    expect(result.data.roundInfo).toEqual({
      round: 2,
      wins: [1, 0],
      bestOf: 3,
    });
  });

  it("treats a fighter at exactly 0 health as a valid KO state, not an error", () => {
    const result = deriveHudViewModel(
      validState({
        fighters: [
          { side: 0, health: 0, power: 0 },
          { side: 1, health: 640, power: 0 },
        ],
      }),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.data.fighters[0].healthPercent).toBe(0);
  });

  it("clamps a power value above the placeholder cap to 100% rather than erroring", () => {
    const result = deriveHudViewModel(
      validState({
        fighters: [
          { side: 0, health: 1000, power: MAX_POWER + 500 },
          { side: 1, health: 1000, power: 0 },
        ],
      }),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.data.fighters[0].powerPercent).toBe(100);
  });

  it("returns a typed error instead of throwing when state is not an object", () => {
    const result = deriveHudViewModel(
      null,
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("returns a typed error instead of throwing when a fighter's health is missing", () => {
    const result = deriveHudViewModel(
      validState({
        fighters: [
          { side: 0, power: 450 },
          { side: 1, health: 300, power: 1500 },
        ],
      }),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("health");
  });

  it("returns a typed error instead of throwing when a fighter's health is negative", () => {
    const result = deriveHudViewModel(
      validState({
        fighters: [
          { side: 0, health: -10, power: 0 },
          { side: 1, health: 300, power: 0 },
        ],
      }),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
  });

  it("returns a typed error instead of throwing when a fighter's power is NaN", () => {
    const result = deriveHudViewModel(
      validState({
        fighters: [
          { side: 0, health: 800, power: Number.NaN },
          { side: 1, health: 300, power: 0 },
        ],
      }),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("power");
  });

  it("returns a typed error instead of throwing when there are not exactly 2 fighters", () => {
    const result = deriveHudViewModel(
      validState({ fighters: [{ side: 0, health: 800, power: 0 }] }),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
  });

  it("returns a typed error instead of throwing when the round number is missing", () => {
    const result = deriveHudViewModel(
      validState({ round: undefined }),
      validProgress(),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("round");
  });

  it("returns a typed error instead of throwing when progress is not an object", () => {
    const result = deriveHudViewModel(
      validState(),
      "nope",
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
  });

  it("returns a typed error instead of throwing when progress.wins does not have exactly 2 numeric entries", () => {
    const result = deriveHudViewModel(
      validState(),
      validProgress({ wins: [1] }),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("wins");
  });

  it("returns a typed error instead of throwing when progress.bestOf is missing", () => {
    const result = deriveHudViewModel(
      validState(),
      validProgress({ bestOf: undefined }),
      MAX_HEALTH,
      MAX_POWER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("bestOf");
  });
});
