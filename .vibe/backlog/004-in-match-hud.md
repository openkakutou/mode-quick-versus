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

## Unblocked
2026-08-30: `engine#009` shipped and published as `engine` `v0.8.0` (tag pushed, GitHub release created) — the `OpenKakutouEngine` WASM module now exposes `newMatch`/`tick`/`resetRound`, including live per-fighter health and round/match progress. Back to `status: todo`.

## Blocked
2026-08-31: `engine`'s exposed match state (`match.FighterState`: `Side`, `Position`, `Facing`, `Velocity`, `StateNo`, `Health`) and `round.Progress` cover health and round wins, but there is no power/super-meter concept anywhere in `engine` — not modeled in any Go type, not computed by `Tick`, not present in the WASM `tick`/`newMatch`/`resetRound` JSON contract (confirmed by a repo-wide search for "power"/"meter" turning up zero matches outside unrelated identifiers). This item's acceptance criterion "Power bar reflects `engine`'s live power/meter value" cannot be implemented against what `engine` currently exposes. `engine`'s own backlog is fully empty (every item done, `.vibe/backlog/` has no open items) — there is no existing engine item to point at as the blocker; a power/meter mechanic would need to be scoped as new engine work first. Lifebar-health-sync and round-display alone could be built, but the acceptance criteria as written are one coherent HUD, not independently splittable (per this skill's own scope-check: they're the same screen, not separately shippable capabilities) — implementing 4 of 5 criteria and silently dropping the power bar would misrepresent the item as done. Leaving `status: blocked` until `engine` models and exposes a power/meter value.
