# Module: wasm
**Role:** One bridge per WASM dependency, each its own Go program with its own runtime instance: `bridge.ts` bridges to the `character` WASM module, `stage-bridge.ts` bridges to the `stage` WASM module. Both expose a typed loader returning either the loaded summary or a descriptive error, never throwing.
**Files:** `src/wasm/bridge.ts`, `src/wasm/types.ts`, `src/wasm/stage-bridge.ts`, `src/wasm/stage-types.ts`
**Exports:** `loadCharacter(defBytes, airBytes, sffBytes, cnsBytes, options?): Promise<CharacterResult>`, `resetWasmBridgeForTests(): void`, `WasmBridgeOptions`, `CharacterSummary`, `CharacterResult`, `loadStage(defBytes, options?): Promise<StageResult>`, `resetStageWasmBridgeForTests(): void`, `StageWasmBridgeOptions`, `StageSummary`, `StageResult`
**Depends on:** (none — talks directly to the `character`/`stage` WASM modules)
