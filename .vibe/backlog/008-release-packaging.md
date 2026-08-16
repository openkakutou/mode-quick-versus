---
status: todo
depends_on: [007]
---
# Release Packaging

## Description
Package the finished game two different ways from the one frontend codebase, per roadmap `.vibe/decisions/021`:
1. **Web**: the standard Vite production build (`npm run build`), producing a `dist/` output that includes or correctly references the required WASM assets (`character.wasm`, `stage.wasm`, `sff.wasm`, `engine.wasm`) so the game runs entirely client-side, deployed to GitHub Pages (mirrors the `*-viewer-web`/`*-editor` pattern, roadmap `.vibe/decisions/015`). This is the only target that needs the WASM assets at all.
2. **Desktop + Android**: wrap the same TypeScript/`web-ui-kit` frontend with [Wails](https://wails.io/) to produce native Windows, Mac, and Linux desktop binaries, plus an Android build via Wails' mobile support. No WASM involved — the Wails Go backend imports `character`/`stage`/`sff`/`engine` directly as native Go packages, and the frontend talks to it over Wails' JS↔Go bindings instead of loading `.wasm` files.

## Acceptance Criteria
- [ ] `npm run build` produces a `dist/` bundle that runs the full game (selection through result) when served as static files, with no server-side component
- [ ] The **web** build correctly includes/references all four required WASM assets at their expected runtime paths
- [ ] A missing or mismatched-version WASM asset at runtime (web build only) shows a clear error state instead of a blank page or silent failure
- [ ] The web build deploys to GitHub Pages via a `deploy-pages.yml` workflow (same shape as the other repos), reachable at `https://openkakutou.github.io/mode-quick-versus/`
- [ ] A Wails project wraps the frontend and produces a working Windows binary, a working Mac binary, and a working Linux binary, each importing `character`/`stage`/`sff`/`engine` as native Go packages (no WASM asset download/bundling step for these builds)
- [ ] A Wails Android build produces a working package — flagged as experimental upstream (roadmap backlog `009` tracks validating this before treating Android as confirmed; may block this specific criterion independent of the rest)
- [ ] Each platform's build/release process is documented (e.g. in README usage) so a fresh checkout can reproduce every deployable artifact
- [ ] `openkakutou.github.io`'s Quick Versus card gets its pending platform pills flipped to live links as each artifact becomes available

## Notes
Desktop/mobile packaging strategy decided 2026-08-16, resolving roadmap backlog `006`: originally Tauri (`.vibe/decisions/020`), superseded the same day by **Wails** (`.vibe/decisions/021`) once roadmap backlog `008`'s spike led to keeping the core in Go — see that decision for the full reasoning and rejected alternatives.
