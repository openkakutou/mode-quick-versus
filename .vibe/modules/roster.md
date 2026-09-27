# Module: roster
**Role:** Fetches and validates the deploy-time roster manifest, then discovers the actual roster by loading each entry's character files through the WASM bridge — every entry resolves independently into an ok/error result. A manifest entry's `.snd` sound file path (backlog item 013) is optional — legitimately absent for a character with no sound effects — and is not fetched during discovery itself (discovery only needs a character's name); it's fetched and forwarded to `loadCharacter` at actual match-start time, see `modules/app.md`.
**Files:** `src/roster/manifest.ts`, `src/roster/discovery.ts`
**Exports:** `fetchRosterManifest(options?): Promise<RosterManifestResult>`, `RosterManifestEntry`, `discoverRoster(entries, deps): Promise<DiscoveredCharacter[]>`, `DiscoveredCharacter`, `DiscoverRosterDeps`
**Depends on:** `modules/wasm.md`
