import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  closeMatch,
  newMatch,
  resetEngineWasmBridgeForTests,
  tick,
} from "./engine-bridge.ts";
import type {
  FighterProgram,
  FighterState,
  NewMatchRequest,
  StateDefBlob,
} from "./engine-types.ts";
import type { Animation } from "./types.ts";

// The real WASM assets (public/wasm/, gitignored) are fetched via
// `npm run wasm:download:engine` before tests run in this environment
// (see .vibe/decisions/004: no published `engine` release exists yet, so
// this repo's copy was built locally from the sibling ../engine checkout
// in the meantime). No running dev server under jsdom, so the fetch
// effects are injected as Node-backed stubs — same approach as
// wasm/bridge.test.ts / wasm/stage-bridge.test.ts.
const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const testOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "engine-wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "engine.wasm"))),
};

beforeEach(() => {
  resetEngineWasmBridgeForTests();
});

// A minimal, self-authored two-state character (idle -> attack), the same
// "styled after real MUGEN/Ikemen idioms, not a literal downloaded file"
// convention `engine`'s own cmd/wasm/smoke.mjs fixture already established
// — reused here rather than invented independently, since it's already a
// proven-working request shape against the real module.
const attackerStates: Record<string, StateDefBlob> = {
  0: {
    number: 0,
    type: "S",
    moveType: "I",
    physics: "S",
    anim: 0,
    ctrl: true,
    controllers: [
      {
        type: "ChangeState",
        triggers: ['Command = "atk"'],
        parameters: { value: "200" },
      },
    ],
  },
  200: {
    number: 200,
    type: "S",
    moveType: "A",
    physics: "S",
    anim: 200,
    ctrl: false,
    controllers: [
      { type: "HitDef", triggers: ["Time = 0"], parameters: { damage: "30" } },
    ],
  },
};
const defenderStates: Record<string, StateDefBlob> = {
  0: {
    number: 0,
    type: "S",
    moveType: "I",
    physics: "S",
    anim: 0,
    ctrl: true,
    controllers: [],
  },
};
const attackerAnimations: Animation[] = [
  {
    number: 0,
    frames: [
      {
        group: 0,
        image: 0,
        x: 0,
        y: 0,
        time: -1,
        flip: "",
        blend: "",
        clsn1: [],
        clsn2: [],
      },
    ],
    loopStart: 0,
  },
  {
    number: 200,
    frames: [
      {
        group: 0,
        image: 0,
        x: 0,
        y: 0,
        time: 100,
        flip: "",
        blend: "",
        clsn1: [{ left: -5, top: -50, right: 5, bottom: 0 }],
        clsn2: [],
      },
    ],
    loopStart: 0,
  },
];
const defenderAnimations: Animation[] = [
  {
    number: 0,
    frames: [
      {
        group: 0,
        image: 0,
        x: 0,
        y: 0,
        time: -1,
        flip: "",
        blend: "",
        clsn1: [],
        clsn2: [{ left: -5, top: -50, right: 5, bottom: 0 }],
      },
    ],
    loopStart: 0,
  },
];
const attackerCommands = {
  remap: {},
  defaults: { time: 15, bufferTime: 1 },
  commands: [{ name: "atk", input: "a", time: 0, bufferTime: 0 }],
  states: [],
};
const emptyCommands = {
  remap: {},
  defaults: { time: 0, bufferTime: 0 },
  commands: [],
  states: [],
};

function startingFighter(side: 0 | 1, health: number): FighterState {
  return {
    side,
    position: { x: 0, y: 0 },
    facing: side === 0 ? 0 : 1,
    velocity: { x: 0, y: 0 },
    stateNo: 0,
    health,
  };
}

function buildRequest(): NewMatchRequest {
  const attackerProgram: FighterProgram = {
    states: attackerStates,
    animations: attackerAnimations,
    commands: attackerCommands,
  };
  const defenderProgram: FighterProgram = {
    states: defenderStates,
    animations: defenderAnimations,
    commands: emptyCommands,
  };
  return {
    programs: [attackerProgram, defenderProgram],
    starting: [startingFighter(0, 1000), startingFighter(1, 20)],
    roundTimer: 1000,
    bestOf: 3,
    bounds: { left: -1000, right: 1000, topBound: 0, bottomBound: 0 },
    gravity: 0,
    comboWindow: 60,
  };
}

describe("newMatch", () => {
  it("starts a new match and reports both fighters' starting animation state", async () => {
    const result = await newMatch(buildRequest(), testOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(typeof result.data.matchId).toBe("number");
    expect(result.data.state.round).toBe(1);
    expect(result.data.progress.bestOf).toBe(3);
    expect(result.data.animations[0]).toEqual({ animNo: 0, animTime: 0 });
    expect(result.data.animations[1]).toEqual({ animNo: 0, animTime: 0 });
  });

  it("returns a typed error instead of throwing for an invalid bestOf", async () => {
    const request = buildRequest();
    request.bestOf = 2; // must be a positive odd number

    const result = await newMatch(request, testOptions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });
});

describe("tick", () => {
  it("advances animTime and reports a state transition once a command matches", async () => {
    const created = await newMatch(buildRequest(), testOptions);
    if (!created.ok) throw new Error("expected an ok result");
    const matchId = created.data.matchId;

    const idle = await tick({ matchId, inputs: [{}, {}] }, testOptions);
    expect(idle.ok).toBe(true);
    if (!idle.ok) throw new Error("expected an ok result");
    expect(idle.data.animations[0]).toEqual({ animNo: 0, animTime: 1 });
    expect(idle.data.matchOver).toBe(false);

    const transitioned = await tick(
      { matchId, inputs: [{ buttons: { a: true } }, {}] },
      testOptions,
    );
    expect(transitioned.ok).toBe(true);
    if (!transitioned.ok) throw new Error("expected an ok result");
    expect(transitioned.data.animations[0]).toEqual({
      animNo: 200,
      animTime: 0,
    });

    const hit = await tick({ matchId, inputs: [{}, {}] }, testOptions);
    expect(hit.ok).toBe(true);
    if (!hit.ok) throw new Error("expected an ok result");
    expect(hit.data.state.fighters[1].health).toBe(0);
    expect(hit.data.round.outcome).not.toBe(0);
  });

  it("returns a typed error instead of throwing for an unknown match ID", async () => {
    await newMatch(buildRequest(), testOptions); // ensure the runtime is instantiated

    const result = await tick(
      { matchId: 999999, inputs: [{}, {}] },
      testOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("reuses the same instantiated module across repeated newMatch calls", async () => {
    const first = await newMatch(buildRequest(), testOptions);
    const second = await newMatch(buildRequest(), testOptions);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected ok results");
    expect(second.data.matchId).not.toBe(first.data.matchId);
  });
});

describe("closeMatch", () => {
  it("releases a session so a later tick against it errors", async () => {
    const created = await newMatch(buildRequest(), testOptions);
    if (!created.ok) throw new Error("expected an ok result");
    const matchId = created.data.matchId;

    const closed = await closeMatch(matchId, testOptions);
    expect(closed.ok).toBe(true);

    const result = await tick({ matchId, inputs: [{}, {}] }, testOptions);
    expect(result.ok).toBe(false);
  });

  it("returns a typed error instead of throwing for an unknown match ID", async () => {
    await newMatch(buildRequest(), testOptions); // ensure the runtime is instantiated

    const result = await closeMatch(999999, testOptions);

    expect(result.ok).toBe(false);
  });
});
