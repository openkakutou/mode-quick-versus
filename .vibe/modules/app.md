# Module: app
**Role:** Composition root. Builds the `web-ui-kit` app shell, discovers the character roster and mounts the character selection screen, then — once both players continue — discovers the stage list and mounts the stage selection screen, then — once a stage is chosen — mounts the match setup screen, then — once setup is confirmed — re-fetches and re-loads both players' character files and the chosen stage's file (discovery itself never retains raw bytes/full data, only the name) and starts match rendering. A fetch/load failure at that point degrades to a clear error message, same handling used at every earlier screen boundary.
**Files:** `src/main.ts`, `src/version.ts`
**Exports:** `appVersion: string`, `renderApp(root, version, options?): Promise<void>`
**Depends on:** `modules/wasm.md`, `modules/roster.md`, `modules/stage.md`, `modules/selection.md`, `modules/setup.md`, `modules/rendering.md`
