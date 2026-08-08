---
status: todo
depends_on: [004, 005, 006]
---
# Round/Match Result Screen + Basic CPU Opponent

## Description
Two related pieces that both close out the core gameplay loop: (1) a result screen shown at the end of a round and at the end of the match, reporting the winner and offering "rematch" (replay with the same setup) or "back to select" (return to character selection); and (2) a minimal first-pass CPU opponent that can stand in for player 2, driven by simple decision logic feeding the same `engine` input system used by item 006, enabling single-player play.

## Acceptance Criteria
- [ ] Round result is shown at the end of each round with the round winner (or draw) before the next round starts
- [ ] Match result is shown at the end of the match with the overall winner (or draw) and options to rematch or return to character selection
- [ ] Rematch restarts a match with the same characters/stage/setup without returning to selection screens
- [ ] A single-player mode can enable the CPU opponent for player 2, which takes actions via the same input-routing path as item 006 rather than a separate privileged path into `engine`
- [ ] A match ending in an unexpected/incomplete `engine` state (e.g. simultaneous KO with ambiguous outcome) still resolves to a clear result rather than leaving the result screen stuck or undefined

## Notes
None — this CPU opponent is intentionally minimal (a first pass), not a full AI; more advanced CPU behavior is out of scope here.
