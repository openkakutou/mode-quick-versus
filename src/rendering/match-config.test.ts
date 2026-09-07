import { describe, expect, it } from "vitest";
import type { StageSummary } from "../wasm/stage-types.ts";
import type { CharacterSummary, StateDefBlob } from "../wasm/types.ts";
import {
  DEFAULT_COMBO_WINDOW,
  DEFAULT_GRAVITY,
  DEFAULT_HEALTH,
  FALLBACK_STAGE_HALF_WIDTH,
  STARTING_OFFSET,
  TICK_RATE_HZ,
  UNLIMITED_ROUND_TIMER_TICKS,
  buildFighterProgram,
  buildNewMatchRequest,
  buildStartingFighters,
  resolveRoundTimerTicks,
  resolveStageBoundaries,
} from "./match-config.ts";

function character(
  overrides: Partial<CharacterSummary> = {},
): CharacterSummary {
  return {
    name: "Test Character",
    animations: [],
    sprites: [],
    stateDefs: [],
    ...overrides,
  };
}

function stage(overrides: Partial<StageSummary> = {}): StageSummary {
  return {
    name: "Test Stage",
    bgDef: {
      spriteFile: "",
      localCoordWidth: 0,
      localCoordHeight: 0,
      zOffset: 0,
      zoomOut: 0,
      zoomIn: 0,
      modelFile: "",
      xScale: 1,
      yScale: 1,
    },
    elements: [],
    animations: {},
    stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
    ...overrides,
  };
}

describe("buildFighterProgram", () => {
  it("keys state defs by their number, as a string, matching Go's map[int]T JSON encoding", () => {
    const stateDefs: StateDefBlob[] = [
      { number: 0, type: "S" },
      { number: 200, type: "S" },
    ];

    const program = buildFighterProgram(character({ stateDefs }));

    expect(Object.keys(program.states).sort()).toEqual(["0", "200"]);
    expect(program.states["200"]).toEqual({ number: 200, type: "S" });
  });

  it("carries the character's animations through unchanged", () => {
    const animations = [{ number: 0, frames: [], loopStart: 0 }];

    const program = buildFighterProgram(character({ animations }));

    expect(program.animations).toBe(animations);
  });

  it("skips a state def whose number field isn't a usable integer, instead of building an invalid key", () => {
    const stateDefs: StateDefBlob[] = [
      { number: 0, type: "S" },
      { type: "S" }, // missing `number` entirely — malformed
    ];

    const program = buildFighterProgram(character({ stateDefs }));

    expect(Object.keys(program.states)).toEqual(["0"]);
  });

  it("falls back to an empty command file when none is supplied", () => {
    const program = buildFighterProgram(character());

    expect(program.commands).toEqual({
      remap: {},
      defaults: { time: 0, bufferTime: 0 },
      commands: [],
      states: [],
    });
  });

  it("uses the supplied parsed command file when provided, instead of the empty fallback", () => {
    const commands = {
      remap: { a: "a" },
      defaults: { time: 15, bufferTime: 1 },
      commands: [{ name: "a", input: "a", time: 1, bufferTime: 1 }],
      states: [],
    };

    const program = buildFighterProgram(character(), commands);

    expect(program.commands).toBe(commands);
  });
});

describe("resolveStageBoundaries", () => {
  it("uses the stage's own boundaries when they form a valid range", () => {
    const bounds = resolveStageBoundaries(
      stage({
        stageBoundaries: {
          left: -150,
          right: 150,
          topBound: 0,
          bottomBound: 0,
        },
      }),
    );

    expect(bounds).toEqual({
      left: -150,
      right: 150,
      topBound: 0,
      bottomBound: 0,
    });
  });

  it("falls back to half the stage's local coordinate width when boundaries are unset (left >= right)", () => {
    const bounds = resolveStageBoundaries(
      stage({
        bgDef: {
          spriteFile: "",
          localCoordWidth: 400,
          localCoordHeight: 240,
          zOffset: 0,
          zoomOut: 0,
          zoomIn: 0,
          modelFile: "",
          xScale: 1,
          yScale: 1,
        },
      }),
    );

    expect(bounds.left).toBe(-200);
    expect(bounds.right).toBe(200);
  });

  it("falls back to a fixed constant when both boundaries and local coordinate width are unset", () => {
    const bounds = resolveStageBoundaries(stage());

    expect(bounds.left).toBe(-FALLBACK_STAGE_HALF_WIDTH);
    expect(bounds.right).toBe(FALLBACK_STAGE_HALF_WIDTH);
  });

  it("falls back when the stage's boundaries are inverted (left > right), not just equal", () => {
    const bounds = resolveStageBoundaries(
      stage({
        stageBoundaries: {
          left: 100,
          right: -100,
          topBound: 0,
          bottomBound: 0,
        },
      }),
    );

    expect(bounds.left).toBeLessThan(bounds.right);
  });
});

describe("buildStartingFighters", () => {
  it("places both fighters symmetrically around the stage center, facing each other, grounded", () => {
    const [p1, p2] = buildStartingFighters({
      left: -200,
      right: 200,
      topBound: 0,
      bottomBound: 0,
    });

    expect(p1.side).toBe(0);
    expect(p2.side).toBe(1);
    expect(p1.position.x).toBeLessThan(0);
    expect(p2.position.x).toBeGreaterThan(0);
    expect(p1.position.x).toBe(-p2.position.x);
    expect(p1.facing).toBe(0); // right
    expect(p2.facing).toBe(1); // left
    expect(p1.position.y).toBe(0);
    expect(p2.position.y).toBe(0);
    expect(p1.health).toBe(DEFAULT_HEALTH);
    expect(p2.health).toBe(DEFAULT_HEALTH);
  });

  it("clamps the starting offset to stay within a narrow stage's own boundaries", () => {
    const [p1, p2] = buildStartingFighters({
      left: -10,
      right: 10,
      topBound: 0,
      bottomBound: 0,
    });

    expect(p1.position.x).toBeGreaterThanOrEqual(-10);
    expect(p2.position.x).toBeLessThanOrEqual(10);
  });

  it("uses the standard starting offset on a wide stage", () => {
    const [p1, p2] = buildStartingFighters({
      left: -1000,
      right: 1000,
      topBound: 0,
      bottomBound: 0,
    });

    expect(p1.position.x).toBe(-STARTING_OFFSET);
    expect(p2.position.x).toBe(STARTING_OFFSET);
  });
});

describe("resolveRoundTimerTicks", () => {
  it("converts a numeric seconds time limit to simulation ticks at the tick rate", () => {
    expect(resolveRoundTimerTicks({ seconds: 99 })).toBe(99 * TICK_RATE_HZ);
  });

  it("uses a large fixed tick count for an unlimited time limit", () => {
    expect(resolveRoundTimerTicks("unlimited")).toBe(
      UNLIMITED_ROUND_TIMER_TICKS,
    );
  });

  it("treats a zero-second time limit as zero ticks, not a fallback", () => {
    expect(resolveRoundTimerTicks({ seconds: 0 })).toBe(0);
  });
});

describe("buildNewMatchRequest", () => {
  it("assembles a complete request from both characters, the stage, and the setup config", () => {
    const p1 = character({ name: "P1", stateDefs: [{ number: 0, type: "S" }] });
    const p2 = character({ name: "P2", stateDefs: [{ number: 0, type: "S" }] });

    const request = buildNewMatchRequest(p1, p2, stage(), {
      rounds: 3,
      timeLimit: { seconds: 60 },
    });

    expect(request.bestOf).toBe(3);
    expect(request.roundTimer).toBe(60 * TICK_RATE_HZ);
    expect(request.gravity).toBe(DEFAULT_GRAVITY);
    expect(request.comboWindow).toBe(DEFAULT_COMBO_WINDOW);
    expect(request.starting[0].side).toBe(0);
    expect(request.starting[1].side).toBe(1);
    expect(request.programs[0].states["0"]).toEqual({ number: 0, type: "S" });
  });

  it("threads each player's own supplied command file into their own program, never swapped or merged", () => {
    const p1 = character({ name: "P1" });
    const p2 = character({ name: "P2" });
    const p1Commands = {
      remap: {},
      defaults: { time: 15, bufferTime: 1 },
      commands: [{ name: "p1-only", input: "a", time: 1, bufferTime: 1 }],
      states: [],
    };
    const p2Commands = {
      remap: {},
      defaults: { time: 15, bufferTime: 1 },
      commands: [{ name: "p2-only", input: "b", time: 1, bufferTime: 1 }],
      states: [],
    };

    const request = buildNewMatchRequest(
      p1,
      p2,
      stage(),
      { rounds: 3, timeLimit: { seconds: 60 } },
      [p1Commands, p2Commands],
    );

    expect(request.programs[0].commands).toBe(p1Commands);
    expect(request.programs[1].commands).toBe(p2Commands);
  });

  it("falls back to an empty command file per player when no commands are supplied at all", () => {
    const request = buildNewMatchRequest(character(), character(), stage(), {
      rounds: 3,
      timeLimit: { seconds: 60 },
    });

    expect(request.programs[0].commands).toEqual({
      remap: {},
      defaults: { time: 0, bufferTime: 0 },
      commands: [],
      states: [],
    });
  });
});
