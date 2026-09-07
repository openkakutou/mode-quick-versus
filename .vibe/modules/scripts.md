# Module: scripts
**Role:** Dev-tooling scripts outside the app bundle — downloading a WASM dependency's release build, targeting `character` (default), `stage`, or `engine`. The `stage`/`engine` targets' `wasm_exec.js` are each written to disk under their own name (`stage-wasm_exec.js`/`engine-wasm_exec.js`) rather than overwriting `character`'s own copy, since the modules are released independently. `engine` has no published release with build assets attached yet (see `.vibe/decisions/004`) — this target is wired up ready for when one exists.
**Files:** `scripts/download-wasm.mjs`
**Exports:** `downloadWasmRelease(options): Promise<string[]>`, `main(argv, overrides): Promise<number>`, `DownloadError`, `EXIT_CODES`
**Depends on:** (none)
