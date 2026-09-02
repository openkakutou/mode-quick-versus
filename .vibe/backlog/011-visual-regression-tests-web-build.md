---
status: todo
---
# Visual Regression Tests (Web Build)

## Description
Add automated Playwright screenshot-comparison tests for this app's web build, covering its real rendered surfaces as they exist today — the roster selection grid (Player 1 / Player 2 picks) and the stage selection grid, populated from a real manifest/fixture. See roadmap decision `024-visual-regression-testing-via-playwright-screenshots.md` for the shared approach and its explicit carve-out of the native (Go/`go-gl`+SDL2) desktop build, which has no Playwright/DOM surface and is out of scope here.

## Acceptance Criteria
- [ ] The app's Playwright config extends `web-ui-kit`'s shared visual-testing config/fixture
- [ ] Baseline screenshots exist for: the roster grid with a real character selected per player, and the stage grid with a stage selected
- [ ] `npm run test:visual` runs these in CI as its own job, separate from `npm test`, and fails the build on a diff
- [ ] A real, deliberate rendering regression (verified by temporarily breaking one covered path, then reverting) is caught by this suite

## Notes
Depends on `web-ui-kit` backlog item `013-visual-regression-shared-playwright-config-and-component-snapshots` landing first. This is the highest-value target in the whole org for this kind of testing once it exists — an actual in-match frame (character + stage + lifebar composited live) — but that rendering doesn't exist yet (no match/HUD module in this repo as of this writing, only character/stage selection and match setup). Extend this item, or open a follow-up, once match rendering lands; don't fabricate coverage for a screen that isn't built.
