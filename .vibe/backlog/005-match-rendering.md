---
status: todo
depends_on: [003]
---
# Match Rendering

## Description
Render the actual match scene — both characters' sprites (via the `character` and `sff` WASM builds) composited over the selected stage's layers and background (via the `stage` WASM build) — continuously driven by `engine`'s live position/animation state for each character. This is the visual core of the game: everything the HUD (item 004) overlays on top of.

## Acceptance Criteria
- [ ] Both characters render at their live position with the correct current animation/sprite frame, driven by `engine` state
- [ ] The selected stage's layers/background render with correct parallax/composition ordering relative to the characters
- [ ] A missing or unresolvable sprite/palette reference degrades to a visible placeholder instead of a crash or a blank frame
- [ ] Rendering keeps pace with `engine`'s simulation rate without visibly falling behind under normal match conditions

## Notes
Cross-repo blocker: needs the `character`, `stage`, and `sff` WASM builds to expose actual pixel/sprite data (not just metadata) and needs `engine` to expose live per-character position/animation state.

Re-checked 2026-08-31: the pixel-data half is resolved — `character`'s `resolveSprites` (item 034) and `stage`'s `resolveSprites` (item 010) both expose decoded pixel buffers via WASM, and `engine`'s WASM entrypoint (item 009) exists and returns live per-fighter `Position`/`Facing`/`StateNo`. The animation half is not: `tick`'s response never exposes the resolved animation number or frame timing (`FighterRuntime.Context.Anim`/`AnimTime` stay Go-side by design, see `engine`'s `.vibe/decisions/011`), and `StateNo` alone cannot substitute for it (a state's `Anim` can differ from its number via `changeanim`). Tracked as `engine` backlog item `017`.

## Blocked
2026-08-31: `engine`'s WASM `tick`/`newMatch`/`resetRound` responses expose fighter position/state number but not the resolved animation number or frame timing, so this item cannot pick the correct sprite/frame per fighter yet. Filed as `engine` backlog item `017` (Expose Current Animation Number And Frame Timing Via WASM). Re-run `/vibe:feature 005` once that item is done and published (tagged release).

## Unblocked
2026-09-07: `engine#017` is `status: done` and published as `engine` `v2.1.0` (tag pushed to the remote) — the WASM `tick`/`newMatch`/`resetRound` responses now expose each fighter's resolved animation number and frame timing alongside position/facing/state. Both cross-repo prerequisites named above (`character`/`stage` pixel data, `engine` animation/frame state) are now met. Back to `status: todo`.
