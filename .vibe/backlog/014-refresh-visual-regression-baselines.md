---
status: todo
---
# Refresh Visual Regression Baselines

## Description
The roster/stage screen screenshot baselines (`tests/visual/roster-stage.visual.spec.ts-snapshots/`) are now off by about 1% of pixels (sub-pixel font/rendering drift) from a fresh run, even inside the exact pinned `mcr.microsoft.com/playwright` container image the visual regression suite is designed to be trustworthy under. This is unrelated to any app code change — discovered while verifying backlog item 008's release-packaging deploy pipeline, and matches the exact baseline-drift failure mode `ci.yml`'s own comments already anticipate (font/GL rendering shifting between runs of the same pinned image over time).

## Acceptance Criteria
- [ ] The roster/stage visual regression baselines are regenerated (`npm run test:visual:update`) run through the pinned Playwright container image, not a bare host
- [ ] `npm run test:visual` passes with zero diffs immediately afterward, run through that same pinned image
- [ ] Only the regenerated baseline PNGs change — no unrelated app code

## Notes
None.
