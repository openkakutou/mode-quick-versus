import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TickInputPair } from "../input/tick-input-source.ts";
import type {
  NewMatchResponseData,
  TickResponseData,
} from "../wasm/engine-types.ts";
import type { EngineResult } from "../wasm/engine-types.ts";
import type { StageSummary } from "../wasm/stage-types.ts";
import type { CharacterSummary } from "../wasm/types.ts";
import { renderMatch } from "./match-renderer.ts";
import type {
  MatchRendererInput,
  MatchRendererOptions,
} from "./match-renderer.ts";
import type { DrawCommand } from "./scene-composition.ts";

function character(): CharacterSummary {
  return {
    name: "Fighter",
    animations: [
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
    ],
    sprites: [
      {
        index: 0,
        sprites: [
          {
            group: 0,
            image: 0,
            width: 40,
            height: 80,
            axisX: 20,
            axisY: 79,
            palette: 0,
          },
        ],
      },
    ],
    stateDefs: [{ number: 0, type: "S" }],
  };
}

function stage(): StageSummary {
  return {
    name: "Stage",
    bgDef: {
      spriteFile: "",
      localCoordWidth: 400,
      localCoordHeight: 240,
      zOffset: 200,
      zoomOut: 1,
      zoomIn: 1,
      modelFile: "",
      xScale: 1,
      yScale: 1,
    },
    elements: [],
    animations: {},
    stageBoundaries: { left: -200, right: 200, topBound: 0, bottomBound: 0 },
  };
}

function newMatchResponse(matchId = 1): EngineResult<NewMatchResponseData> {
  return {
    ok: true,
    data: {
      matchId,
      state: {
        round: 1,
        roundTimer: 6000,
        fighters: [
          {
            side: 0,
            position: { x: -70, y: 0 },
            facing: 0,
            velocity: { x: 0, y: 0 },
            stateNo: 0,
            health: 1000,
          },
          {
            side: 1,
            position: { x: 70, y: 0 },
            facing: 1,
            velocity: { x: 0, y: 0 },
            stateNo: 0,
            health: 1000,
          },
        ],
      },
      progress: { bestOf: 3, wins: [0, 0], roundsPlayed: 0 },
      animations: [
        { animNo: 0, animTime: 0 },
        { animNo: 0, animTime: 0 },
      ],
    },
  };
}

function tickResponse(): EngineResult<TickResponseData> {
  const created = newMatchResponse();
  if (!created.ok) throw new Error("expected an ok result");
  const base = created.data;
  return {
    ok: true,
    data: {
      state: base.state,
      round: { outcome: 0, winner: 0 },
      progress: base.progress,
      matchOver: false,
      matchWinner: 0,
      animations: [
        { animNo: 0, animTime: 1 },
        { animNo: 0, animTime: 1 },
      ],
    },
  };
}

function baseInput(): MatchRendererInput {
  return {
    player1: { character: character(), sffBytes: new Uint8Array([1]) },
    player2: { character: character(), sffBytes: new Uint8Array([2]) },
    stage: { stage: stage(), sffBytes: new Uint8Array([3]) },
    config: { rounds: 3, timeLimit: { seconds: 99 } },
  };
}

function baseOptions(
  overrides: Partial<MatchRendererOptions> = {},
): MatchRendererOptions & { rafCallbacks: ((ts: number) => void)[] } {
  const rafCallbacks: ((ts: number) => void)[] = [];
  return {
    newMatch: vi.fn(async () => newMatchResponse()),
    tick: vi.fn(async () => tickResponse()),
    closeMatch: vi.fn(async () => ({ ok: true as const, data: {} })),
    resolveCharacterSprites: vi.fn(async (_sff, requests) =>
      requests.map(() => ({
        ok: true as const,
        pixels: new Uint8Array(40 * 80 * 4),
        width: 40,
        height: 80,
      })),
    ),
    resolveStageSprites: vi.fn(async () => []),
    resolveAnimationFrames: vi.fn(async () => ({
      ok: true as const,
      sprites: [],
    })),
    drawScene: vi.fn(),
    requestAnimationFrame: vi.fn((cb: (ts: number) => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }),
    cancelAnimationFrame: vi.fn(),
    now: vi.fn(() => 0),
    rafCallbacks,
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("renderMatch", () => {
  it("shows a preparing status synchronously, before any async work resolves", () => {
    const root = document.createElement("div");
    const options = baseOptions();

    void renderMatch(root, baseInput(), options);

    expect(root.textContent).toContain("Preparing match");
  });

  it("mounts a canvas sized to the stage's local coordinate dimensions once ready, and announces the match has started", async () => {
    const root = document.createElement("div");
    const options = baseOptions();

    await renderMatch(root, baseInput(), options);

    const canvas = root.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.width).toBe(400);
    expect(canvas?.height).toBe(240);
    const liveRegion = root.querySelector("[aria-live]");
    expect(liveRegion?.textContent).toContain("Match started");
  });

  it("draws the initial frame before the tick loop starts", async () => {
    const root = document.createElement("div");
    const options = baseOptions();

    await renderMatch(root, baseInput(), options);

    expect(options.drawScene).toHaveBeenCalledTimes(1);
  });

  it("shows a clear error status instead of a blank/broken screen when newMatch fails", async () => {
    const root = document.createElement("div");
    const options = baseOptions({
      newMatch: vi.fn(async () => ({ ok: false as const, error: "boom" })),
    });

    await renderMatch(root, baseInput(), options);

    expect(root.querySelector("canvas")).toBeNull();
    expect(root.textContent).toContain("boom");
  });

  it("degrades to a placeholder draw command instead of crashing when a fighter's sprite fails to resolve", async () => {
    const root = document.createElement("div");
    const options = baseOptions({
      resolveCharacterSprites: vi.fn(async (_sff, requests) =>
        requests.map(() => ({ ok: false as const, error: "sprite not found" })),
      ),
    });

    await renderMatch(root, baseInput(), options);

    const plan = (options.drawScene as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as DrawCommand[];
    expect(plan.some((c) => c.kind === "placeholder")).toBe(true);
  });

  it("advances the simulation and redraws once a full tick interval has elapsed", async () => {
    const root = document.createElement("div");
    let currentTime = 0;
    const options = baseOptions({ now: vi.fn(() => currentTime) });

    const handle = await renderMatch(root, baseInput(), options);
    expect(options.rafCallbacks).toHaveLength(1);

    currentTime = 1000 / 60 + 1; // just over one tick interval
    options.rafCallbacks[0](currentTime);
    await vi.waitFor(() => {
      expect(options.drawScene).toHaveBeenCalledTimes(2); // initial + this tick
    });
    expect(options.tick).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it("stop() cancels the loop and releases the engine session", async () => {
    const root = document.createElement("div");
    const options = baseOptions();

    const handle = await renderMatch(root, baseInput(), options);
    handle.stop();

    expect(options.cancelAnimationFrame).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(options.closeMatch).toHaveBeenCalledWith(1);
    });
  });

  it("a stray already-scheduled frame does nothing after stop()", async () => {
    const root = document.createElement("div");
    let currentTime = 0;
    const options = baseOptions({ now: vi.fn(() => currentTime) });

    const handle = await renderMatch(root, baseInput(), options);
    handle.stop();
    (options.tick as ReturnType<typeof vi.fn>).mockClear();

    currentTime = 1000; // plenty of elapsed time
    options.rafCallbacks[0]?.(currentTime);
    await Promise.resolve();

    expect(options.tick).not.toHaveBeenCalled();
  });

  it("stops a previous render loop on the same root before starting a new one", async () => {
    const root = document.createElement("div");
    const first = baseOptions();
    const firstHandle = await renderMatch(root, baseInput(), first);
    void firstHandle;

    const second = baseOptions();
    await renderMatch(root, baseInput(), second);

    expect(first.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("threads each player's own supplied command file into the newMatch request, never swapped between them", async () => {
    const root = document.createElement("div");
    const options = baseOptions();
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
    const input = baseInput();
    input.player1.commands = p1Commands;
    input.player2.commands = p2Commands;

    await renderMatch(root, input, options);

    const request = (options.newMatch as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(request.programs[0].commands).toEqual(p1Commands);
    expect(request.programs[1].commands).toEqual(p2Commands);
  });

  function fakeInputSource(inputs: TickInputPair) {
    return {
      read: vi.fn(() => inputs),
      dispose: vi.fn(),
    };
  }

  it("reads live input once per frame and threads it into every tick() call run that frame, even across a multi-tick catch-up burst", async () => {
    const root = document.createElement("div");
    let currentTime = 0;
    const inputs: TickInputPair = [
      {
        up: true,
        down: false,
        left: false,
        right: false,
        buttons: { a: true, b: false, c: false, x: false, y: false, z: false },
      },
      {
        up: false,
        down: false,
        left: false,
        right: false,
        buttons: { a: false, b: false, c: false, x: false, y: false, z: false },
      },
    ];
    const inputSource = fakeInputSource(inputs);
    const options = baseOptions({
      now: vi.fn(() => currentTime),
      createInputSource: vi.fn(() => inputSource),
    });

    await renderMatch(root, baseInput(), options);
    // 3 full tick intervals elapsed at once -> a multi-tick catch-up burst.
    currentTime = (1000 / 60) * 3 + 1;
    options.rafCallbacks[0](currentTime);
    await vi.waitFor(() => {
      expect(options.tick).toHaveBeenCalledTimes(3);
    });

    expect(inputSource.read).toHaveBeenCalledTimes(1);
    for (const call of (options.tick as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0].inputs).toBe(inputs);
    }
  });

  it("disposes the input source when stop() is called", async () => {
    const root = document.createElement("div");
    const inputSource = fakeInputSource([
      {
        up: false,
        down: false,
        left: false,
        right: false,
        buttons: { a: false, b: false, c: false, x: false, y: false, z: false },
      },
      {
        up: false,
        down: false,
        left: false,
        right: false,
        buttons: { a: false, b: false, c: false, x: false, y: false, z: false },
      },
    ]);
    const options = baseOptions({
      createInputSource: vi.fn(() => inputSource),
    });

    const handle = await renderMatch(root, baseInput(), options);
    handle.stop();

    expect(inputSource.dispose).toHaveBeenCalled();
  });

  it("shows a live status line reflecting each player's active input source, updating when a source changes", async () => {
    const root = document.createElement("div");
    let onSourceChange:
      | ((playerIndex: 0 | 1, source: "keyboard" | "gamepad") => void)
      | undefined;
    const inputSource = fakeInputSource([
      {
        up: false,
        down: false,
        left: false,
        right: false,
        buttons: { a: false, b: false, c: false, x: false, y: false, z: false },
      },
      {
        up: false,
        down: false,
        left: false,
        right: false,
        buttons: { a: false, b: false, c: false, x: false, y: false, z: false },
      },
    ]);
    const options = baseOptions({
      createInputSource: vi.fn((onChange) => {
        onSourceChange = onChange;
        return inputSource;
      }),
    });

    await renderMatch(root, baseInput(), options);

    const status = root.querySelector(".match-renderer__input-status");
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain("Keyboard");

    onSourceChange?.(0, "gamepad");

    expect(status?.textContent).toContain("Gamepad");
  });
});
