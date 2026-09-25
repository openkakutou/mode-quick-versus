---
status: done
---
# Refresh Visual Regression Baselines

## Description
The roster/stage screen screenshot baselines (`tests/visual/roster-stage.visual.spec.ts-snapshots/`) are now off by about 1% of pixels (sub-pixel font/rendering drift) from a fresh run, even inside the exact pinned `mcr.microsoft.com/playwright` container image the visual regression suite is designed to be trustworthy under. This is unrelated to any app code change — discovered while verifying backlog item 008's release-packaging deploy pipeline, and matches the exact baseline-drift failure mode `ci.yml`'s own comments already anticipate (font/GL rendering shifting between runs of the same pinned image over time).

## Acceptance Criteria
- [x] The roster/stage visual regression baselines are regenerated (`npm run test:visual:update`) run through the pinned Playwright container image, not a bare host
- [x] `npm run test:visual` passes with zero diffs immediately afterward, run through that same pinned image
- [x] Only the regenerated baseline PNGs change — no unrelated app code

## Notes
Fixed by two temporary `workflow_dispatch` runs inside the exact pinned container (mirroring `web-ui-kit`'s own precedent for this same drift class): one regenerated `roster-card-player1-picked`/`roster-card-player2-picked` (the two actually drifted; `stage-grid-selected` was unaffected), the other re-ran `test:visual` against the new baselines to confirm zero diffs — both temp workflows removed afterward. Discovered blocking the very first real run of `deploy-pages.yml` (backlog item 008), not just theoretical.
