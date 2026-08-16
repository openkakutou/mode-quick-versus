// Minimal typed mirror of the JSON contract published by the `character`
// WASM module (`OpenKakutouCharacter.load`) — only the fields this app
// actually consumes (see `character-viewer-web`'s `src/wasm/types.ts` for
// the full contract, which this repo does not need to duplicate). Field
// name matches the Go-side `json:"..."` tag exactly.

/** The subset of a loaded character's data this app displays: its name. */
export interface CharacterSummary {
  name: string;
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
