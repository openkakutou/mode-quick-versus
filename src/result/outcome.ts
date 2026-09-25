// Pure, DOM-free derivation of a clear "who won" result from `engine`'s
// raw round/match outcome codes -- no WASM calls, no DOM. `engine`'s own
// `round.Outcome` enum (see `wasm/engine-types.ts`'s `RoundResult`) is
// treated defensively rather than trusted blindly: an outcome code this app
// doesn't recognize, or a winner side outside `0`/`1`, still resolves to a
// clear "draw" result instead of leaving the result screen stuck or
// undefined -- the same "resolve to a clear state instead of crashing"
// precedent `hud/hud-view-model.ts` already set for a malformed WASM
// payload, applied here to the round/match outcome path. See
// `.vibe/decisions/010-round-match-result-and-cpu-opponent-design.md`.
import type { RoundResult, Side } from "../wasm/engine-types.ts";

/** `round.OutcomeNone` -- the round is still in progress, no result to show yet. */
const OUTCOME_NONE = 0;

/** Who a round or the match resolved to: one side, or a draw (no winner). `"draw"` covers both a genuine no-winner outcome (double KO, a timeout at equal health) and any outcome/winner value this app doesn't recognize -- both read identically to a player: nobody is declared the winner. */
export type OutcomeWinner = "p1" | "p2" | "draw";

export interface RoundEndView {
  /** The round number that just ended (as reported by the tick that decided it, before any reset advances it). */
  round: number;
  winner: OutcomeWinner;
}

export interface MatchEndView {
  winner: OutcomeWinner;
}

function winnerFromSide(side: unknown): OutcomeWinner {
  if (side === 0) return "p1";
  if (side === 1) return "p2";
  // An out-of-range side is unexpected WASM-boundary data, not a real
  // draw -- but a player-facing result still needs to resolve to
  // *something* clear rather than being left undefined, so it degrades to
  // the same "draw" reading a genuine no-winner outcome already uses.
  return "draw";
}

/**
 * Derives this round's result from `engine`'s raw `RoundResult`, or `null`
 * when the round is still in progress (`outcome === OutcomeNone`). A KO or
 * timeout resolves to the reported winner side; a double KO or a
 * timeout-at-equal-health resolves to `"draw"`; any other outcome code --
 * not one `engine`'s documented `round.Outcome` enum defines -- also
 * degrades to `"draw"` rather than throwing or returning something a
 * caller could mistake for "no result yet".
 */
export function deriveRoundOutcome(
  result: RoundResult,
  round: number,
): RoundEndView | null {
  if (result.outcome === OUTCOME_NONE) return null;

  const winner: OutcomeWinner =
    result.outcome === 1 /* OutcomeKO */ ||
    result.outcome === 3 /* OutcomeTimeout */
      ? winnerFromSide(result.winner)
      : "draw"; // OutcomeDoubleKO, OutcomeTimeoutDraw, or an unrecognized code.

  return { round, winner };
}

/**
 * Derives the match's result once `matchOver` is true, or `null` while the
 * match is still ongoing. `matchWinner` outside `0`/`1` (unexpected
 * WASM-boundary data -- a match reported over with no valid winner side)
 * degrades to `"draw"` rather than leaving the match result undefined; a
 * round count is always a positive odd number (see `setup/setup-screen.ts`'s
 * `isValidRoundCount`), so a real, well-formed match can never end in an
 * actual draw -- only this defensive fallback path ever produces one.
 */
export function deriveMatchOutcome(
  matchOver: boolean,
  matchWinner: Side,
): MatchEndView | null {
  if (!matchOver) return null;
  return { winner: winnerFromSide(matchWinner) };
}
