import { describe, expect, it } from "vitest";
import { deriveMatchOutcome, deriveRoundOutcome } from "./outcome.ts";

describe("deriveRoundOutcome", () => {
  it("returns null while the round is still in progress", () => {
    expect(deriveRoundOutcome({ outcome: 0, winner: 0 }, 1)).toBeNull();
  });

  it("resolves a KO to the reported winner", () => {
    expect(deriveRoundOutcome({ outcome: 1, winner: 1 }, 2)).toEqual({
      round: 2,
      winner: "p2",
    });
  });

  it("resolves a timeout to the reported winner", () => {
    expect(deriveRoundOutcome({ outcome: 3, winner: 0 }, 1)).toEqual({
      round: 1,
      winner: "p1",
    });
  });

  it("resolves a double KO to a draw, not to either side", () => {
    expect(deriveRoundOutcome({ outcome: 2, winner: 0 }, 3)).toEqual({
      round: 3,
      winner: "draw",
    });
  });

  it("resolves a timeout-at-equal-health to a draw", () => {
    expect(deriveRoundOutcome({ outcome: 4, winner: 0 }, 1)).toEqual({
      round: 1,
      winner: "draw",
    });
  });

  it("degrades an unrecognized outcome code to a draw instead of throwing or returning null", () => {
    // `engine`'s `round.Outcome` enum only defines 0-4; a value outside that
    // range would be unexpected WASM-boundary data, not a real product of
    // the documented state machine -- still must resolve to something clear.
    expect(deriveRoundOutcome({ outcome: 99, winner: 0 }, 1)).toEqual({
      round: 1,
      winner: "draw",
    });
  });

  it("degrades a KO with an out-of-range winner side to a draw", () => {
    expect(
      deriveRoundOutcome({ outcome: 1, winner: 5 as unknown as 0 | 1 }, 1),
    ).toEqual({ round: 1, winner: "draw" });
  });
});

describe("deriveMatchOutcome", () => {
  it("returns null while the match is still ongoing", () => {
    expect(deriveMatchOutcome(false, 0)).toBeNull();
  });

  it("resolves to the reported match winner once matchOver is true", () => {
    expect(deriveMatchOutcome(true, 1)).toEqual({ winner: "p2" });
  });

  it("resolves an out-of-range matchWinner to a draw instead of leaving the result undefined", () => {
    expect(deriveMatchOutcome(true, 7 as unknown as 0 | 1)).toEqual({
      winner: "draw",
    });
  });
});
