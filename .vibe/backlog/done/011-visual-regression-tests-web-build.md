---
status: done
---
# Visual Regression Tests (Web Build)

## Description
Add automated Playwright screenshot-comparison tests for this app's web build, covering its real rendered surfaces as they exist today — the roster selection grid (Player 1 / Player 2 picks) and the stage selection grid, populated from a real manifest/fixture. See roadmap decision `024-visual-regression-testing-via-playwright-screenshots.md` for the shared approach and its explicit carve-out of the native (Go/`go-gl`+SDL2) desktop build, which has no Playwright/DOM surface and is out of scope here.

## Acceptance Criteria
- [x] The app's Playwright config extends `web-ui-kit`'s shared visual-testing config/fixture
- [x] Baseline screenshots exist for: the roster grid with a real character selected per player, and the stage grid with a stage selected
- [x] `npm run test:visual` runs these in CI as its own job, separate from `npm test`, and fails the build on a diff
- [x] A real, deliberate rendering regression (verified by temporarily breaking one covered path, then reverting) is caught by this suite

## Resolution
`playwright.config.ts` spreads `web-ui-kit`'s `createVisualProjectConfig()` (`@openkakutou/web-ui-kit/testing/visual-preset`), with a stricter `maxDiffPixelRatio` (0.005 vs. the shared 0.02 default — see below). `tests/visual/roster-stage.visual.spec.ts` drives the app's real roster and stage selection screens through real clicks against real, committed fixture character/stage data (`tests/visual/fixtures/`, see its README and `.vibe/decisions/008`), served through a dedicated `vite.visual.config.ts` whose `publicDir` points at the fixtures instead of the app's real (deploy-specific, empty) `public/roster-manifest.json`/`stage-manifest.json` — the same, unmodified production `index.html`/`main.ts` entry point renders it, through the real `character`/`stage` WASM bridges. `scripts/prepare-visual-fixtures.mjs` copies the already-downloaded WASM binaries into the fixture `publicDir` before each run. This repo's first CI workflow (`.github/workflows/ci.yml`) runs lint + `npm run test:visual` on every push/PR (scoped decision on why `npm test` isn't also wired in yet: see `.vibe/decisions/008`).

The regression-catch requirement was verified live, twice: an initial deliberate regression (a picked roster button's color always rendering as "secondary") was *not* caught by the shared default threshold even scoped to a single character card's own screenshot (measured ~1.7% of that card's pixels, under the 2% default) — this directly motivated overriding the threshold to 0.005 rather than shipping the shared default un-verified. With the stricter threshold in place, the same regression was reintroduced and confirmed caught, then reverted and confirmed passing again.

## Notes
Depended on `web-ui-kit` backlog item `013-visual-regression-shared-playwright-config-and-component-snapshots` (done, `visual-preset` available since `web-ui-kit` v0.8.0, already covered by this repo's pinned `^0.13.0`). Match rendering itself (character + stage sprites composited live, backlog item 005) has since landed, but the in-match HUD/lifebar (backlog item 004) is still `blocked` — an actual in-match frame including the lifebar, the highest-value target in the whole org for this kind of testing, is still not fully ready to baseline. A follow-up item should extend coverage to the match scene once item 004 unblocks; this item stays scoped to the two selection screens named in its own acceptance criteria.
