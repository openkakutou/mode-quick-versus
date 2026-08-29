// Minimal typed mirror of the JSON contract published by the `stage`
// WASM module (`OpenKakutouStage.load`) — only the fields this app
// actually consumes (see `stage-viewer-web`'s `src/wasm/types.ts` for the
// full contract, which this repo does not need to duplicate). Field name
// matches the Go-side `json:"..."` tag exactly.

/** The subset of a loaded stage's data this app displays: its name. */
export interface StageSummary {
  name: string;
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
