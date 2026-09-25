# Data models

## RosterManifestEntry
| Field | Type | Notes |
|---|---|---|
| id | string | Stable identifier for the character |
| files.def / files.air / files.sff / files.cns / files.cmd | string | Fetchable paths to the character's files, including its `.cmd` input command file |
| portrait | string | Fetchable path to a static preview image |
Defined in: `src/roster/manifest.ts`

## DiscoveredCharacter
| Field | Type | Notes |
|---|---|---|
| id | string | Same as the source `RosterManifestEntry.id` |
| portrait | string | Same as the source `RosterManifestEntry.portrait` |
| status | `"ok" \| "error"` | Discriminant |
| name | string | Present only when `status: "ok"` — the character's loaded name |
| message | string | Present only when `status: "error"` — why the character failed to load |
Defined in: `src/roster/discovery.ts`

## CharacterSummary / CharacterResult
| Field | Type | Notes |
|---|---|---|
| name | string | The loaded character's name |
| animations | `Animation[]` | Every `.air` action: its number, frames (sprite ref, position, time, flip, blend, Clsn boxes), and loop-start index |
| sprites | `SpriteGroup[]` | Sprite metadata (dimensions, axis/pivot) per `(group, image)` — no pixel data; see `resolveSprites` |
| stateDefs | `StateDefBlob[]` | Opaque combat state defs, forwarded to `engine` unmodified — never interpreted client-side |
| ok / character / error | `true` + `CharacterSummary`, or `false` + string | `CharacterResult` discriminated union — mirrors the WASM module's own `{character, error}` contract, never throws |
Defined in: `src/wasm/types.ts`

## SpritePixelResult
| Field | Type | Notes |
|---|---|---|
| ok / pixels / width / height / error | `true` + decoded RGBA pixels + dimensions, or `false` + string | One `resolveSprites` request's result — flat, row-major, straight (non-premultiplied) alpha |
Defined in: `src/wasm/types.ts` (character), `src/wasm/stage-types.ts` (stage, as `StageSpritePixelResult`)

## StageManifestEntry
| Field | Type | Notes |
|---|---|---|
| id | string | Stable identifier for the stage |
| files.def | string | Fetchable path to the stage's `.def` file |
| portrait | string | Fetchable path to a static preview image |
Defined in: `src/stage/manifest.ts`

## DiscoveredStage
| Field | Type | Notes |
|---|---|---|
| id | string | Same as the source `StageManifestEntry.id` |
| portrait | string | Same as the source `StageManifestEntry.portrait` |
| status | `"ok" \| "error"` | Discriminant |
| name | string | Present only when `status: "ok"` — the stage's loaded name |
| message | string | Present only when `status: "error"` — why the stage failed to load |
Defined in: `src/stage/discovery.ts`

## MatchSetupConfig
| Field | Type | Notes |
|---|---|---|
| rounds | number | The chosen round count, a positive odd integer |
| timeLimit | `TimeLimitOption` | The chosen per-round time limit |
| player2Control | `"human" \| "cpu"` | Who drives player 2 (backlog item 007) — pre-selected to `"human"`, unlike the two fields above |
Defined in: `src/setup/setup-screen.ts`

## TimeLimitOption
| Field | Type | Notes |
|---|---|---|
| seconds | number | A fixed duration in seconds (positive integer) |
| (or) | `"unlimited"` | The literal tag — no timer at all, never a numeric sentinel |
Defined in: `src/setup/setup-screen.ts`

## StageSummary / StageResult
| Field | Type | Notes |
|---|---|---|
| name | string | The loaded stage's name |
| bgDef | `BGdef` | Stage-level settings: sprite sheet path, local coordinate space, ground level (`zOffset`), zoom range |
| elements | `BGElement[]` | BG layers: type (normal/parallax/anim), sprite/action reference, layer number, position, parallax delta, tiling |
| animations | `Record<string, BGAnimation>` | Every `[Begin Action N]` block, keyed by action number as a string, resolved via `resolveAnimationFrames` |
| stageBoundaries | `StageBoundaries` | The x-range characters may move within on this stage |
| ok / stage / error | `true` + `StageSummary`, or `false` + string | `StageResult` discriminated union — mirrors the WASM module's own `{stage, error}` contract, never throws |
Defined in: `src/wasm/stage-types.ts`

## NewMatchRequest / TickRequest (engine bridge)
| Field | Type | Notes |
|---|---|---|
| programs | `[FighterProgram, FighterProgram]` | Each fighter's state defs (keyed by number), animations, and command file |
| starting | `[FighterState, FighterState]` | Each fighter's starting position, facing, state number, health, power (always sent as 0 — `engine` itself always resets a caller-supplied power to 0 at match/round start) |
| roundTimer, bestOf, bounds, gravity, comboWindow | number / `StageBoundaries` / number | Match-level simulation config |
| matchId, inputs | number / `[TickInput, TickInput]` | `TickRequest` only — the session to advance and this tick's raw input |
Defined in: `src/wasm/engine-types.ts`; assembled by `src/rendering/match-config.ts`'s `buildNewMatchRequest`. `FighterState.power` (`[0, 3000]`, `engine`'s own hardcoded power/meter cap, not itself part of this JSON contract — see `HudViewModel` below) is read live from every `tick`/`newMatch` response by the HUD.

## RoundResult / Progress / ResetRoundRequest (engine bridge)
| Field | Type | Notes |
|---|---|---|
| outcome | number | `0` = still in progress; `1` = KO; `2` = double KO (draw); `3` = timeout (unequal health); `4` = timeout at equal health (draw) — `engine`'s own `round.Outcome` enum, only meaningful once `!= 0` |
| winner | `0 \| 1` | Only meaningful for outcome `1`/`3` — the deciding side |
| progress.bestOf, .wins, .roundsPlayed | number / `[number, number]` / number | Match-level bookkeeping across rounds, carried in every `tick()`/`newMatch()` response; untouched by `resetRound()` |
| matchOver, matchWinner | boolean / `0 \| 1` | `tick()`-only: whether the whole match (not just this round) is decided, and by whom |
| resetRound: matchId, roundTimer, starting | number / number / `[FighterState, FighterState]` | `ResetRoundRequest` — the next round number is computed by the session itself, never supplied |
Defined in: `src/wasm/engine-types.ts` (`RoundResult`, `Progress`, `ResetRoundRequest`, `ResetRoundResponseData`); consumed by `src/result/outcome.ts`'s `deriveRoundOutcome`/`deriveMatchOutcome` and `src/rendering/match-renderer.ts`'s round-end handling. See `.vibe/decisions/010`.

## RoundEndView / MatchEndView (result screen)
| Field | Type | Notes |
|---|---|---|
| round | number | `RoundEndView` only — the round number that just ended |
| winner | `"p1" \| "p2" \| "draw"` | A clean, defensive reading of `RoundResult`/`matchWinner` — an outcome/winner value `engine` isn't documented to produce also reads as `"draw"`, never left undefined |
Defined in: `src/result/outcome.ts`; built by `deriveRoundOutcome`/`deriveMatchOutcome`, rendered by `src/result/result-screen.ts`'s `createResultOverlay`.

## CpuObservation
| Field | Type | Notes |
|---|---|---|
| self.position, opponent.position | `Position` (`{x, y}`) | The only state the CPU opponent decides from — a live snapshot read via a closure supplied at construction time, not a change to `TickInputSource.read()`'s own signature |
Defined in: `src/cpu/cpu-controller.ts`; consumed by `createCpuController().decide()` and supplied by `src/cpu/cpu-input-source.ts`'s `createCpuAwareInputSource`.

## HudViewModel (in-match HUD)
| Field | Type | Notes |
|---|---|---|
| fighters | `[HudFighterView, HudFighterView]` | Each `{ healthPercent, powerPercent }` — clamped to `[0, 100]` against the app's placeholder health/power maxima |
| roundInfo | `{ round, wins: [number, number], bestOf }` | Sourced from `engine`'s `MatchState.round` and `Progress.wins`/`bestOf` |
Defined in: `src/hud/hud-view-model.ts`; derived from `engine`'s raw, untrusted `MatchState`/`Progress` by `deriveHudViewModel`, which returns a typed error instead of a `HudViewModel` for any missing/invalid field (see `.vibe/decisions/009`).

## CommandFile
| Field | Type | Notes |
|---|---|---|
| remap | `Record<string, string>` | Button-name remapping declared by the `.cmd` file's own `[Remap]` section |
| defaults | `{ time, bufferTime }` | Default command recognition-window timings |
| commands | `CommandDefinition[]` | Each declared command's name and raw, unevaluated input string |
| states | `StateDefBlob[]` | Any `Statedef -1`-style always-active states the `.cmd` file itself declares |
Defined in: `src/wasm/types.ts`; parsed via `src/wasm/bridge.ts`'s `loadCmd`, threaded into a fighter's `NewMatchRequest.programs[n].commands` by `src/rendering/match-config.ts`'s `buildFighterProgram` (falling back to an empty command file when none is supplied or parsing fails)

## RawPlayerInput / TickInput
| Field | Type | Notes |
|---|---|---|
| up, down, left, right | boolean | Raw physical directions currently held — not facing-relative |
| buttons | `Record<ButtonName, boolean>` | Currently-held button names (`a b c x y z`), matching a `.cmd` file's own lowercase tokens |
Defined in: `src/input/types.ts` (`RawPlayerInput`, every field always present); `src/wasm/engine-types.ts` (`TickInput`, the same shape with every field optional — `engine`'s own per-tick request contract). `src/input/tick-input-source.ts`'s `read()` produces one pair per rendered frame, reused for every simulation tick that frame's fixed-timestep loop runs.

## KeyboardPlayerBindings
| Field | Type | Notes |
|---|---|---|
| up, down, left, right | string | `KeyboardEvent.code` values (physical key, layout-independent) |
| buttons | `Record<ButtonName, string>` | `KeyboardEvent.code` per button name |
Defined in: `src/input/key-bindings.ts`; `DEFAULT_KEYBOARD_BINDINGS` gives Player 1 a WASD-based block and Player 2 an arrow-key-based block, spatially separate so two players can share one keyboard without a key ever bound to both.

## DrawCommand
| Field | Type | Notes |
|---|---|---|
| kind | `"sprite" \| "placeholder"` | Discriminant |
| canvasX, canvasY | number | The sprite's axis (pivot) point in canvas space |
| axisX, axisY | number | That point's pixel offset within the sprite image from its own top-left |
| width, height | number | Sprite/placeholder dimensions |
| pixels | `Uint8Array` | Only present for `kind: "sprite"` |
| flipH, flipV | boolean | Resolved mirroring — facing/frame-flip for a fighter, always `false` for a stage element (no axis metadata available, see `.vibe/decisions/004`) |
Defined in: `src/rendering/scene-composition.ts`
