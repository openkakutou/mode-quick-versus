---
status: blocked
---
# Stage Selection Screen

## Description
A screen, independent of character selection, that discovers which stages are available (via the `stage` WASM build) and lets the players pick one to fight on. Like character discovery, "available" means whatever stage sources the static build is configured with, since there is no backend catalog.

## Acceptance Criteria
- [ ] The list of available stages is discovered and displayed with enough identifying info (name, preview) to choose from
- [ ] A stage can be selected and the choice is carried forward into match setup
- [ ] Players cannot proceed to match setup without a stage selected
- [ ] A stage that fails to load (corrupt or incomplete `.def`) shows a clear error state instead of crashing the screen or silently omitting the entry

## Notes
Cross-repo blocker discovered while attempting implementation (not previously recorded here): the `stage` repo has no WASM entrypoint at all yet — no `cmd/wasm/` package, no built `stage.wasm`, no release publishing it. That's tracked as `stage`'s own `.vibe/backlog/006-wasm-entrypoint-and-release-pipeline.md`, currently `status: todo` and itself blocked on `stage`'s item `005`. This mirrors the exact blocker already recorded on `stage-viewer-web`'s item `001` and `stage-editor`'s item `001` — this item needs the same phrasing added. Nothing in this repo can "discover stages via the `stage` WASM build" until that pipeline exists and publishes a tagged release.

## Blocked
2026-08-24: depends on `stage` repo shipping a WASM entrypoint + release pipeline (`stage#006`, not done — itself blocked on `stage#005`).
