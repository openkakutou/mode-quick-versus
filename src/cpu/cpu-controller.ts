import { BUTTON_NAMES } from "../input/key-bindings.ts";
// A minimal, first-pass CPU opponent decision function (backlog item 007):
// intentionally simple, not a full AI -- see the backlog item's own notes.
// Pure and stateless: every `decide()` call is a function of that call's
// own observation only, nothing persisted between calls, so there is
// nothing to reset when a round ends or a match restarts (see
// `.vibe/decisions/010-round-match-result-and-cpu-opponent-design.md`).
// Mutates a caller-supplied target object in place, mirroring
// `tick-input-source.ts`'s own `copyInto` allocation discipline, rather
// than allocating a fresh `RawPlayerInput` per decision.
import type { RawPlayerInput } from "../input/types.ts";
import type { Position } from "../wasm/engine-types.ts";

/** What the CPU can see of the match to decide this tick's input: both fighters' current positions. */
export interface CpuObservation {
  self: { position: Position };
  opponent: { position: Position };
}

/** Beyond this stage-unit distance, the CPU walks toward its opponent. */
export const APPROACH_DISTANCE = 60;

/** Within this stage-unit distance, the CPU may attempt an attack instead of walking. */
export const ATTACK_RANGE = 50;

/** Chance, per tick, that the CPU presses its attack button while in range -- deliberately not "every tick in range", so it doesn't read as a single held button mashing forever. */
export const ATTACK_CHANCE = 0.1;

export interface CpuController {
  /**
   * Decides this tick's input from `observation`, writing the result into
   * `target` in place (never allocates a fresh `RawPlayerInput`). A
   * malformed observation (non-finite coordinates) degrades to a neutral
   * input -- nothing held -- instead of throwing or producing `NaN`-driven
   * behavior.
   */
  decide(observation: CpuObservation, target: RawPlayerInput): void;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidObservation(observation: CpuObservation): boolean {
  return (
    isFiniteNumber(observation.self?.position?.x) &&
    isFiniteNumber(observation.opponent?.position?.x)
  );
}

/** Resets `target` to neutral (nothing held) in place -- the same shape `createNeutralInput()` builds fresh, but mutating an existing pre-allocated object instead. */
function resetInput(target: RawPlayerInput): void {
  target.up = false;
  target.down = false;
  target.left = false;
  target.right = false;
  for (const name of BUTTON_NAMES) target.buttons[name] = false;
}

/**
 * Builds a stateless CPU controller. `random` defaults to `Math.random`;
 * injecting a deterministic stand-in makes the attack-chance branch
 * testable.
 */
export function createCpuController(
  random: () => number = Math.random,
): CpuController {
  function decide(observation: CpuObservation, target: RawPlayerInput): void {
    resetInput(target);
    if (!isValidObservation(observation)) return;

    const dx = observation.opponent.position.x - observation.self.position.x;
    const distance = Math.abs(dx);

    if (distance > APPROACH_DISTANCE) {
      if (dx > 0) target.right = true;
      else target.left = true;
      return;
    }

    if (distance <= ATTACK_RANGE && random() < ATTACK_CHANCE) {
      target.buttons.a = true;
    }
  }

  return { decide };
}
