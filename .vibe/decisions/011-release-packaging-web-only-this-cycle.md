---
date: 2026-09-25
status: accepted
---
# Release packaging: ship the web target now, defer native entirely

**Context:** Backlog item 008 asks for two independent release targets: a
web build deployed to GitHub Pages, and a native Windows/Mac/Linux/Android
`go-gl`+SDL2 program. Android was already known to be blocked on roadmap
backlog `010` (desktop OpenGL vs. OpenGL ES). While implementing this item,
the execution environment itself turned out unable to support any part of
the native target, not just Android: no SDL2 development headers or
`pkg-config` installed (both required by `go-gl`'s and `go-sdl2`'s `cgo`
build), no `sudo` to install them properly, no display server of any kind
(`$DISPLAY`/`$WAYLAND_DISPLAY` both empty, no `Xvfb`), and no Windows/Mac
cross-compilation toolchain — with no way to actually run a Windows or Mac
binary from this Linux sandbox regardless of whether it could be
cross-compiled. A consulted Linux/systems expert confirmed a hand-rolled
workaround (extracting `.deb` package contents without installing them)
would only prove `cgo` syntax compiles, not that packaging works, due to
real ABI-mismatch and missing-transitive-dependency risks.

The item's own AC list also names `sff.wasm` as one of "four required WASM
assets," but the app's real architecture only ever loads three WASM
modules client-side (`character.wasm`, `stage.wasm`, `engine.wasm`) — `.sff`
sprite-sheet bytes are plain data forwarded to the `character`/`stage`
bridges' own calls, never a separate WASM module of their own (confirmed by
`.vibe/index.md`'s module list and `public/wasm/`'s actual contents).

**Decision:** Implement and ship only the web release target this cycle:
fix the WASM bridges' unhandled-rejection gap (a missing/mismatched
`character`/`stage`/`engine` WASM asset now returns a typed error instead
of throwing, so every screen that depends on it shows a clear message
instead of a blank page), add a `deploy-pages.yml` workflow that runs the
full test suite, lint, and build before publishing, and document the web
build/release process. The native target (all four platforms, not only
Android) is left entirely unattempted and the backlog item stays open
(`status: blocked`) rather than closed, with a `## Blocked` section naming
the precise gap. Treat "four WASM assets" as "three" going forward for this
app; no `sff.wasm` bridge exists or is planned here.

**Reason:** The Product Owner's own stated policy for this exact situation
(no display server, missing cross-compilation toolchain) is to mark the
item blocked rather than force a fake pass through a jury-rigged toolchain.
Shipping the fully-verifiable, fully-tested web half of the item now is
strictly better than leaving all of it undone waiting on an environment
that can build the native half.

**Rejected alternatives:**
- *Hand-extract `libsdl2-dev`/`pkg-config`/`Xvfb` from downloaded `.deb`
  files without `sudo`* — technically possible (`apt-get download` works
  without root) but produces an unverifiable, ABI-risky, non-reproducible
  build environment nothing else (CI, a real release) would ever match;
  the Linux expert consulted for this item advised against treating a pass
  under that setup as real evidence of a working native build.
- *Split item 008 into a "web" item and a "native" item now* — the
  autonomous workflow's own oversized-scope gate reserves a split for a
  genuine Product Owner decision; implemented as one item instead, with the
  incomplete half flagged in the report as this ADR does.
- *Write the native Go program's code anyway, unverified* — rejected: this
  project's whole workflow is TDD-first with mandatory runtime
  verification before a task can be marked complete; code that can neither
  compile nor run in any available environment cannot pass through that
  loop honestly.
