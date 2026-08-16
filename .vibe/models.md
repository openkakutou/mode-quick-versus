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
