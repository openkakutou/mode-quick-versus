import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TickInputPair } from "../input/tick-input-source.ts";
import type { ResultOverlayOptions } from "../result/result-screen.ts";
import type {
  NewMatchResponseData,
  ResetRoundResponseData,
} from "../wasm/engine-types.ts";
import type { TickResponseData } from "../wasm/engine-types.ts";
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
            power: 0,
          },
          {
            side: 1,
            position: { x: 70, y: 0 },
            facing: 1,
            velocity: { x: 0, y: 0 },
            stateNo: 0,
            health: 1000,
            power: 0,
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

function tickResponse(
  overrides: Partial<TickResponseData> = {},
): EngineResult<TickResponseData> {
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
      ...overrides,
    },
  };
}

function resetRoundResponse(): EngineResult<ResetRoundResponseData> {
  const created = newMatchResponse();
  if (!created.ok) throw new Error("expected an ok result");
  return {
    ok: true,
    data: {
      state: { ...created.data.state, round: 2 },
      animations: [
        { animNo: 0, animTime: 0 },
        { animNo: 0, animTime: 0 },
      ],
    },
  };
}

function baseInput(
  overrides: Partial<MatchRendererInput> = {},
): MatchRendererInput {
  return {
    player1: { character: character(), sffBytes: new Uint8Array([1]) },
    player2: { character: character(), sffBytes: new Uint8Array([2]) },
    stage: { stage: stage(), sffBytes: new Uint8Array([3]) },
    config: { rounds: 3, timeLimit: { seconds: 99 } },
    onBackToSelect: vi.fn(),
    ...overrides,
  };
}

/**
 * A fake result overlay double: instead of a real DOM/timer-driven overlay
 * (`result/result-screen.ts`), this exposes the exact `ResultOverlayOptions`
 * `renderMatch` constructed it with, so a test can drive
 * `onRoundResultDone`/`onRematch`/`onBackToSelect` directly and assert on
 * `showRoundResult`/`showMatchResult`'s own call arguments -- without
 * depending on the real overlay's countdown timer at all (already covered
 * by `result/result-screen.test.ts`).
 */
function fakeResultOverlay() {
  const overlay = {
    element: document.createElement("div"),
    showRoundResult: vi.fn(),
    showMatchResult: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };
  let capturedOptions: ResultOverlayOptions | null = null;
  const createResultOverlay = vi.fn((options: ResultOverlayOptions) => {
    capturedOptions = options;
    return overlay;
  });
  return {
    overlay,
    createResultOverlay,
    options: () => {
      if (!capturedOptions) throw new Error("result overlay not created yet");
      return capturedOptions;
    },
  };
}

function baseOptions(
  overrides: Partial<MatchRendererOptions> = {},
): MatchRendererOptions & {
  rafCallbacks: ((ts: number) => void)[];
  resultOverlay: ReturnType<typeof fakeResultOverlay>;
} {
  const rafCallbacks: ((ts: number) => void)[] = [];
  const resultOverlay = fakeResultOverlay();
  return {
    newMatch: vi.fn(async () => newMatchResponse()),
    tick: vi.fn(async () => tickResponse()),
    resetRound: vi.fn(async () => resetRoundResponse()),
    closeMatch: vi.fn(async () => ({ ok: true as const, data: {} })),
    createResultOverlay: resultOverlay.createResultOverlay,
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
    resultOverlay,
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
    const liveRegion = root.querySelector(".match-renderer__announcement");
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

  describe("in-match HUD (backlog item 004)", () => {
    it("mounts the HUD before the canvas, already populated with the match's starting health/round/wins", async () => {
      const root = document.createElement("div");
      const options = baseOptions();

      await renderMatch(root, baseInput(), options);

      const hud = root.querySelector(".hud");
      if (!hud) throw new Error("expected the HUD to be mounted");
      const canvas = root.querySelector("canvas");
      if (!canvas) throw new Error("expected the canvas to be mounted");
      // The HUD must precede the canvas in the DOM (see .vibe/decisions/009).
      expect(
        hud.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      const p1Health = root.querySelector(".hud__health--1");
      expect(p1Health?.getAttribute("aria-valuenow")).toBe("1000");
      const roundBlock = root.querySelector(".hud__round");
      expect(roundBlock?.textContent).toContain("1");
    });

    it("updates the HUD once per simulated frame, in sync with the tick loop", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const damagedTick = vi.fn(async () => {
        const base = tickResponse();
        if (!base.ok) throw new Error("expected an ok result");
        return {
          ok: true as const,
          data: {
            ...base.data,
            state: {
              ...base.data.state,
              fighters: [
                { ...base.data.state.fighters[0], health: 640 },
                base.data.state.fighters[1],
              ] as [
                (typeof base.data.state.fighters)[0],
                (typeof base.data.state.fighters)[1],
              ],
            },
          },
        };
      });
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: damagedTick,
      });

      await renderMatch(root, baseInput(), options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);

      await vi.waitFor(() => {
        expect(
          root.querySelector(".hud__health--1")?.getAttribute("aria-valuenow"),
        ).toBe("640");
      });
    });

    it("degrades only the HUD to its error state on malformed match state, without stopping the match or the render loop", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const malformedTick = vi.fn(async () => {
        const base = tickResponse();
        if (!base.ok) throw new Error("expected an ok result");
        return {
          ok: true as const,
          data: {
            ...base.data,
            // Position/facing/stateNo (what canvas rendering reads) stay
            // valid -- only health is malformed, the realistic shape of a
            // HUD-only data problem per .vibe/decisions/009's scope (the
            // HUD validates its own health/power/round/wins fields; it is
            // not responsible for the position/facing fields rendering
            // already trusts, backlog item 005's own pre-existing scope).
            state: {
              ...base.data.state,
              fighters: [
                { ...base.data.state.fighters[0], health: Number.NaN },
                base.data.state.fighters[1],
              ] as [
                (typeof base.data.state.fighters)[0],
                (typeof base.data.state.fighters)[1],
              ],
            },
          },
        };
      });
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: malformedTick,
      });

      await renderMatch(root, baseInput(), options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);

      await vi.waitFor(() => {
        expect(root.querySelector(".hud__error")?.hasAttribute("hidden")).toBe(
          false,
        );
      });
      // The match/render loop itself is unaffected by the HUD-only failure.
      expect(options.cancelAnimationFrame).not.toHaveBeenCalled();
      expect(root.querySelector("canvas")).not.toBeNull();
      expect(root.querySelector(".match-renderer__status")).toBeNull();
    });
  });

  describe("round/match result flow (backlog item 007)", () => {
    it("stops calling tick() the instant a round is decided, even mid-burst, and shows the round result", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const tickMock = vi
        .fn()
        .mockResolvedValueOnce(tickResponse())
        .mockResolvedValueOnce(
          tickResponse({ round: { outcome: 1, winner: 0 } }),
        )
        .mockResolvedValueOnce(tickResponse());
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: tickMock,
      });

      await renderMatch(root, baseInput(), options);
      // 3 full tick intervals elapsed at once -> a would-be 3-tick burst.
      currentTime = (1000 / 60) * 3 + 1;
      options.rafCallbacks[0](currentTime);

      await vi.waitFor(() => {
        expect(
          options.resultOverlay.overlay.showRoundResult,
        ).toHaveBeenCalled();
      });
      // Only 2 of the 3 ticks ran -- the 3rd would have double-counted an
      // already-decided round.
      expect(tickMock).toHaveBeenCalledTimes(2);
      expect(
        options.resultOverlay.overlay.showRoundResult,
      ).toHaveBeenCalledWith({ round: 1, winner: "p1" });
      // The loop is frozen, not rescheduled -- requestAnimationFrame was
      // only ever called once, at match start.
      expect(options.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    it("shows the match result instead of the round result when the match is also decided this tick", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: vi.fn(async () =>
          tickResponse({
            round: { outcome: 1, winner: 1 },
            matchOver: true,
            matchWinner: 1,
          }),
        ),
      });

      await renderMatch(root, baseInput(), options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);

      await vi.waitFor(() => {
        expect(
          options.resultOverlay.overlay.showMatchResult,
        ).toHaveBeenCalled();
      });
      expect(
        options.resultOverlay.overlay.showMatchResult,
      ).toHaveBeenCalledWith({ winner: "p2" });
      expect(
        options.resultOverlay.overlay.showRoundResult,
      ).not.toHaveBeenCalled();
    });

    it("resolves a double KO to a draw round result, not to either side", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: vi.fn(async () =>
          tickResponse({ round: { outcome: 2, winner: 0 } }),
        ),
      });

      await renderMatch(root, baseInput(), options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);

      await vi.waitFor(() => {
        expect(
          options.resultOverlay.overlay.showRoundResult,
        ).toHaveBeenCalledWith({ round: 1, winner: "draw" });
      });
    });

    it("resets to a fresh next round and resumes the tick loop once the round result's auto-advance fires", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: vi.fn(async () =>
          tickResponse({ round: { outcome: 1, winner: 0 } }),
        ),
      });

      await renderMatch(root, baseInput(), options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);
      await vi.waitFor(() => {
        expect(
          options.resultOverlay.overlay.showRoundResult,
        ).toHaveBeenCalled();
      });

      options.resultOverlay.options().onRoundResultDone();

      await vi.waitFor(() => {
        expect(options.resetRound).toHaveBeenCalled();
      });
      const request = (options.resetRound as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(request.matchId).toBe(1);
      expect(request.roundTimer).toBe(99 * 60); // baseInput()'s 99s config.
      expect(request.starting).toHaveLength(2);
      expect(request.starting[0].health).toBe(1000);
      expect(request.starting[1].health).toBe(1000);
      // The loop actually resumed: a second requestAnimationFrame was
      // scheduled once the reset's own async sprite/HUD work settles, and a
      // further elapsed frame ticks again.
      await vi.waitFor(() => {
        expect(options.requestAnimationFrame).toHaveBeenCalledTimes(2);
      });
      expect(options.resultOverlay.overlay.hide).toHaveBeenCalled();

      currentTime += 1000 / 60 + 1;
      options.rafCallbacks[1](currentTime);
      await vi.waitFor(() => {
        expect(options.tick).toHaveBeenCalledTimes(2);
      });
    });

    it("shows a clear error and stops the match instead of getting stuck when resetRound fails", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: vi.fn(async () =>
          tickResponse({ round: { outcome: 1, winner: 0 } }),
        ),
        resetRound: vi.fn(async () => ({ ok: false as const, error: "boom" })),
      });

      await renderMatch(root, baseInput(), options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);
      await vi.waitFor(() => {
        expect(
          options.resultOverlay.overlay.showRoundResult,
        ).toHaveBeenCalled();
      });

      options.resultOverlay.options().onRoundResultDone();

      await vi.waitFor(() => {
        expect(options.cancelAnimationFrame).toHaveBeenCalled();
      });
      expect(root.textContent).toContain("boom");
      expect(options.resultOverlay.overlay.hide).toHaveBeenCalled();
    });

    it("rematch restarts a fresh match with the same characters/stage/config, without any selection-screen involvement", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: vi.fn(async () =>
          tickResponse({
            round: { outcome: 1, winner: 0 },
            matchOver: true,
            matchWinner: 0,
          }),
        ),
      });
      const input = baseInput();

      await renderMatch(root, input, options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);
      await vi.waitFor(() => {
        expect(
          options.resultOverlay.overlay.showMatchResult,
        ).toHaveBeenCalled();
      });

      options.resultOverlay.options().onRematch();

      await vi.waitFor(() => {
        expect(options.newMatch).toHaveBeenCalledTimes(2);
      });
      const [firstCall, secondCall] = (
        options.newMatch as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(secondCall[0]).toEqual(firstCall[0]);
      expect(input.onBackToSelect).not.toHaveBeenCalled();
    });

    it("back to select stops the match (releasing the engine session and input listeners) before invoking the caller's callback", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        tick: vi.fn(async () =>
          tickResponse({
            round: { outcome: 1, winner: 0 },
            matchOver: true,
            matchWinner: 0,
          }),
        ),
      });
      const input = baseInput();

      await renderMatch(root, input, options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);
      await vi.waitFor(() => {
        expect(
          options.resultOverlay.overlay.showMatchResult,
        ).toHaveBeenCalled();
      });

      options.resultOverlay.options().onBackToSelect();

      expect(options.cancelAnimationFrame).toHaveBeenCalled();
      await vi.waitFor(() => {
        expect(options.closeMatch).toHaveBeenCalledWith(1);
      });
      expect(input.onBackToSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe("CPU opponent (backlog item 007)", () => {
    it("drives player 2 via the CPU controller from live fighter positions when player2Control is 'cpu', leaving player 1's own input untouched", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const baseSourceInputs: TickInputPair = [
        {
          up: true,
          down: false,
          left: false,
          right: false,
          buttons: {
            a: false,
            b: false,
            c: false,
            x: false,
            y: false,
            z: false,
          },
        },
        {
          up: false,
          down: false,
          left: false,
          right: false,
          buttons: {
            a: false,
            b: false,
            c: false,
            x: false,
            y: false,
            z: false,
          },
        },
      ];
      const inputSource = fakeInputSource(baseSourceInputs);
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        createInputSource: vi.fn(() => inputSource),
      });

      // baseInput()'s fixture starts player 1 at x=-70, player 2 at x=70
      // (see newMatchResponse()) -- player 2, to the right, must walk left
      // toward player 1.
      await renderMatch(root, baseInput({ player2Control: "cpu" }), options);
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);

      await vi.waitFor(() => {
        expect(options.tick).toHaveBeenCalledTimes(1);
      });
      const request = (options.tick as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(request.inputs[0].up).toBe(true); // player 1 passed through untouched.
      expect(request.inputs[1].left).toBe(true); // player 2 decided by the CPU.
      expect(request.inputs[1].right).toBe(false);
    });

    it("leaves player 2 on the real input source (keyboard/gamepad) when player2Control is 'human' or omitted", async () => {
      const root = document.createElement("div");
      let currentTime = 0;
      const inputs: TickInputPair = [
        {
          up: false,
          down: false,
          left: false,
          right: false,
          buttons: {
            a: false,
            b: false,
            c: false,
            x: false,
            y: false,
            z: false,
          },
        },
        {
          up: false,
          down: false,
          left: false,
          right: true,
          buttons: {
            a: false,
            b: false,
            c: false,
            x: false,
            y: false,
            z: false,
          },
        },
      ];
      const inputSource = fakeInputSource(inputs);
      const options = baseOptions({
        now: vi.fn(() => currentTime),
        createInputSource: vi.fn(() => inputSource),
      });

      await renderMatch(root, baseInput(), options); // no player2Control set.
      currentTime = 1000 / 60 + 1;
      options.rafCallbacks[0](currentTime);

      await vi.waitFor(() => {
        expect(options.tick).toHaveBeenCalledTimes(1);
      });
      const request = (options.tick as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      // Exactly what the real (fake) input source produced -- never
      // overwritten by the CPU path.
      expect(request.inputs[1].right).toBe(true);
    });
  });
});
