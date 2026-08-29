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
| name | string | The loaded character's name (`CharacterSummary`) |
| ok / character / error | `true` + `CharacterSummary`, or `false` + string | `CharacterResult` discriminated union — mirrors the WASM module's own `{character, error}` contract, never throws |
Defined in: `src/wasm/types.ts`

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

## StageSummary / StageResult
| Field | Type | Notes |
|---|---|---|
| name | string | The loaded stage's name (`StageSummary`) |
| ok / stage / error | `true` + `StageSummary`, or `false` + string | `StageResult` discriminated union — mirrors the WASM module's own `{stage, error}` contract, never throws |
Defined in: `src/wasm/stage-types.ts`
