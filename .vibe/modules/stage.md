# Module: stage
**Role:** Fetches and validates the deploy-time stage manifest, then discovers the actual stage list by loading each entry's `.def` file through the `stage` WASM bridge — every entry resolves independently into an ok/error result. Mirrors `modules/roster.md`'s shape for the character roster.
**Files:** `src/stage/manifest.ts`, `src/stage/discovery.ts`
**Exports:** `fetchStageManifest(options?): Promise<StageManifestResult>`, `StageManifestEntry`, `discoverStages(entries, deps): Promise<DiscoveredStage[]>`, `DiscoveredStage`, `DiscoverStagesDeps`
**Depends on:** `modules/wasm.md`
