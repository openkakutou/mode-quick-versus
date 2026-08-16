# Module: app
**Role:** Composition root. Builds the `web-ui-kit` app shell, discovers the character roster, and mounts the selection screen — showing both players' confirmed picks once they continue.
**Files:** `src/main.ts`, `src/version.ts`
**Exports:** `appVersion: string`, `renderApp(root, version, options?): Promise<void>`
**Depends on:** `modules/wasm.md`, `modules/roster.md`, `modules/selection.md`
