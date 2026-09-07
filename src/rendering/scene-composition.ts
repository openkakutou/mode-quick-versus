import type { Facing, Position } from "../wasm/engine-types.ts";
// Pure composition logic for the match scene: coordinate mapping, draw
// order, sprite placement, and placeholder fallback. No DOM, no canvas, no
// WASM calls — each concern independently testable, mirroring
// `stage-viewer-web`'s own `background-composition.ts` split. See
// `.vibe/decisions/004-match-rendering-architecture.md` for the formulas
// and scope cuts (no camera panning, no blend modes, stage element axis
// untreated) this module implements.
import type { BGElement, SpriteRef } from "../wasm/stage-types.ts";
import type { Flip, Frame, Sprite } from "../wasm/types.ts";

/** A resolved sprite's actual decoded pixels, at its own native resolution. */
export interface ResolvedSpritePixels {
  pixels: Uint8Array;
  width: number;
  height: number;
}

/** Fixed placeholder box size (canvas pixels) for a reference with no metadata at all to size a placeholder from. */
export const PLACEHOLDER_SIZE = 32;

/**
 * One instruction to draw either a decoded sprite or a placeholder tile.
 * `canvasX`/`canvasY` is the sprite's axis (pivot) point in canvas space;
 * `axisX`/`axisY` is that same point's pixel offset within the sprite
 * image from its own top-left corner (`0, 0` for a stage BG element, whose
 * own axis metadata isn't available — see the ADR). The actual top-left
 * draw position — accounting for `flipH`/`flipV` — is a canvas-drawing
 * concern, not computed here.
 */
export interface DrawCommand {
  kind: "sprite" | "placeholder";
  canvasX: number;
  canvasY: number;
  axisX: number;
  axisY: number;
  width: number;
  height: number;
  /** Only present for `kind: "sprite"`. */
  pixels?: Uint8Array;
  flipH: boolean;
  flipV: boolean;
}

/** A stable key for a `(group, image)` sprite reference pair. */
export function spriteKey(group: number, image: number): string {
  return `${group},${image}`;
}

/**
 * Maps a stage-space X coordinate to a canvas pixel X coordinate. A
 * stage's local coordinate space has its origin at horizontal-center, top
 * — same convention `stage-viewer-web` already established (its own
 * `.vibe/decisions/003`) — so stage x=0 lands at half the local coordinate
 * width.
 */
export function stageXToCanvasX(x: number, localCoordWidth: number): number {
  return localCoordWidth / 2 + x;
}

/**
 * Resolves the effective horizontal/vertical mirroring for a fighter
 * sprite: horizontal is `facing === left` XOR the frame's own `H`/`HV`
 * flip (the two cancel out when both apply); vertical is only the frame's
 * own `V`/`HV` flip — facing never affects the vertical axis.
 */
export function resolveSpriteFlip(
  facing: Facing,
  frameFlip: Flip,
): { flipH: boolean; flipV: boolean } {
  const frameFlipsH = frameFlip === "H" || frameFlip === "HV";
  const frameFlipsV = frameFlip === "V" || frameFlip === "HV";
  return {
    flipH: (facing === 1) !== frameFlipsH,
    flipV: frameFlipsV,
  };
}

/**
 * Orders BG elements back-to-front (stable sort on `layerNo` ascending,
 * ties broken by original array order — matching `.def` file order), then
 * splits the result into the elements that draw behind both fighters
 * (`layerNo < 1`) and in front of them (`layerNo >= 1`), per `stage`'s own
 * documented `layerNo` convention. Never mutates the input.
 */
export function splitElementsByLayer(elements: readonly BGElement[]): {
  behind: BGElement[];
  front: BGElement[];
} {
  const sorted = elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.layerNo - b.element.layerNo || a.index - b.index)
    .map(({ element }) => element);

  return {
    behind: sorted.filter((e) => e.layerNo < 1),
    front: sorted.filter((e) => e.layerNo >= 1),
  };
}

/**
 * Builds one fighter's draw command for the current tick, or `null` for a
 * blank frame (MUGEN's own "no sprite shown" sentinel — any negative
 * `group`/`image`). `position` is already in stage coordinates;
 * `spriteMetaByKey` is the fighter's own loaded sprite metadata (axis,
 * dimensions — from `character`'s `load()` response, not `resolveSprites`);
 * `pixelsByKey` is this session's resolved-pixel cache. A reference with no
 * metadata at all degrades to a fixed-size placeholder centered on the
 * fighter's position; a reference whose metadata resolved but whose pixels
 * didn't degrades to a metadata-sized (still correctly axis-positioned)
 * placeholder.
 */
export function buildFighterDrawCommand(
  position: Position,
  facing: Facing,
  frame: Frame,
  spriteMetaByKey: ReadonlyMap<string, Sprite>,
  pixelsByKey: ReadonlyMap<string, ResolvedSpritePixels>,
  zOffset: number,
  localCoordWidth: number,
): DrawCommand | null {
  if (frame.group < 0 || frame.image < 0) return null; // blank frame

  const canvasX = stageXToCanvasX(position.x, localCoordWidth);
  const canvasY = zOffset - position.y;
  const { flipH, flipV } = resolveSpriteFlip(facing, frame.flip);

  const key = spriteKey(frame.group, frame.image);
  const meta = spriteMetaByKey.get(key);

  if (meta === undefined) {
    return {
      kind: "placeholder",
      canvasX,
      canvasY,
      axisX: PLACEHOLDER_SIZE / 2,
      axisY: PLACEHOLDER_SIZE / 2,
      width: PLACEHOLDER_SIZE,
      height: PLACEHOLDER_SIZE,
      flipH,
      flipV,
    };
  }

  const resolved = pixelsByKey.get(key);
  if (resolved === undefined) {
    return {
      kind: "placeholder",
      canvasX,
      canvasY,
      axisX: meta.axisX,
      axisY: meta.axisY,
      width: meta.width,
      height: meta.height,
      flipH,
      flipV,
    };
  }

  return {
    kind: "sprite",
    canvasX,
    canvasY,
    axisX: meta.axisX,
    axisY: meta.axisY,
    width: resolved.width,
    height: resolved.height,
    pixels: resolved.pixels,
    flipH,
    flipV,
  };
}

/**
 * Builds one stage BG element's draw command for the current tick, or
 * `null` when nothing should be drawn: a `"normal"`/`"parallax"` element
 * always draws its own static `sprite` reference; an `"anim"` element
 * draws `resolvedSprite` (this tick's already-resolved current frame, via
 * `stage`'s `resolveAnimationFrames`) unless it is `null` (no matching
 * `[Begin Action N]` block) or the blank sentinel `{-1, -1}` — neither is
 * an error, both mean "nothing to draw this frame", per `stage`'s own
 * `ResolveAnimationFrame` contract. A reference that fails to resolve
 * against the loaded sheet degrades to a fixed-size placeholder centered
 * on the element's configured position — axis untreated (`0, 0`), see the
 * ADR for why.
 */
export function buildStageElementDrawCommand(
  element: BGElement,
  resolvedSprite: SpriteRef | null,
  pixelsByKey: ReadonlyMap<string, ResolvedSpritePixels>,
  localCoordWidth: number,
): DrawCommand | null {
  let spriteRef: SpriteRef;
  if (element.type === "normal" || element.type === "parallax") {
    spriteRef = element.sprite;
  } else if (element.type === "anim") {
    if (resolvedSprite === null) return null;
    if (resolvedSprite.group < 0 || resolvedSprite.image < 0) return null;
    spriteRef = resolvedSprite;
  } else {
    return null;
  }

  const canvasX = stageXToCanvasX(element.startX, localCoordWidth);
  const canvasY = element.startY;

  const key = spriteKey(spriteRef.group, spriteRef.image);
  const resolved = pixelsByKey.get(key);

  if (resolved === undefined) {
    return {
      kind: "placeholder",
      canvasX: canvasX + PLACEHOLDER_SIZE / 2,
      canvasY: canvasY + PLACEHOLDER_SIZE / 2,
      axisX: PLACEHOLDER_SIZE / 2,
      axisY: PLACEHOLDER_SIZE / 2,
      width: PLACEHOLDER_SIZE,
      height: PLACEHOLDER_SIZE,
      flipH: false,
      flipV: false,
    };
  }

  return {
    kind: "sprite",
    canvasX,
    canvasY,
    axisX: 0,
    axisY: 0,
    width: resolved.width,
    height: resolved.height,
    pixels: resolved.pixels,
    flipH: false,
    flipV: false,
  };
}

/** One fighter's render-relevant state for the current tick. */
export interface FighterRenderInput {
  position: Position;
  facing: Facing;
  frame: Frame;
}

export interface BuildMatchDrawPlanInput {
  /** Every BG element from the loaded stage, in `.def` file order (this function sorts/splits them itself). */
  elements: readonly BGElement[];
  /** This tick's resolved current sprite for each `"anim"` element, keyed by its index in `elements`. */
  resolvedAnimSpriteByElementIndex: ReadonlyMap<number, SpriteRef | null>;
  /** Both fighters, indexed `[P1, P2]`. */
  fighters: readonly [FighterRenderInput, FighterRenderInput];
  /**
   * Each fighter's own sprite metadata/pixel lookups, indexed `[P1, P2]` —
   * never one shared map for both. A `(group, image)` reference is only
   * unique *within* one character's own `.sff` sheet; two different
   * characters routinely reuse the same numbering for a completely
   * different sprite, so merging both fighters' data into a single map
   * would risk one shadowing the other's metadata. The stage's own sheet
   * is a third, separately-keyed source for the same reason.
   */
  fighterSpriteMetaByKey: readonly [
    ReadonlyMap<string, Sprite>,
    ReadonlyMap<string, Sprite>,
  ];
  fighterPixelsByKey: readonly [
    ReadonlyMap<string, ResolvedSpritePixels>,
    ReadonlyMap<string, ResolvedSpritePixels>,
  ];
  stagePixelsByKey: ReadonlyMap<string, ResolvedSpritePixels>;
  zOffset: number;
  localCoordWidth: number;
}

/**
 * Builds the full ordered list of draw instructions for one rendered
 * frame: behind-layer BG elements, then both fighters (P1 before P2 —
 * see the ADR for why no other z-ordering is applied), then front-layer BG
 * elements. A command that would draw nothing (a blank fighter frame, an
 * out-of-scope/blank stage element) is simply absent from the result.
 */
export function buildMatchDrawPlan(
  input: BuildMatchDrawPlanInput,
): DrawCommand[] {
  const { behind, front } = splitElementsByLayer(input.elements);
  // splitElementsByLayer re-sorts, so element indices into
  // resolvedAnimSpriteByElementIndex must be recovered per-element rather
  // than assumed to match position in the sorted arrays.
  const indexByElement = new Map(
    input.elements.map((element, index) => [element, index] as const),
  );

  const buildElementCommand = (element: BGElement): DrawCommand | null => {
    const elementIndex = indexByElement.get(element);
    const resolvedSprite =
      elementIndex === undefined
        ? null
        : (input.resolvedAnimSpriteByElementIndex.get(elementIndex) ?? null);
    return buildStageElementDrawCommand(
      element,
      resolvedSprite,
      input.stagePixelsByKey,
      input.localCoordWidth,
    );
  };

  const behindCommands = behind.map(buildElementCommand);
  const frontCommands = front.map(buildElementCommand);
  const fighterCommands = input.fighters.map((fighter, side) =>
    buildFighterDrawCommand(
      fighter.position,
      fighter.facing,
      fighter.frame,
      input.fighterSpriteMetaByKey[side],
      input.fighterPixelsByKey[side],
      input.zOffset,
      input.localCoordWidth,
    ),
  );

  return [...behindCommands, ...fighterCommands, ...frontCommands].filter(
    (command): command is DrawCommand => command !== null,
  );
}
