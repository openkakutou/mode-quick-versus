// Minimal typed mirror of the JSON contract published by the `character`
// WASM module (`OpenKakutouCharacter.load`/`resolveSprites`) — only the
// fields this app actually consumes (see `character-viewer-web`'s
// `src/wasm/types.ts` for the full contract, which this repo does not need
// to duplicate). Field names match the Go-side `json:"..."` tags exactly.

/** A frame's mirroring axis (`air.Flip`): "" none, "H" horizontal, "V" vertical, "HV" both. */
export type Flip = "" | "H" | "V" | "HV";

/** A frame's blending mode token (`air.BlendMode`), e.g. "A" additive, "S" subtractive. "" means normal blending. */
export type BlendMode = string;

/** An axis-aligned collision box (`air.ClsnBox`), already resolved to the box active on its specific frame. */
export interface ClsnBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One frame of an animation (`air.Frame`). `group`/`image` reference a sprite in the character's sheet — any negative value on either is MUGEN's "no sprite shown" (blank frame) sentinel. `time` is how many ticks this frame holds; `time <= 0` holds forever. */
export interface Frame {
  group: number;
  image: number;
  x: number;
  y: number;
  time: number;
  flip: Flip;
  blend: BlendMode;
  clsn1: ClsnBox[];
  clsn2: ClsnBox[];
}

/** An `.air` animation action (`air.Animation`): its own action number, ordered frames, and loop-back frame index once playback runs past the end. */
export interface Animation {
  number: number;
  frames: Frame[];
  loopStart: number;
}

/** A single sprite's metadata (`sff.Sprite`) — dimensions and axis (pivot) point, never decoded pixel data (see `resolveSprites` for that). */
export interface Sprite {
  group: number;
  image: number;
  width: number;
  height: number;
  axisX: number;
  axisY: number;
  palette: number;
}

/** A group of sprites sharing the same `group` index (`sff.SpriteGroup`). */
export interface SpriteGroup {
  index: number;
  sprites: Sprite[];
}

/**
 * An opaque, unevaluated `cns.StateDef` blob. Never interpreted client-side
 * — only forwarded to `engine`'s WASM boundary as-is (see
 * `rendering/match-config.ts`), the same "unevaluated data" precedent
 * `wasm/engine-types.ts`'s own `StateDefBlob` establishes for the engine
 * bridge's request shape.
 */
export type StateDefBlob = Record<string, unknown>;

/** The subset of a loaded character's data this app consumes: its name, animations (for match rendering), sprite metadata (for placement/axis lookup), and its combat state defs (opaque, forwarded to `engine` as-is to build a match). */
export interface CharacterSummary {
  name: string;
  animations: Animation[];
  sprites: SpriteGroup[];
  stateDefs: StateDefBlob[];
}

/**
 * Result of the typed bridge wrapper: exactly one of `character`/`error` is
 * ever meaningful, mirroring the WASM module's own `{character, error}`
 * contract one level up in TypeScript, as a discriminated union instead of
 * a thrown exception.
 */
export type CharacterResult =
  | { ok: true; character: CharacterSummary }
  | { ok: false; error: string };

/** One `resolveSprites` request result: exactly one of `pixels`/`error` is non-null. `pixels` is a flat, row-major RGBA buffer (`width * height * 4` bytes, straight/non-premultiplied alpha). */
export type SpritePixelResult =
  | { ok: true; pixels: Uint8Array; width: number; height: number }
  | { ok: false; error: string };
