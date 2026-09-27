import type { SoundEvent } from "../wasm/engine-types.ts";
// Resolves a triggered `engine.SoundEvent` (`{group, sample}`) to the
// matching already-decoded `Sound` from a character's own `sounds`
// (backlog item 013) — pure, no WASM/DOM dependency. Mirrors
// `rendering/match-renderer.ts`'s own `buildSpriteMetaByKey` convention:
// build a lookup once per fighter at match start, key by the same
// `(group, sample)` pair `engine` reports triggers by, reuse it for every
// tick rather than scanning the character's sound list per trigger.
import type { CharacterSummary, Sound } from "../wasm/types.ts";

function key(group: number, sample: number): string {
  return `${group},${sample}`;
}

/** Builds a `(group, sample)`-keyed lookup of every decoded sound a character has — empty for a character with no sound file, never an error. */
export function buildSoundLookup(
  character: CharacterSummary,
): Map<string, Sound> {
  const lookup = new Map<string, Sound>();
  for (const group of character.sounds) {
    for (const sound of group.sounds) {
      lookup.set(key(sound.group, sound.sample), sound);
    }
  }
  return lookup;
}

/** Looks up the decoded `Sound` matching a triggered `SoundEvent`, or `undefined` when the character has no matching sound — a legitimate, silent miss, never an error. */
export function findSound(
  lookup: ReadonlyMap<string, Sound>,
  event: SoundEvent,
): Sound | undefined {
  return lookup.get(key(event.group, event.sample));
}
