// Per-sheet sprite pixel cache: decodes a given `(group, image)` sprite
// reference at most once for the life of a match session, never
// re-requesting (let alone re-decoding) it on a later tick — the
// realtime-rendering expert consultation's core requirement for this
// item (see `.vibe/decisions/004-match-rendering-architecture.md` point
// 6). One instance per sprite sheet (a fighter's own `.sff`, or the
// stage's) — never shared across sheets, so a mirror match's two
// identical characters each get their own cache rather than racing to
// populate a shared one keyed only by `(group, image)`.
import { spriteKey } from "./scene-composition.ts";
import type { ResolvedSpritePixels } from "./scene-composition.ts";

/** Structural shape both `wasm/bridge.ts`'s and `wasm/stage-bridge.ts`'s own `resolveSprites` already satisfy — this module works with either without importing a specific bridge. */
export type ResolveSpritesFn = (
  sffBytes: Uint8Array,
  requests: readonly (readonly [number, number])[],
  overrideBytes?: Uint8Array | null,
) => Promise<
  readonly (
    | { ok: true; pixels: Uint8Array; width: number; height: number }
    | { ok: false; error: string }
  )[]
>;

export interface SpritePixelCache {
  /** Every sprite successfully resolved so far, ready to hand straight to `scene-composition.ts`'s `pixelsByKey`. */
  readonly resolved: ReadonlyMap<string, ResolvedSpritePixels>;
  /**
   * Resolves every request in `requests` not already known (whether
   * previously resolved or previously failed) via `resolveFn`, storing
   * successful results in `resolved`. A request already known makes no
   * call at all; an empty net-new set after filtering also makes no call.
   * A request that fails is remembered as attempted (never retried) but
   * not added to `resolved` — the caller (`scene-composition.ts`) treats
   * "absent from `resolved`" as "draw a placeholder", regardless of
   * whether that is because resolution failed or hasn't happened yet.
   */
  resolveMissing(
    sffBytes: Uint8Array,
    requests: readonly (readonly [number, number])[],
    resolveFn: ResolveSpritesFn,
  ): Promise<void>;
}

/** Creates a fresh, empty cache for one sprite sheet. */
export function createSpritePixelCache(): SpritePixelCache {
  const resolved = new Map<string, ResolvedSpritePixels>();
  const attempted = new Set<string>();

  return {
    resolved,
    async resolveMissing(sffBytes, requests, resolveFn) {
      const missing = requests.filter(
        ([group, image]) => !attempted.has(spriteKey(group, image)),
      );
      if (missing.length === 0) return;

      const results = await resolveFn(sffBytes, missing);
      missing.forEach(([group, image], i) => {
        const key = spriteKey(group, image);
        attempted.add(key);
        const result = results[i];
        if (result?.ok) {
          resolved.set(key, {
            pixels: result.pixels,
            width: result.width,
            height: result.height,
          });
        }
      });
    },
  };
}
