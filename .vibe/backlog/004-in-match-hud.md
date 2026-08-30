---
status: blocked
depends_on: [003]
---
# In-Match HUD

## Description
Render the in-match heads-up display — each player's lifebar, power bar, and the round display (round number, wins so far) — continuously driven by live match state read from the `engine` WASM module. This repo has no separate `lifebar` parsing library org-wide, so lifebar layout/rendering logic is implemented directly here, mirroring `lifebar-viewer-web`'s in-app parsing approach rather than depending on a `lifebar` package that doesn't exist.

## Acceptance Criteria
- [ ] Lifebars for both players update in sync with `engine`'s live health values as a match progresses
- [ ] Power bar reflects `engine`'s live power/meter value
- [ ] Round display reflects the current round number and each player's round wins
- [ ] Malformed or unexpected match state from `engine` degrades the HUD to a clear error state instead of freezing or crashing the match
- [ ] HUD rendering does not block or measurably slow down match simulation/input handling

## Notes
Cross-repo blocker: needs `engine` item 001 (match state model) to exist and expose the health/power/round fields this HUD reads. Also needs the lifebar-rendering approach mirrored from `lifebar-viewer-web`.

## Blocked
2026-08-30: `engine` item 001 (match state model) is done, but that alone doesn't give this app anything to consume from the browser. `engine`'s own WASM entrypoint (its backlog item `009`, "Round/Match Flow, WASM Entrypoint, Integration Tests") is still `status: todo`, and `engine`'s current tree has no `cmd/wasm` at all (only the `version.go` module skeleton plus internal Go packages) — there is no built or buildable WASM module exposing live match state yet. This item's own Notes under-specified the real cross-repo prerequisite (named item 001, but the actual gate is the WASM entrypoint, item 009). Re-run once `engine#009` ships.
