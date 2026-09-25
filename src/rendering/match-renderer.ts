import { createCpuAwareInputSource } from "../cpu/cpu-input-source.ts";
import { type Hud, createHud } from "../hud/hud-renderer.ts";
import {
  type InputSourceKind,
  type TickInputPair,
  type TickInputSource,
  createTickInputSource,
} from "../input/tick-input-source.ts";
import { deriveMatchOutcome, deriveRoundOutcome } from "../result/outcome.ts";
import {
  type ResultOverlay,
  type ResultOverlayOptions,
  createResultOverlay,
} from "../result/result-screen.ts";
import { resolveSprites as defaultResolveCharacterSprites } from "../wasm/bridge.ts";
import {
  closeMatch as defaultCloseMatch,
  newMatch as defaultNewMatch,
  resetRound as defaultResetRound,
  tick as defaultTick,
} from "../wasm/engine-bridge.ts";
import type {
  CommandFileBlob,
  EngineResult,
  Facing,
  FighterAnimState,
  RoundResult,
  Side,
  TickResponseData,
} from "../wasm/engine-types.ts";
import {
  resolveAnimationFrames as defaultResolveAnimationFrames,
  resolveSprites as defaultResolveStageSprites,
} from "../wasm/stage-bridge.ts";
import type {
  BGElement,
  SpriteRef,
  StageSummary,
} from "../wasm/stage-types.ts";
import type { CharacterSummary, Frame, Sprite } from "../wasm/types.ts";
// The match scene's canvas/timer orchestration: starts a real match via
// the `engine` WASM bridge, resolves the sprites needed to draw its
// current state via the `character`/`stage` bridges (cached, see
// `sprite-pixel-cache.ts`), and drives a fixed-timestep tick loop that
// keeps the canvas in sync with `engine`'s own simulation rate. This is
// the DOM/canvas/timer glue on top of the pure `scene-composition.ts`/
// `animation-resolution.ts`/`match-config.ts`/`tick-scheduling.ts` logic —
// see `.vibe/decisions/004-match-rendering-architecture.md` for the
// design decisions this implements (engine bridge scope, timing policy,
// placeholder policy, transitional UX).
import {
  findAnimationByNumber,
  resolveCurrentFrame,
} from "./animation-resolution.ts";
import {
  type MatchConfigInput,
  buildNewMatchRequest,
  buildStartingFighters,
  resolveRoundTimerTicks,
  resolveStageBoundaries,
} from "./match-config.ts";
import {
  type DrawCommand,
  type FighterRenderInput,
  buildMatchDrawPlan,
} from "./scene-composition.ts";
import {
  type ResolveSpritesFn,
  createSpritePixelCache,
} from "./sprite-pixel-cache.ts";
import { computeTicksToRun } from "./tick-scheduling.ts";

/** Simulation ticks per second — matches `match-config.ts`'s own `TICK_RATE_HZ`. */
const TICK_INTERVAL_MS = 1000 / 60;

/** Maximum simulation ticks run per `requestAnimationFrame` callback before the backlog is dropped (see `tick-scheduling.ts`). */
const DEFAULT_MAX_TICKS_PER_FRAME = 5;

/** Canvas size fallback when a stage's own `.def` leaves `[StageInfo] localcoord` unset. */
const FALLBACK_CANVAS_WIDTH = 400;
const FALLBACK_CANVAS_HEIGHT = 240;

export interface MatchRendererCharacterInput {
  character: CharacterSummary;
  sffBytes: Uint8Array;
  /** This fighter's own already-parsed `.cmd` file (see `main.ts`'s `loadFighter`). Omitted, it falls back to an empty command file — see `match-config.ts`'s `buildFighterProgram`. */
  commands?: CommandFileBlob;
}

export interface MatchRendererStageInput {
  stage: StageSummary;
  sffBytes: Uint8Array;
}

export interface MatchRendererInput {
  player1: MatchRendererCharacterInput;
  player2: MatchRendererCharacterInput;
  stage: MatchRendererStageInput;
  config: MatchConfigInput;
  /** Who drives player 2 (backlog item 007). Defaults to `"human"` when omitted. */
  player2Control?: "human" | "cpu";
  /**
   * Called when the player activates "Back to select" on the match result
   * screen — the rendering module has no business knowing about roster/
   * stage/selection screens, so this is the caller's own escape hatch
   * (`main.ts` wires it to re-show character selection). `renderMatch`
   * always calls its own `stop()` first, releasing the `engine` session and
   * input listeners, before invoking this. See
   * `.vibe/decisions/010-round-match-result-and-cpu-opponent-design.md`.
   */
  onBackToSelect: () => void;
}

export interface MatchRendererHandle {
  /** Stops the tick loop and releases the `engine` WASM session. Idempotent. */
  stop(): void;
}

/** One fighter's position/facing snapshot for a given tick — the subset `scene-composition.ts` needs, kept separate from the rest of `FighterState` (health, velocity, stateNo) which this module never reads. */
interface FighterSnapshot {
  position: { x: number; y: number };
  facing: Facing;
}

function snapshotFighters(
  fighters: readonly [
    { position: { x: number; y: number }; facing: Facing },
    { position: { x: number; y: number }; facing: Facing },
  ],
): [FighterSnapshot, FighterSnapshot] {
  return [
    { position: fighters[0].position, facing: fighters[0].facing },
    { position: fighters[1].position, facing: fighters[1].facing },
  ];
}

type NewMatchFn = typeof defaultNewMatch;
type TickFn = typeof defaultTick;
type ResetRoundFn = typeof defaultResetRound;
type CloseMatchFn = typeof defaultCloseMatch;
type ResolveAnimationFramesFn = typeof defaultResolveAnimationFrames;

export interface MatchRendererOptions {
  newMatch?: NewMatchFn;
  tick?: TickFn;
  /** Advances to the next round once a round result's auto-advance countdown completes. Defaults to the real bridge's `resetRound`. */
  resetRound?: ResetRoundFn;
  closeMatch?: CloseMatchFn;
  resolveCharacterSprites?: ResolveSpritesFn;
  resolveStageSprites?: ResolveSpritesFn;
  resolveAnimationFrames?: ResolveAnimationFramesFn;
  drawScene?: (canvas: HTMLCanvasElement, commands: DrawCommand[]) => void;
  requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  now?: () => number;
  maxTicksPerFrame?: number;
  /**
   * Overrides the live tick input source entirely — bypassing real
   * keyboard/gamepad wiring, the same rationale every other real-effect
   * option here follows. `onSourceChange` is threaded through so the
   * caller's fake can still exercise the input-status indicator. Defaults
   * to a real `createTickInputSource({ onSourceChange })`.
   */
  createInputSource?: (
    onSourceChange: (playerIndex: 0 | 1, source: InputSourceKind) => void,
  ) => TickInputSource;
  /** Overrides the round/match result overlay entirely — for testing. Defaults to a real `createResultOverlay(options)`. */
  createResultOverlay?: (options: ResultOverlayOptions) => ResultOverlay;
}

/** A previous call's stop function, per root element, so a new call on the same root cleans up its predecessor's loop before starting its own — mirrors `stage-viewer-web`'s own established convention. */
const activeLoopByRoot = new WeakMap<HTMLElement, () => void>();

function resolveOptions(options: MatchRendererOptions) {
  return {
    newMatch: options.newMatch ?? defaultNewMatch,
    tick: options.tick ?? defaultTick,
    resetRound: options.resetRound ?? defaultResetRound,
    closeMatch: options.closeMatch ?? defaultCloseMatch,
    resolveCharacterSprites:
      options.resolveCharacterSprites ?? defaultResolveCharacterSprites,
    resolveStageSprites:
      options.resolveStageSprites ?? defaultResolveStageSprites,
    resolveAnimationFrames:
      options.resolveAnimationFrames ?? defaultResolveAnimationFrames,
    drawScene: options.drawScene ?? createCanvasSceneDrawer(),
    requestAnimationFrame:
      options.requestAnimationFrame ??
      globalThis.requestAnimationFrame?.bind(globalThis),
    cancelAnimationFrame:
      options.cancelAnimationFrame ??
      globalThis.cancelAnimationFrame?.bind(globalThis),
    now: options.now ?? (() => performance.now()),
    maxTicksPerFrame: options.maxTicksPerFrame ?? DEFAULT_MAX_TICKS_PER_FRAME,
    createInputSource:
      options.createInputSource ??
      ((
        onSourceChange: (playerIndex: 0 | 1, source: InputSourceKind) => void,
      ) => createTickInputSource({ onSourceChange })),
    createResultOverlay: options.createResultOverlay ?? createResultOverlay,
  };
}

const noopHandle: MatchRendererHandle = { stop() {} };

/**
 * Starts and renders a real match into `root`, replacing its previous
 * content (and stopping any previous loop already running on it). Shows a
 * brief "Preparing match…" status while the match starts and initial
 * sprites resolve, then a canvas kept in sync with `engine`'s own
 * simulation rate — see the ADR referenced above for the full design.
 */
export async function renderMatch(
  root: HTMLElement,
  input: MatchRendererInput,
  options: MatchRendererOptions = {},
): Promise<MatchRendererHandle> {
  activeLoopByRoot.get(root)?.();

  const deps = resolveOptions(options);

  root.replaceChildren();
  const status = document.createElement("p");
  status.className = "match-renderer__status";
  status.textContent = "Preparing match…";
  root.appendChild(status);

  const request = buildNewMatchRequest(
    input.player1.character,
    input.player2.character,
    input.stage.stage,
    input.config,
    [input.player1.commands, input.player2.commands],
  );

  const created = await deps.newMatch(request);
  if (!created.ok) {
    status.textContent = `Could not start the match: ${created.error}`;
    return noopHandle;
  }
  const matchId = created.data.matchId;

  const bgDef = input.stage.stage.bgDef;
  const canvasWidth =
    bgDef.localCoordWidth > 0 ? bgDef.localCoordWidth : FALLBACK_CANVAS_WIDTH;
  const canvasHeight =
    bgDef.localCoordHeight > 0
      ? bgDef.localCoordHeight
      : FALLBACK_CANVAS_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.className = "match-renderer__canvas";
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.tabIndex = -1;

  const liveRegion = document.createElement("p");
  liveRegion.className = "match-renderer__announcement";
  liveRegion.setAttribute("aria-live", "polite");

  const characterCaches = [
    createSpritePixelCache(),
    createSpritePixelCache(),
  ] as const;
  const stageCache = createSpritePixelCache();

  const elements = input.stage.stage.elements;
  const animAnimations = input.stage.stage.animations;
  let stageElapsedTicks = 0;
  let resolvedAnimSpriteByElementIndex = new Map<number, SpriteRef | null>();

  const characters = [
    input.player1.character,
    input.player2.character,
  ] as const;
  const sffBytesBySide = [
    input.player1.sffBytes,
    input.player2.sffBytes,
  ] as const;
  // Computed once, not per draw: a character's own sprite list never
  // changes mid-match. Kept per-side, never merged into one shared map —
  // see scene-composition.ts's BuildMatchDrawPlanInput doc comment for why.
  const fighterSpriteMetaByKey: [Map<string, Sprite>, Map<string, Sprite>] = [
    buildSpriteMetaByKey(characters[0]),
    buildSpriteMetaByKey(characters[1]),
  ];

  async function resolveFighterSprites(
    animations: readonly [FighterAnimState, FighterAnimState],
  ): Promise<[Frame, Frame]> {
    const frames = animations.map((anim, side) => {
      const animation = findAnimationByNumber(
        characters[side].animations,
        anim.animNo,
      );
      return animation
        ? resolveCurrentFrame(
            animation.frames,
            animation.loopStart,
            anim.animTime,
          )
        : resolveCurrentFrame([], 0, 0);
    }) as [Frame, Frame];

    await Promise.all(
      frames.map((frame, side) => {
        if (frame.group < 0 || frame.image < 0) return Promise.resolve();
        return characterCaches[side].resolveMissing(
          sffBytesBySide[side],
          [[frame.group, frame.image]],
          deps.resolveCharacterSprites,
        );
      }),
    );

    return frames;
  }

  async function resolveStageSprites(): Promise<void> {
    const requests: [number, number][] = [];
    for (const element of elements) {
      if (element.type === "normal" || element.type === "parallax") {
        requests.push([element.sprite.group, element.sprite.image]);
      }
    }
    if (requests.length > 0) {
      await stageCache.resolveMissing(
        input.stage.sffBytes,
        requests,
        deps.resolveStageSprites,
      );
    }

    const animElements: { element: BGElement; index: number }[] = [];
    elements.forEach((element, index) => {
      if (element.type === "anim") animElements.push({ element, index });
    });
    if (animElements.length === 0) return;

    const animResult = await deps.resolveAnimationFrames(
      animElements.map(({ element }) => ({
        animation: animAnimations[String(element.actionNumber)] ?? null,
        elapsedTicks: stageElapsedTicks,
      })),
    );
    const nextResolved = new Map<number, SpriteRef | null>();
    if (animResult.ok) {
      animElements.forEach(({ index }, i) => {
        nextResolved.set(index, animResult.sprites[i] ?? null);
      });
      const animRequests = animResult.sprites
        .filter((ref) => ref.group >= 0 && ref.image >= 0)
        .map((ref): [number, number] => [ref.group, ref.image]);
      if (animRequests.length > 0) {
        await stageCache.resolveMissing(
          input.stage.sffBytes,
          animRequests,
          deps.resolveStageSprites,
        );
      }
    } else {
      for (const { index } of animElements) nextResolved.set(index, null);
    }
    resolvedAnimSpriteByElementIndex = nextResolved;
  }

  function drawCurrentState(
    fighterStates: readonly [FighterSnapshot, FighterSnapshot],
    frames: readonly [Frame, Frame],
  ): void {
    const fighters: [FighterRenderInput, FighterRenderInput] = [
      {
        position: fighterStates[0].position,
        facing: fighterStates[0].facing,
        frame: frames[0],
      },
      {
        position: fighterStates[1].position,
        facing: fighterStates[1].facing,
        frame: frames[1],
      },
    ];
    const plan = buildMatchDrawPlan({
      elements,
      resolvedAnimSpriteByElementIndex,
      fighters,
      fighterSpriteMetaByKey,
      fighterPixelsByKey: [
        characterCaches[0].resolved,
        characterCaches[1].resolved,
      ],
      stagePixelsByKey: stageCache.resolved,
      zOffset: bgDef.zOffset,
      localCoordWidth: canvasWidth,
    });
    deps.drawScene(canvas, plan);
  }

  // Created and populated before the first drawn frame, so the HUD never
  // shows blank/zero values even for one frame -- see `.vibe/decisions/009`.
  const hud: Hud = createHud();
  hud.update(created.data.state, created.data.progress);

  const initialFrames = await resolveFighterSprites(created.data.animations);
  await resolveStageSprites();
  drawCurrentState(
    snapshotFighters(created.data.state.fighters),
    initialFrames,
  );

  status.remove();

  const inputStatus = document.createElement("p");
  inputStatus.className = "match-renderer__input-status";
  inputStatus.setAttribute("aria-live", "polite");
  // A player's input source (keyboard vs. their assigned gamepad) is a
  // real, mid-match-changeable fact -- a disconnected/reconnected gamepad
  // falls that player back to keyboard, or picks it back up -- so this
  // gets its own visible, announced status line separate from the
  // one-shot "Match started" announcement in `liveRegion` above.
  const activeSources: [InputSourceKind, InputSourceKind] = [
    "keyboard",
    "keyboard",
  ];
  function renderInputStatus(): void {
    const label = (source: InputSourceKind) =>
      source === "gamepad" ? "Gamepad" : "Keyboard";
    inputStatus.textContent = `Player 1: ${label(activeSources[0])} · Player 2: ${label(activeSources[1])}`;
  }
  const inputSource = deps.createInputSource((playerIndex, source) => {
    activeSources[playerIndex] = source;
    renderInputStatus();
  });
  renderInputStatus();

  // Composes with, rather than replaces, the human input source: player 1's
  // input is untouched; player 2's is decided by the CPU controller instead
  // of a real device, via the same `TickInputSource` contract every other
  // caller downstream already relies on. See
  // `.vibe/decisions/010-round-match-result-and-cpu-opponent-design.md`.
  const effectiveInputSource: TickInputSource =
    input.player2Control === "cpu"
      ? createCpuAwareInputSource({
          baseSource: inputSource,
          getObservation: () => ({
            self: { position: latestFighterStates[1].position },
            opponent: { position: latestFighterStates[0].position },
          }),
        })
      : inputSource;

  const resultOverlay = deps.createResultOverlay({
    onRoundResultDone: () => {
      void continueToNextRound();
    },
    onRematch: () => {
      // A fresh `renderMatch` call on the same `root` stops this instance
      // first (the existing `activeLoopByRoot` convention below), which
      // closes the old `engine` session and disposes this overlay along
      // with the input source/HUD -- restarting from round 1 with the
      // exact same characters/stage/config, no selection-screen detour.
      void renderMatch(root, input, options);
    },
    onBackToSelect: () => {
      stop();
      input.onBackToSelect();
    },
  });

  root.append(
    hud.element,
    canvas,
    liveRegion,
    inputStatus,
    resultOverlay.element,
  );
  canvas.focus();
  liveRegion.textContent = "Match started";

  let stopped = false;
  let rafHandle: number | null = null;
  // Seeded from `now()` (not the first rAF callback's own timestamp) so
  // the very first callback already has a real elapsed-time delta to work
  // with, rather than needing a "first call just establishes a baseline,
  // ticks nothing" throwaway frame.
  let lastTimestamp: number = deps.now();
  let accumulatorMs = 0;
  let latestFighterStates: readonly [FighterSnapshot, FighterSnapshot] =
    snapshotFighters(created.data.state.fighters);
  let latestAnimations = created.data.animations;
  // Kept distinct from `latestFighterStates` (a position/facing-only
  // snapshot `scene-composition.ts` needs): the HUD needs the fighters'
  // full state (health, power), which the canvas-drawing path never reads.
  let latestState = created.data.state;
  let latestProgress = created.data.progress;
  // Set by `runTicks` the instant a tick's `RoundResult` is decided
  // (`outcome !== OutcomeNone`), and consumed by `frame()` right after that
  // same frame's final sprite resolve/draw/HUD update -- see
  // `.vibe/decisions/010`.
  let pendingRoundResult: RoundResult | null = null;
  let pendingMatchOver = false;
  let pendingMatchWinner: Side = 0;

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (rafHandle !== null) deps.cancelAnimationFrame(rafHandle);
    effectiveInputSource.dispose();
    hud.dispose();
    resultOverlay.dispose();
    deps.closeMatch(matchId).catch(() => {
      // A failure to release the session is not user-visible — the
      // session simply stays resident for the life of the WASM instance,
      // same degraded-but-not-crashing behavior the bridge itself
      // documents.
    });
  }

  /**
   * Runs up to `count` simulation ticks, stopping immediately -- mid-burst,
   * before this frame's remaining catch-up ticks -- the instant a tick's
   * `RoundResult` is decided. Calling `tick()` again after a round is
   * already decided would double-count that round's win server-side (see
   * `engine`'s own `round.Progress.RecordRoundResult`), so the burst is cut
   * short rather than finishing its full `count` regardless of outcome.
   */
  async function runTicks(
    count: number,
    inputs: TickInputPair,
  ): Promise<boolean> {
    for (let i = 0; i < count; i++) {
      if (stopped) return false;
      const result: EngineResult<TickResponseData> = await deps.tick({
        matchId,
        inputs,
      });
      if (!result.ok) {
        status.textContent = `Match rendering stopped: ${result.error}`;
        root.append(status);
        stop();
        return false;
      }
      latestFighterStates = snapshotFighters(result.data.state.fighters);
      latestAnimations = result.data.animations;
      latestState = result.data.state;
      latestProgress = result.data.progress;
      stageElapsedTicks += 1;
      if (result.data.round.outcome !== 0) {
        pendingRoundResult = result.data.round;
        pendingMatchOver = result.data.matchOver;
        pendingMatchWinner = result.data.matchWinner;
        return true;
      }
    }
    return true;
  }

  /**
   * Shows the round or match result once `pendingRoundResult` is set,
   * favoring the match result when the match is also over (a round-then-
   * match double announcement would flash the round result screen for one
   * frame before immediately replacing it -- see the UX consultation).
   */
  function handleRoundOrMatchEnd(): void {
    const round = pendingRoundResult;
    const matchOver = pendingMatchOver;
    const matchWinner = pendingMatchWinner;
    pendingRoundResult = null;
    pendingMatchOver = false;
    pendingMatchWinner = 0;
    if (!round) return;

    const matchEnd = deriveMatchOutcome(matchOver, matchWinner);
    if (matchEnd) {
      resultOverlay.showMatchResult(matchEnd);
      return;
    }
    const roundEnd = deriveRoundOutcome(round, latestState.round);
    if (!roundEnd) return; // Defensive: unreachable, `round.outcome !== 0` already implied a result.
    resultOverlay.showRoundResult(roundEnd);
  }

  /**
   * Advances to the next round once a round result's auto-advance countdown
   * completes: resets both fighters to a fresh starting state via
   * `resetRound`, hides the overlay, and resumes the tick loop -- the
   * accumulator/timestamp are reset the same way match start seeds them, so
   * the first post-reset frame doesn't replay a stale accumulator as an
   * immediate catch-up burst against the fresh round.
   */
  async function continueToNextRound(): Promise<void> {
    const bounds = resolveStageBoundaries(input.stage.stage);
    const starting = buildStartingFighters(bounds);
    const roundTimer = resolveRoundTimerTicks(input.config.timeLimit);

    const result = await deps.resetRound({ matchId, roundTimer, starting });
    if (!result.ok) {
      resultOverlay.hide();
      status.textContent = `Match rendering stopped: ${result.error}`;
      root.append(status);
      stop();
      return;
    }

    latestState = result.data.state;
    latestFighterStates = snapshotFighters(result.data.state.fighters);
    latestAnimations = result.data.animations;
    stageElapsedTicks = 0;
    resultOverlay.hide();

    lastTimestamp = deps.now();
    accumulatorMs = 0;

    const frames = await resolveFighterSprites(latestAnimations);
    await resolveStageSprites();
    if (stopped) return;
    drawCurrentState(latestFighterStates, frames);
    try {
      hud.update(latestState, latestProgress);
    } catch {
      // Same narrow guard as `frame()`'s own HUD update below.
    }

    rafHandle = deps.requestAnimationFrame((ts) => void frame(ts));
  }

  async function frame(timestamp: number): Promise<void> {
    if (stopped) return;

    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    accumulatorMs += deltaMs;

    const { ticksToRun, remainderMs } = computeTicksToRun(
      accumulatorMs,
      TICK_INTERVAL_MS,
      deps.maxTicksPerFrame,
    );
    accumulatorMs = remainderMs;

    if (ticksToRun > 0) {
      // Read once per rendered frame, not once per tick: this same
      // snapshot is reused for every tick in this frame's catch-up burst —
      // see `.vibe/decisions/005-input-routing-design.md`.
      const inputs = effectiveInputSource.read();
      const ok = await runTicks(ticksToRun, inputs);
      if (!ok) return;
      const frames = await resolveFighterSprites(latestAnimations);
      await resolveStageSprites();
      if (stopped) return;
      drawCurrentState(latestFighterStates, frames);
      // Same cadence as drawCurrentState above -- once per rendered frame
      // that actually simulated, never once per tick during a catch-up
      // burst (see .vibe/decisions/009). update() is guarded internally
      // and never throws, but a narrow try/catch here is extra insurance:
      // a HUD-only failure must never reach runTicks/stop() or interrupt
      // the render loop, per the real-time-rendering consultation.
      try {
        hud.update(latestState, latestProgress);
      } catch {
        // Swallowed deliberately -- a HUD rendering defect degrades the
        // HUD, never match simulation/input handling.
      }

      if (pendingRoundResult) {
        // The round/match just ended on this exact frame's final tick: this
        // frame's own sprite resolve/draw/HUD update above already show the
        // state that decided it (the KO pose), so freezing here -- not
        // rescheduling another `requestAnimationFrame` -- is what actually
        // keeps that frame on screen behind the result overlay. See
        // `.vibe/decisions/010`.
        handleRoundOrMatchEnd();
        return;
      }
    }

    if (!stopped) {
      rafHandle = deps.requestAnimationFrame((ts) => void frame(ts));
    }
  }

  rafHandle = deps.requestAnimationFrame((ts) => void frame(ts));

  const handle: MatchRendererHandle = { stop };
  activeLoopByRoot.set(root, stop);
  return handle;
}

/** One character's own sprite metadata, keyed by `(group, image)` — never merged with another character's, since sprite numbering is only unique within one `.sff` sheet. */
function buildSpriteMetaByKey(
  character: CharacterSummary,
): Map<string, Sprite> {
  const map = new Map<string, Sprite>();
  for (const group of character.sprites) {
    for (const sprite of group.sprites) {
      map.set(`${sprite.group},${sprite.image}`, sprite);
    }
  }
  return map;
}

/**
 * The real canvas-drawing default: bakes each uniquely-resolved sprite's
 * pixels into its own offscreen canvas once (memoized by the `pixels`
 * array's own identity — the sprite cache always returns the same array
 * reference for an already-resolved sprite, never a fresh copy), then
 * `drawImage`s it with a translate/scale transform for facing/frame-flip
 * mirroring — never `putImageData` on the main canvas directly, and never
 * re-baked on a cache hit (see the ADR's realtime-rendering requirement).
 * Real pixel output is verified via a real-browser pass, not jsdom (which
 * has no `getContext("2d")` without the separate `canvas` npm package this
 * project doesn't depend on) — same convention every OpenKakutou canvas
 * feature already follows.
 */
export function createCanvasSceneDrawer(): (
  canvas: HTMLCanvasElement,
  commands: DrawCommand[],
) => void {
  const blitCache = new WeakMap<Uint8Array, HTMLCanvasElement>();

  function getOrBakeSpriteCanvas(cmd: DrawCommand): HTMLCanvasElement | null {
    if (!cmd.pixels) return null;
    const cached = blitCache.get(cmd.pixels);
    if (cached) return cached;

    const off = document.createElement("canvas");
    off.width = cmd.width;
    off.height = cmd.height;
    const offCtx = off.getContext("2d");
    if (!offCtx) return null;
    const clamped = new Uint8ClampedArray(cmd.pixels);
    offCtx.putImageData(new ImageData(clamped, cmd.width, cmd.height), 0, 0);
    blitCache.set(cmd.pixels, off);
    return off;
  }

  return (canvas, commands) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const cmd of commands) {
      ctx.save();
      ctx.translate(cmd.canvasX, cmd.canvasY);
      ctx.scale(cmd.flipH ? -1 : 1, cmd.flipV ? -1 : 1);
      const drawX = -(cmd.flipH ? cmd.width - cmd.axisX : cmd.axisX);
      const drawY = -(cmd.flipV ? cmd.height - cmd.axisY : cmd.axisY);

      if (cmd.kind === "sprite") {
        const sprite = getOrBakeSpriteCanvas(cmd);
        if (sprite) ctx.drawImage(sprite, drawX, drawY);
      } else {
        ctx.fillStyle = "rgba(255, 0, 200, 0.65)";
        ctx.fillRect(drawX, drawY, cmd.width, cmd.height);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX, drawY, cmd.width, cmd.height);
      }
      ctx.restore();
    }
  };
}
