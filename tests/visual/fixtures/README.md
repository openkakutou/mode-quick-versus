# Visual regression fixtures

Real, committed fixture data served by a dedicated Vite config
(`vite.visual.config.ts`'s `publicDir`) to the app's own, otherwise-unmodified
`index.html`/`src/main.ts` entry point during `npm run test:visual` (backlog
item 011). See `.vibe/decisions/008-visual-regression-fixture-serving-strategy.md`
for why this app needs its own fixture-serving strategy, distinct from
sibling apps' upload-driven approach.

## `roster-manifest.json` / `stage-manifest.json`

Fixture manifests in the same shape `src/roster/manifest.ts`/
`src/stage/manifest.ts` validate — deliberately never copies of the real,
deploy-specific (currently empty) `public/roster-manifest.json`/
`stage-manifest.json`.

## `character/`

Two fixture characters (`fighter-a.def` / `fighter-b.def`, distinct names and
portraits so the roster grid baseline visibly shows two different players'
picks) sharing one minimal `.air`/`.cns`/`.sff`/`.cmd` fixture set copied
from this repo's own `src/wasm/testdata/` — the same fixture bytes already
proven against the real `character` WASM module by
`src/roster/discovery.smoke.test.ts`. `portrait-a.png`/`portrait-b.png` are
small real PNGs (not placeholders/broken-image references).

## `stage/`

One fixture stage (`training-room.def`, a minimal real `.def` with just
`[Info]`/`[BGDef]` — sufficient for the stage selection screen, which never
loads the stage's own sprite sheet) plus its own real portrait PNG.

## `wasm/`

**Not committed** (gitignored, mirroring `public/wasm/`). Prepared fresh
before each `test:visual` run by `scripts/prepare-visual-fixtures.mjs`,
which copies the already-downloaded `character`/`stage` WASM release assets
from `public/wasm/` — run `npm run wasm:download` and
`npm run wasm:download:stage` first if they are not already present.

## Regenerating

Hand-edit the `.def`/JSON files directly for small changes. To replace
`fighter.air`/`fighter.cns`/`fighter.sff`/`fighter.cmd` or the portrait PNGs,
copy from `src/wasm/testdata/` or regenerate small real PNGs — never
fabricate bytes for a format an app's own WASM bridge actually parses.
