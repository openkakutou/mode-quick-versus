# Module: wasm
**Role:** Bridge to the `character` WASM module: loads it client-side and exposes a typed `loadCharacter` returning either a character's name or a descriptive error, never throwing.
**Files:** `src/wasm/bridge.ts`, `src/wasm/types.ts`
**Exports:** `loadCharacter(defBytes, airBytes, sffBytes, cnsBytes, options?): Promise<CharacterResult>`, `resetWasmBridgeForTests(): void`, `WasmBridgeOptions`, `CharacterSummary`, `CharacterResult`
**Depends on:** (none — talks directly to the `character` WASM module)
