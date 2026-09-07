// Pure assembly logic turning already-loaded character/stage data and the
// match setup screen's config into `engine` WASM bridge request shapes.
// No WASM calls, no DOM — every value here that isn't sourced from a real
// upstream model is a documented placeholder constant (health, gravity,
// combo window, input commands), since none of those are modeled anywhere
// else in this app yet. See
// `.vibe/decisions/004-match-rendering-architecture.md` point 7.
import type { TimeLimitOption } from "../setup/setup-screen.ts";
import type {
  FighterProgram,
  FighterState,
  NewMatchRequest,
  StageBoundaries,
} from "../wasm/engine-types.ts";
import type { StageSummary } from "../wasm/stage-types.ts";
import type { CharacterSummary } from "../wasm/types.ts";

/** Simulation ticks per second — matches MUGEN/Ikemen GO's own engine rate, and `engine`'s own tick semantics. */
export const TICK_RATE_HZ = 60;

/** Placeholder starting health for both fighters. `character`'s own read-path data model has no life/health total yet (not modeled anywhere org-wide) — see the ADR referenced above. */
export const DEFAULT_HEALTH = 1000;

/** Placeholder per-tick gravity accel, applied while airborne. No real character/stage constants source exists yet. */
export const DEFAULT_GRAVITY = 0.5;

/** Placeholder combo-window tick count `engine.TickConfig` requires. */
export const DEFAULT_COMBO_WINDOW = 20;

/** Half-width of the fallback stage boundary range used when a stage's own `.def` leaves `[PlayerInfo]` unset or invalid. */
export const FALLBACK_STAGE_HALF_WIDTH = 200;

/** Standard distance from center each fighter starts at, on a stage wide enough to afford it. */
export const STARTING_OFFSET = 70;

/** A large-but-finite round timer standing in for "no timer" — `engine`'s `roundTimer` is a plain tick countdown with no first-class "unlimited" concept. ~4.6 hours at 60 ticks/second, long enough no real match will ever hit it. */
export const UNLIMITED_ROUND_TIMER_TICKS = 999_999;

/** An empty `cmd.CommandFile` — no player command is ever recognized until input routing (backlog item 006) supplies a real one, parsed from the character's own `.cmd` file. */
function emptyCommandFile(): FighterProgram["commands"] {
  return {
    remap: {},
    defaults: { time: 0, bufferTime: 0 },
    commands: [],
    states: [],
  };
}

/**
 * Builds one fighter's `engine.FighterProgram` from its already-loaded
 * `character` WASM data: state defs keyed by number as a string (matching
 * Go's `map[int]T` JSON encoding), animations carried through unchanged —
 * both packages describe the exact same underlying Go types
 * (`character/cns`, `character/air`), so no field transformation is
 * needed, only reshaping the array into a keyed map. A state def whose
 * `number` field isn't a usable integer (malformed upstream data) is
 * skipped rather than building an invalid map key.
 */
export function buildFighterProgram(
  character: CharacterSummary,
): FighterProgram {
  const states: FighterProgram["states"] = {};
  for (const stateDef of character.stateDefs) {
    const number = stateDef.number;
    if (typeof number !== "number" || !Number.isInteger(number)) continue;
    states[String(number)] = stateDef;
  }
  return {
    states,
    animations: character.animations,
    commands: emptyCommandFile(),
  };
}

/**
 * Resolves the x-range fighters may move within: the stage's own
 * `stageBoundaries` when they form a valid range (`left < right`),
 * otherwise a fallback derived from the stage's local coordinate width
 * (half on each side of center), or a fixed constant if that is also
 * unset. `topBound`/`bottomBound` (3D-only) always pass through as-is —
 * out of scope for a 2D-only stage.
 */
export function resolveStageBoundaries(stage: StageSummary): StageBoundaries {
  const own = stage.stageBoundaries;
  if (own.left < own.right) return own;

  const halfWidth =
    stage.bgDef.localCoordWidth > 0
      ? stage.bgDef.localCoordWidth / 2
      : FALLBACK_STAGE_HALF_WIDTH;
  return {
    left: -halfWidth,
    right: halfWidth,
    topBound: own.topBound,
    bottomBound: own.bottomBound,
  };
}

/**
 * Builds both fighters' starting `FighterState`: symmetric around the
 * stage center, facing each other, grounded (`y: 0`), at
 * `DEFAULT_HEALTH`. The standard `STARTING_OFFSET` is clamped to the
 * stage's own boundaries so a narrow stage never starts a fighter outside
 * its own movable range.
 */
export function buildStartingFighters(
  bounds: StageBoundaries,
): [FighterState, FighterState] {
  const maxOffset = (bounds.right - bounds.left) / 2;
  const offset = Math.min(STARTING_OFFSET, maxOffset);

  const p1: FighterState = {
    side: 0,
    position: { x: -offset, y: 0 },
    facing: 0,
    velocity: { x: 0, y: 0 },
    stateNo: 0,
    health: DEFAULT_HEALTH,
  };
  const p2: FighterState = {
    side: 1,
    position: { x: offset, y: 0 },
    facing: 1,
    velocity: { x: 0, y: 0 },
    stateNo: 0,
    health: DEFAULT_HEALTH,
  };
  return [p1, p2];
}

/** Converts a match setup `TimeLimitOption` into a round timer expressed in simulation ticks. */
export function resolveRoundTimerTicks(timeLimit: TimeLimitOption): number {
  if (timeLimit === "unlimited") return UNLIMITED_ROUND_TIMER_TICKS;
  return timeLimit.seconds * TICK_RATE_HZ;
}

/** The subset of `MatchSetupConfig` this module needs — avoids importing the whole setup screen module for one field pair. */
export interface MatchConfigInput {
  rounds: number;
  timeLimit: TimeLimitOption;
}

/**
 * Assembles a complete `engine` WASM `newMatch` request from both players'
 * already-loaded character data, the chosen stage, and the match setup
 * screen's configuration.
 */
export function buildNewMatchRequest(
  player1: CharacterSummary,
  player2: CharacterSummary,
  stage: StageSummary,
  config: MatchConfigInput,
): NewMatchRequest {
  const bounds = resolveStageBoundaries(stage);
  return {
    programs: [buildFighterProgram(player1), buildFighterProgram(player2)],
    starting: buildStartingFighters(bounds),
    roundTimer: resolveRoundTimerTicks(config.timeLimit),
    bestOf: config.rounds,
    bounds,
    gravity: DEFAULT_GRAVITY,
    comboWindow: DEFAULT_COMBO_WINDOW,
  };
}
