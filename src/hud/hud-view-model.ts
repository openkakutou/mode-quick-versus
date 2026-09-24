// Pure, DOM-free derivation of the in-match HUD's view model from `engine`'s
// live match state (`MatchState`) and match progress (`Progress`). Both are
// treated as `unknown` rather than trusted at the type level: `engine-
// bridge.ts`'s `parseEnvelope` only type-asserts the decoded JSON, it never
// validates its shape, so a malformed or unexpected WASM payload must be
// caught here rather than crashing HUD rendering or freezing the match loop
// (backlog item 004's acceptance criteria). Validation is a single
// all-or-nothing pass: any invalid/missing field fails the whole derivation
// rather than producing a partially-valid view model — see
// `.vibe/decisions/009` for why the HUD degrades as one unit, not per field.

export interface HudFighterView {
  /** Health remaining as a percentage of the app's placeholder max health, clamped to [0, 100]. */
  healthPercent: number;
  /** Power/meter as a percentage of the app's placeholder max power, clamped to [0, 100]. */
  powerPercent: number;
}

export interface HudRoundView {
  round: number;
  wins: [number, number];
  bestOf: number;
}

export interface HudViewModel {
  fighters: [HudFighterView, HudFighterView];
  roundInfo: HudRoundView;
}

export type HudViewModelResult =
  | { ok: true; data: HudViewModel }
  | { ok: false; error: string };

/**
 * Clamps `value` as a percentage of `max` to the [0, 100] range. A
 * non-positive `max` (a misconfigured cap, never expected in practice)
 * reads as 0% rather than dividing by zero/producing `Infinity`/`NaN`; a
 * non-finite `value` also reads as 0%.
 */
export function clampPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  const percent = (value / max) * 100;
  if (percent < 0) return 0;
  if (percent > 100) return 100;
  return percent;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates and derives a `HudViewModel` from `engine`'s raw `MatchState`/
 * `Progress` payloads. Returns a descriptive error instead of throwing or
 * producing `NaN`/negative-width bars on any missing/wrong-typed/
 * out-of-range field. A fighter's health/power must be a finite number
 * `>= 0` to count as valid — `0` is a normal, valid KO/empty-meter reading,
 * never confused with the error state; a negative value is never expected
 * from `engine` (health decrease is a controlled effect, `Power` is always
 * clamped to `[0, DefaultMaxPower]` engine-side) and is treated as
 * malformed data.
 */
export function deriveHudViewModel(
  state: unknown,
  progress: unknown,
  maxHealth: number,
  maxPower: number,
): HudViewModelResult {
  if (!isPlainRecord(state)) {
    return { ok: false, error: "match state is missing or not an object" };
  }
  if (!isFiniteNumber(state.round)) {
    return { ok: false, error: "match state has no numeric round number" };
  }
  const fighters = state.fighters;
  if (!Array.isArray(fighters) || fighters.length !== 2) {
    return {
      ok: false,
      error: "match state does not have exactly 2 fighters",
    };
  }

  const fighterViews: HudFighterView[] = [];
  for (const [index, fighter] of fighters.entries()) {
    if (!isPlainRecord(fighter)) {
      return { ok: false, error: `fighter ${index} state is not an object` };
    }
    if (!isFiniteNumber(fighter.health) || fighter.health < 0) {
      return {
        ok: false,
        error: `fighter ${index} has no valid non-negative numeric health`,
      };
    }
    if (!isFiniteNumber(fighter.power) || fighter.power < 0) {
      return {
        ok: false,
        error: `fighter ${index} has no valid non-negative numeric power`,
      };
    }
    fighterViews.push({
      healthPercent: clampPercent(fighter.health, maxHealth),
      powerPercent: clampPercent(fighter.power, maxPower),
    });
  }

  if (!isPlainRecord(progress)) {
    return { ok: false, error: "match progress is missing or not an object" };
  }
  if (!isFiniteNumber(progress.bestOf)) {
    return { ok: false, error: "match progress has no numeric bestOf" };
  }
  const wins = progress.wins;
  if (
    !Array.isArray(wins) ||
    wins.length !== 2 ||
    !isFiniteNumber(wins[0]) ||
    !isFiniteNumber(wins[1])
  ) {
    return {
      ok: false,
      error: "match progress does not have exactly 2 numeric wins entries",
    };
  }

  return {
    ok: true,
    data: {
      fighters: [fighterViews[0], fighterViews[1]] as [
        HudFighterView,
        HudFighterView,
      ],
      roundInfo: {
        round: state.round,
        wins: [wins[0], wins[1]],
        bestOf: progress.bestOf,
      },
    },
  };
}
