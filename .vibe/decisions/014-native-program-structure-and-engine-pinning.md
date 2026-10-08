---
date: 2026-10-08
status: accepted
---
# Native program: Docker toolchain, cgo-free game package, engine pinned by commit

**Context:** Backlog 008's native target was unattempted for lack of SDL2 headers, a display and cross compilers. Docker on the host removes that blocker. `engine` is tagged `v2.x` but its module path has no `/v2`, so `go get engine@v2.5.1` is rejected.
**Decision:** (1) All native build/test/run happens in `native/Dockerfile` (SDL2, Xvfb, mingw-w64) driven by `native/scripts/*.sh`. (2) `native/internal/game` (roster, match assembly, engine session, screen flow) has no cgo and is unit-tested; `native/internal/gfx` (go-gl + SDL2) only draws it. (3) `native/go.mod` pins `engine` by the pseudo-version of the v2.5.1 commit. (4) macOS is covered only by an unverified GitHub Actions job. (5) This pass ships a minimal but complete flow; audio, CPU opponent, gamepad and stage layer rendering are left out.
**Reason:** Container keeps a fresh checkout reproducible; a cgo-free core keeps logic testable without a display; pseudo-version is the only way to resolve the engine until it fixes its module path.
**Rejected alternatives:** Wine to run the Windows build (Go runtime crashes under it in the container); a `replace` to a sibling checkout (breaks fresh checkouts); wrapping the web build (rejected by decision 022).
