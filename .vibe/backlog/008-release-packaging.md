---
status: todo
depends_on: [007]
---
# Release Packaging

## Description
Package the finished game as a static, deployable build with no backend — the standard Vite production build (`npm run build`), producing a `dist/` output that includes or correctly references the required WASM assets (`character.wasm`, `stage.wasm`, `sff.wasm`, `engine.wasm`) so the game runs entirely client-side once deployed to any static host.

## Acceptance Criteria
- [ ] `npm run build` produces a `dist/` bundle that runs the full game (selection through result) when served as static files, with no server-side component
- [ ] The build correctly includes/references all four required WASM assets at their expected runtime paths
- [ ] A missing or mismatched-version WASM asset at runtime shows a clear error state instead of a blank page or silent failure
- [ ] The release process is documented (e.g. in README usage) so a fresh checkout can reproduce a deployable build

## Notes
None.
