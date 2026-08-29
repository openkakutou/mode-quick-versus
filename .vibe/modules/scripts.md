# Module: scripts
**Role:** Dev-tooling scripts outside the app bundle — downloading a WASM dependency's release build, targeting either `character` (default) or `stage`. The `stage` target's `wasm_exec.js` is written to disk as `stage-wasm_exec.js` rather than overwriting `character`'s own copy, since the two modules are released independently.
**Files:** `scripts/download-wasm.mjs`
**Exports:** `downloadWasmRelease(options): Promise<string[]>`, `main(argv, overrides): Promise<number>`, `DownloadError`, `EXIT_CODES`
**Depends on:** (none)
