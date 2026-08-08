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
