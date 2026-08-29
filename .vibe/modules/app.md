# Module: app
**Role:** Composition root. Builds the `web-ui-kit` app shell, discovers the character roster and mounts the character selection screen, then — once both players continue — discovers the stage list and mounts the stage selection screen, showing a final confirmation naming both players' picks and the chosen stage.
**Files:** `src/main.ts`, `src/version.ts`
**Exports:** `appVersion: string`, `renderApp(root, version, options?): Promise<void>`
**Depends on:** `modules/wasm.md`, `modules/roster.md`, `modules/stage.md`, `modules/selection.md`
