// Minimal typed mirror of the JSON contract published by the `engine`
// WASM module (`OpenKakutouEngine.newMatch`/`tick`/`closeMatch`). Field
// names match the Go-side `json:"..."` tags exactly (see `engine`'s
// `cmd/wasm/main.go`, `match/state.go`, `round/round.go`).
//
// `StateDefBlob`/`CommandFileBlob` are deliberately opaque: this bridge
// never interprets combat logic (triggers, controllers, command inputs) —
// it only threads a character's already-loaded `character` WASM data
// through to `engine`'s WASM boundary, unmodified, the same "unevaluated
// data" precedent `character`'s own `cns.Controller` establishes one layer
// down. `StateDefBlob` itself is `types.ts`'s own — reused here rather than
// redeclared, so the character bridge's and the engine bridge's notion of
// "an opaque state def" never drift apart.
import type { Animation, StateDefBlob } from "./types.ts";

export type { StateDefBlob };

/** A fighter's 2D location in stage coordinates (upward-positive Y, 0 = ground — see `engine/physics`'s own doc comment). */
export interface Position {
  x: number;
  y: number;
}

/** A fighter's per-axis movement rate, in stage units per simulation tick. */
export interface Velocity {
  x: number;
  y: number;
}

/** `match.Facing`: 0 = right (`match.FacingRight`), 1 = left (`match.FacingLeft`). */
export type Facing = 0 | 1;

/** `match.Side`: 0 = player 1 (`match.SideP1`), 1 = player 2 (`match.SideP2`). */
export type Side = 0 | 1;

/** The live, per-tick state of one fighter during a match (`match.FighterState`). */
export interface FighterState {
  side: Side;
  position: Position;
  facing: Facing;
  velocity: Velocity;
  stateNo: number;
  health: number;
}

/** The live state of a match between two fighters (`match.MatchState`). */
export interface MatchState {
  round: number;
  roundTimer: number;
  fighters: [FighterState, FighterState];
}

/** A fighter's currently resolved animation number and elapsed frame timing (`cmd/wasm`'s response-only `FighterAnimState`). `animTime` is ticks elapsed since `animNo` started playing, not a per-frame duration. */
export interface FighterAnimState {
  animNo: number;
  animTime: number;
}

/** One simulation tick's raw directional/button input for one fighter (`input.TickInput`). A field left unset reads as not held/pressed. */
export interface TickInput {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  /** Currently-held button names (e.g. "a", "b"), matching `character/cmd.Command.Input`'s lowercase button tokens. */
  buttons?: Record<string, boolean>;
}

/** An opaque, unevaluated `cmd.CommandFile` blob — same rationale as `StateDefBlob`. */
export type CommandFileBlob = Record<string, unknown>;

/**
 * One fighter's loaded combat program (`engine.FighterProgram`). `states`
 * is keyed by state number **as a string** — Go's `encoding/json` always
 * marshals a `map[int]T` with its integer keys stringified, since JSON
 * object keys are strings.
 */
export interface FighterProgram {
  states: Record<string, StateDefBlob>;
  animations: Animation[];
  commands: CommandFileBlob;
}

/** The x-range a character may move within on this stage (`stage.StageBoundaries`, the subset `engine.TickConfig` reads). */
export interface StageBoundaries {
  left: number;
  right: number;
  topBound: number;
  bottomBound: number;
}

/** `OpenKakutouEngine.newMatch`'s JSON request shape. */
export interface NewMatchRequest {
  programs: [FighterProgram, FighterProgram];
  starting: [FighterState, FighterState];
  roundTimer: number;
  bestOf: number;
  bounds: StageBoundaries;
  gravity: number;
  comboWindow: number;
}

/** `round.Progress`: match-level bookkeeping across rounds. */
export interface Progress {
  bestOf: number;
  wins: [number, number];
  roundsPlayed: number;
}

/** `round.RoundResult`: a single round's outcome, if any, as of the tick just simulated. `outcome === 0` means `round.OutcomeNone` (no round decided this tick). */
export interface RoundResult {
  outcome: number;
  winner: Side;
}

/** `OpenKakutouEngine.newMatch`'s JSON success payload. */
export interface NewMatchResponseData {
  matchId: number;
  state: MatchState;
  progress: Progress;
  animations: [FighterAnimState, FighterAnimState];
}

/** `OpenKakutouEngine.tick`'s JSON request shape. */
export interface TickRequest {
  matchId: number;
  inputs: [TickInput, TickInput];
}

/** `OpenKakutouEngine.tick`'s JSON success payload. */
export interface TickResponseData {
  state: MatchState;
  round: RoundResult;
  progress: Progress;
  matchOver: boolean;
  matchWinner: Side;
  animations: [FighterAnimState, FighterAnimState];
}

/** Result of a bridge call: exactly one of `data`/`error` is ever meaningful, mirroring the WASM module's own `{data, error}` envelope one level up in TypeScript, as a discriminated union instead of a thrown exception. */
export type EngineResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
