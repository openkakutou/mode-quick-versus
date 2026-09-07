import { resolveSprites as defaultResolveCharacterSprites } from "../wasm/bridge.ts";
import {
  closeMatch as defaultCloseMatch,
  newMatch as defaultNewMatch,
  tick as defaultTick,
} from "../wasm/engine-bridge.ts";
import type {
  EngineResult,
  Facing,
  FighterAnimState,
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
import { type MatchConfigInput, buildNewMatchRequest } from "./match-config.ts";
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
type CloseMatchFn = typeof defaultCloseMatch;
type ResolveAnimationFramesFn = typeof defaultResolveAnimationFrames;

export interface MatchRendererOptions {
  newMatch?: NewMatchFn;
  tick?: TickFn;
  closeMatch?: CloseMatchFn;
  resolveCharacterSprites?: ResolveSpritesFn;
  resolveStageSprites?: ResolveSpritesFn;
  resolveAnimationFrames?: ResolveAnimationFramesFn;
  drawScene?: (canvas: HTMLCanvasElement, commands: DrawCommand[]) => void;
  requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  now?: () => number;
  maxTicksPerFrame?: number;
}

/** A previous call's stop function, per root element, so a new call on the same root cleans up its predecessor's loop before starting its own — mirrors `stage-viewer-web`'s own established convention. */
const activeLoopByRoot = new WeakMap<HTMLElement, () => void>();

function resolveOptions(options: MatchRendererOptions) {
  return {
    newMatch: options.newMatch ?? defaultNewMatch,
    tick: options.tick ?? defaultTick,
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

  const initialFrames = await resolveFighterSprites(created.data.animations);
  await resolveStageSprites();
  drawCurrentState(
    snapshotFighters(created.data.state.fighters),
    initialFrames,
  );

  status.remove();
  root.append(canvas, liveRegion);
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

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (rafHandle !== null) deps.cancelAnimationFrame(rafHandle);
    deps.closeMatch(matchId).catch(() => {
      // A failure to release the session is not user-visible — the
      // session simply stays resident for the life of the WASM instance,
      // same degraded-but-not-crashing behavior the bridge itself
      // documents.
    });
  }

  async function runTicks(count: number): Promise<boolean> {
    for (let i = 0; i < count; i++) {
      if (stopped) return false;
      const result: EngineResult<TickResponseData> = await deps.tick({
        matchId,
        inputs: [{}, {}],
      });
      if (!result.ok) {
        status.textContent = `Match rendering stopped: ${result.error}`;
        root.append(status);
        stop();
        return false;
      }
      latestFighterStates = snapshotFighters(result.data.state.fighters);
      latestAnimations = result.data.animations;
      stageElapsedTicks += 1;
    }
    return true;
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
      const ok = await runTicks(ticksToRun);
      if (!ok) return;
      const frames = await resolveFighterSprites(latestAnimations);
      await resolveStageSprites();
      if (stopped) return;
      drawCurrentState(latestFighterStates, frames);
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
