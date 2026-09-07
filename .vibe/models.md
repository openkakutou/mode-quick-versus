# Data models

## RosterManifestEntry
| Field | Type | Notes |
|---|---|---|
| id | string | Stable identifier for the character |
| files.def / files.air / files.sff / files.cns | string | Fetchable paths to the character's files |
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
| starting | `[FighterState, FighterState]` | Each fighter's starting position, facing, state number, health |
| roundTimer, bestOf, bounds, gravity, comboWindow | number / `StageBoundaries` / number | Match-level simulation config |
| matchId, inputs | number / `[TickInput, TickInput]` | `TickRequest` only — the session to advance and this tick's raw input |
Defined in: `src/wasm/engine-types.ts`; assembled by `src/rendering/match-config.ts`'s `buildNewMatchRequest`

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
