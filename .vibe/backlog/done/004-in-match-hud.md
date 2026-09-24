---
status: done
depends_on: [003]
---
# In-Match HUD

## Description
Render the in-match heads-up display — each player's lifebar, power bar, and the round display (round number, wins so far) — continuously driven by live match state read from the `engine` WASM module. This repo has no separate `lifebar` parsing library org-wide, so lifebar layout/rendering logic is implemented directly here, mirroring `lifebar-viewer-web`'s in-app parsing approach rather than depending on a `lifebar` package that doesn't exist.

## Acceptance Criteria
- [x] Lifebars for both players update in sync with `engine`'s live health values as a match progresses
- [x] Power bar reflects `engine`'s live power/meter value
- [x] Round display reflects the current round number and each player's round wins
- [x] Malformed or unexpected match state from `engine` degrades the HUD to a clear error state instead of freezing or crashing the match
- [x] HUD rendering does not block or measurably slow down match simulation/input handling

## Notes
Cross-repo blocker: needs `engine` item 001 (match state model) to exist and expose the health/power/round fields this HUD reads. Also needs the lifebar-rendering approach mirrored from `lifebar-viewer-web`.

## Blocked
2026-08-30: `engine` item 001 (match state model) is done, but that alone doesn't give this app anything to consume from the browser. `engine`'s own WASM entrypoint (its backlog item `009`, "Round/Match Flow, WASM Entrypoint, Integration Tests") is still `status: todo`, and `engine`'s current tree has no `cmd/wasm` at all (only the `version.go` module skeleton plus internal Go packages) — there is no built or buildable WASM module exposing live match state yet. This item's own Notes under-specified the real cross-repo prerequisite (named item 001, but the actual gate is the WASM entrypoint, item 009). Re-run once `engine#009` ships.

## Unblocked
2026-08-30: `engine#009` shipped and published as `engine` `v0.8.0` (tag pushed, GitHub release created) — the `OpenKakutouEngine` WASM module now exposes `newMatch`/`tick`/`resetRound`, including live per-fighter health and round/match progress. Back to `status: todo`.

## Blocked
2026-08-31: `engine`'s exposed match state (`match.FighterState`: `Side`, `Position`, `Facing`, `Velocity`, `StateNo`, `Health`) and `round.Progress` cover health and round wins, but there is no power/super-meter concept anywhere in `engine` — not modeled in any Go type, not computed by `Tick`, not present in the WASM `tick`/`newMatch`/`resetRound` JSON contract (confirmed by a repo-wide search for "power"/"meter" turning up zero matches outside unrelated identifiers). This item's acceptance criterion "Power bar reflects `engine`'s live power/meter value" cannot be implemented against what `engine` currently exposes. `engine`'s own backlog is fully empty (every item done, `.vibe/backlog/` has no open items) — there is no existing engine item to point at as the blocker; a power/meter mechanic would need to be scoped as new engine work first. Lifebar-health-sync and round-display alone could be built, but the acceptance criteria as written are one coherent HUD, not independently splittable (per this skill's own scope-check: they're the same screen, not separately shippable capabilities) — implementing 4 of 5 criteria and silently dropping the power bar would misrepresent the item as done. Leaving `status: blocked` until `engine` models and exposes a power/meter value.

## Unblocked
2026-09-23: `engine#019` (Model And Expose Power/Meter System) shipped and published as `engine` `v2.4.0` (tag pushed, GitHub release created) — `match.FighterState`/the WASM `tick`/`newMatch`/`resetRound` JSON contract now carry each fighter's power/meter value (0–3000, via the new `PowerAdd` controller). Back to `status: todo`.

## Done
2026-09-24: Implemented as a new `src/hud/` module (`hud-view-model.ts` for pure validation/derivation, `hud-renderer.ts` for the DOM). All five acceptance criteria met: lifebars and a power/meter bar for both players update every rendered frame the match simulates; the round display shows the round number, each player's wins, and the best-of; malformed/unexpected `engine` data degrades the whole HUD to one clear, translated error region (recovering automatically once data is valid again) without ever stopping match simulation or input handling, verified by a dedicated integration test and confirmed in a real running match. `engine` v2.4.0's real published WASM release was downloaded and used throughout (previously built locally, since `engine` had no release assets before this). See `.vibe/decisions/009` for the design rationale.
