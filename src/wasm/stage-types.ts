// Minimal typed mirror of the JSON contract published by the `stage`
// WASM module (`OpenKakutouStage.load`/`resolveSprites`/
// `resolveAnimationFrames`) — only the fields this app actually consumes
// (see `stage-viewer-web`'s `src/wasm/types.ts` for the full contract,
// which this repo does not need to duplicate). Field name matches the
// Go-side `json:"..."` tag exactly. 3D stage fields (`model`, `scaling`,
// `playerStartZ`) are out of scope — this app only composes 2D
// sprite-based stages (see `.vibe/decisions/004`).

/** A sprite reference within the stage's sprite sheet (`stage.SpriteRef`). A negative `group`/`image` (`{-1,-1}`) is the "nothing to draw" blank sentinel `stage`'s own resolution functions return for malformed/empty input. */
export interface SpriteRef {
  group: number;
  image: number;
}

/** How a BG element is drawn/animated (`stage.BGElementType`). */
export type BGElementType = "normal" | "parallax" | "anim" | string;

/** A single background element/layer (`stage.BGElement`). */
export interface BGElement {
  name: string;
  type: BGElementType;
  sprite: SpriteRef;
  actionNumber: number;
  layerNo: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  tileX: number;
  tileY: number;
  tileSpacingX: number;
  tileSpacingY: number;
}

/** Stage-level settings applying to the whole stage (`stage.BGdef`). */
export interface BGdef {
  spriteFile: string;
  localCoordWidth: number;
  localCoordHeight: number;
  zOffset: number;
  zoomOut: number;
  zoomIn: number;
  modelFile: string;
  xScale: number;
  yScale: number;
}

/** One frame of a `[Begin Action N]` animation block (`stage.BGAnimFrame`), the same shape as `character`'s own `.air` frame line. */
export interface BGAnimFrame {
  sprite: SpriteRef;
  time: number;
}

/** A stage BG animation action (`stage.BGAnimation`), resolved by `resolveAnimationFrames` against elapsed playback ticks. */
export interface BGAnimation {
  frames: BGAnimFrame[];
  loopStart: number;
}

/** The x-range characters may move within on this stage (`stage.StageBoundaries`). */
export interface StageBoundaries {
  left: number;
  right: number;
  topBound: number;
  bottomBound: number;
}

/** The subset of a loaded stage's data this app consumes: its name, stage-level settings, BG elements/layers, animation blocks, and character movement boundaries. 3D-only fields are out of scope (see module doc comment). */
export interface StageSummary {
  name: string;
  bgDef: BGdef;
  elements: BGElement[];
  animations: Record<string, BGAnimation>;
  stageBoundaries: StageBoundaries;
}

/**
 * Result of the typed bridge wrapper: exactly one of `stage`/`error` is
 * ever meaningful, mirroring the WASM module's own `{stage, error}`
 * contract one level up in TypeScript, as a discriminated union instead of
 * a thrown exception.
 */
export type StageResult =
  | { ok: true; stage: StageSummary }
  | { ok: false; error: string };

/** One `resolveSprites` request result: exactly one of `pixels`/`error` is non-null. `pixels` is a flat, row-major RGBA buffer (`width * height * 4` bytes, straight/non-premultiplied alpha). */
export type StageSpritePixelResult =
  | { ok: true; pixels: Uint8Array; width: number; height: number }
  | { ok: false; error: string };

/** One `resolveAnimationFrames` request: which BG animation block to resolve, and how far into playback it currently is. `animation` is `null` when the element's `actionNumber` has no matching parsed block. */
export interface ResolveAnimationFrameRequest {
  animation: BGAnimation | null;
  elapsedTicks: number;
}
