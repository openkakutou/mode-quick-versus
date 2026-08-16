# Module: roster
**Role:** Fetches and validates the deploy-time roster manifest, then discovers the actual roster by loading each entry's character files through the WASM bridge — every entry resolves independently into an ok/error result.
**Files:** `src/roster/manifest.ts`, `src/roster/discovery.ts`
**Exports:** `fetchRosterManifest(options?): Promise<RosterManifestResult>`, `RosterManifestEntry`, `discoverRoster(entries, deps): Promise<DiscoveredCharacter[]>`, `DiscoveredCharacter`, `DiscoverRosterDeps`
**Depends on:** `modules/wasm.md`
