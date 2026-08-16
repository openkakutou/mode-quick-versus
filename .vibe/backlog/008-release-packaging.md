---
status: todo
depends_on: [007]
---
# Release Packaging

## Description
Package the finished game two ways from the one codebase, per roadmap `.vibe/decisions/020`:
1. **Web**: the standard Vite production build (`npm run build`), producing a `dist/` output that includes or correctly references the required WASM assets (`character.wasm`, `stage.wasm`, `sff.wasm`, `engine.wasm`) so the game runs entirely client-side, deployed to GitHub Pages (mirrors the `*-viewer-web`/`*-editor` pattern, roadmap `.vibe/decisions/015`).
2. **Desktop + Android**: wrap that same web build with [Tauri](https://tauri.app/) to produce native Windows, Mac, and Linux desktop binaries, plus an Android build via Tauri Mobile — no separate native codebase, the Tauri shell renders the same built web app in the OS's own webview.

## Acceptance Criteria
- [ ] `npm run build` produces a `dist/` bundle that runs the full game (selection through result) when served as static files, with no server-side component
- [ ] The build correctly includes/references all four required WASM assets at their expected runtime paths
- [ ] A missing or mismatched-version WASM asset at runtime shows a clear error state instead of a blank page or silent failure
- [ ] The web build deploys to GitHub Pages via a `deploy-pages.yml` workflow (same shape as the other repos), reachable at `https://openkakutou.github.io/mode-quick-versus/`
- [ ] A Tauri project wraps the build and produces a working Windows binary, a working Mac binary, and a working Linux binary
- [ ] A Tauri Mobile build produces a working Android package
- [ ] Each platform's build/release process is documented (e.g. in README usage) so a fresh checkout can reproduce every deployable artifact
- [ ] `openkakutou.github.io`'s Quick Versus card gets its pending platform pills flipped to live links as each artifact becomes available

## Notes
Desktop/mobile packaging strategy (Tauri) decided 2026-08-16, resolving roadmap backlog `006` — see roadmap `.vibe/decisions/020` for the full reasoning and rejected alternatives (Electron, a native rewrite).
