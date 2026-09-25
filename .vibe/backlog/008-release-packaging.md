---
status: blocked
depends_on: [007]
---
# Release Packaging

## Description
Package the finished game two entirely separate ways, per roadmap `.vibe/decisions/022` — not one shared codebase wrapped differently, two distinct implementations:
1. **Web**: the standard Vite production build (`npm run build`) of the TypeScript/`web-ui-kit` frontend, producing a `dist/` output that includes or correctly references the required WASM assets (`character.wasm`, `stage.wasm`, `sff.wasm`, `engine.wasm`) so the game runs entirely client-side, deployed to GitHub Pages (mirrors the `*-viewer-web`/`*-editor` pattern, roadmap `.vibe/decisions/015`). This is the only target that needs the WASM assets at all.
2. **Windows/Mac/Linux/Android**: a separate native Go program using `go-gl` (raw OpenGL bindings) + `veandco/go-sdl2` for windowing/input/context — mirroring [Ikemen GO](https://github.com/ikemen-engine/Ikemen-GO)'s own stack (see `benchmarks/render-lang-spike/` for the spike that validated this over Ebiten). Imports `character`/`stage`/`sff`/`engine` as native Go packages (no WASM). Every screen — selection, setup, HUD, result — is this program's own rendering code; none of the web frontend's UI is reused.

## Acceptance Criteria
- [ ] `npm run build` produces a `dist/` bundle that runs the full game (selection through result) when served as static files, with no server-side component
- [x] The **web** build correctly includes/references all four required WASM assets at their expected runtime paths — in practice three: this app never loads a separate `sff.wasm` module, see `.vibe/decisions/011`
- [x] A missing or mismatched-version WASM asset at runtime (web build only) shows a clear error state instead of a blank page or silent failure
- [ ] The web build deploys to GitHub Pages via a `deploy-pages.yml` workflow (same shape as the other repos), reachable at `https://openkakutou.github.io/mode-quick-versus/` — workflow written and its full pipeline (test/lint/build/visual) verified locally against the exact pinned CI image, but not yet exercised by a real push/deploy
- [ ] A native Go/`go-gl`/SDL2 program builds and runs the full game (selection through result) on Windows, on Mac, and on Linux, each importing `character`/`stage`/`sff`/`engine` as native Go packages
- [ ] The same program (or a resolved variant) runs on Android — blocked on roadmap backlog `010` (desktop OpenGL vs. OpenGL ES gap), not assumed solved by adopting SDL2 alone
- [ ] Each platform's build/release process is documented (e.g. in README usage) so a fresh checkout can reproduce every deployable artifact
- [ ] `openkakutou.github.io`'s Quick Versus card gets its pending platform pills flipped to live links as each artifact becomes available

## Notes
Packaging strategy history: Tauri (`.vibe/decisions/020`) → Wails (`.vibe/decisions/021`, once the core stayed Go per backlog `008`'s Rust-vs-Go spike) → **dropped webview entirely** (`.vibe/decisions/022`, 2026-08-16), once the Product Owner prioritized raw rendering control over a shared frontend and Ikemen GO's own `go-gl`+SDL2 stack was confirmed faster than Ebiten by a dedicated spike (`benchmarks/render-lang-spike/`). This item's scope changed accordingly: native is no longer "wrap the web build," it's a second, independent UI implementation.

## Blocked
2026-09-25: Web packaging shipped this cycle — the WASM bridges no longer throw on a missing/mismatched asset (verified live in a real browser), and `deploy-pages.yml` is written and its full pipeline verified against the exact pinned CI image. The native Windows/Mac/Linux/Android target is entirely unattempted: this execution environment has no SDL2 development headers or `pkg-config`, no `sudo` to install them, no display server at all, and no Windows/Mac cross-compilation toolchain (with no way to run a cross-compiled binary from Linux regardless) — confirmed by a consulted Linux/systems expert as not something a hand-rolled workaround (extracting package files without a real toolchain) could legitimately substitute for. Android is additionally blocked on roadmap backlog `010` regardless of environment. See `.vibe/decisions/011-release-packaging-web-only-this-cycle.md`. Re-running `/vibe:feature 008` from an environment with a working `go-gl`+SDL2 toolchain and a display picks this back up.
