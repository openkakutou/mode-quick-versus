---
status: blocked
---
# Match Audio Playback

## Description
A match currently runs and renders completely silent: no stage background music, no character hit/voice/taunt sounds. Wire up both, using each already-decoded/triggered source: `stage`'s `Music` path for background music, and `engine`'s triggered `PlaySnd` events plus `character`'s decoded sound samples for effects.

## Acceptance Criteria
- [ ] A stage's `Music` file (once loaded) plays on loop for the duration of a match, on both the web build (Web Audio API — done) and the native build (SDL2_mixer — not attempted, see Blocked)
- [x] Every `PlaySnd` event `engine` reports for a tick plays the matching decoded sample from that fighter's character, without measurably delaying or blocking the simulation/render loop (web build)
- [x] Missing or undecodable audio (a stage with no `Music` path, a character with no matching sound sample for a triggered group/sample index) degrades to silence for that one sound, never a crash or a stalled match (web build)
- [ ] A background/foreground tab switch (web) or window focus loss (native) doesn't desync or pile up queued sound triggers on return — done for web (verified for real in a browser); native not attempted

## Notes
Cross-repo: was blocked on `stage#013` (Music path), `engine#020` (PlaySnd events), and `character#057` (decoded character sounds). Unblocked as of 2026-09-26: `stage#013` published as `stage` v0.13.0, `character#057` published as `character` v0.9.0, `engine#020` published as `engine` v2.5.0. See roadmap `.vibe/decisions/026`. No local `depends_on` entry — all three blockers were in other repos, none in this repo's own numbering.

## Blocked
2026-09-27: Web audio playback shipped this cycle and verified for real in a browser — a stage's background music decodes and loops via the Web Audio API, and every `PlaySnd` event `engine` reports each tick plays the matching decoded sample immediately, with a fixed concurrent-voice cap and a per-sound `AudioBuffer` cache so a burst of triggers can't grow the audio graph unbounded or measurably cost the tick loop. Missing/undecodable audio (no stage music, no matching character sample) degrades to silence, confirmed both by unit tests and by a real multi-second browser run with a `.cns` firing `PlaySnd` every tick against a real decoded `.snd` fixture and a deliberately undecodable stage music file — zero crashes, zero console errors. A simulated tab-visibility change mid-match produced no desync or pile-up either.

The native (Windows/Mac/Linux/Android, SDL2_mixer) half is entirely unattempted: this repo has no native application at all yet (only the `go-gl`/SDL2 benchmark spike under `benchmarks/render-lang-spike/`), and this execution environment still lacks the native toolchain entirely — no `pkg-config`, no SDL2 development headers, no display server — the same gap `.vibe/decisions/011`/backlog item 008 already documented and deferred. See `.vibe/decisions/013-match-audio-web-only-no-mute-control-this-cycle.md`. Re-running `/vibe:feature 013` once a native `mode-quick-versus` application exists and this (or another) environment has a working `go-gl`+SDL2 toolchain and a display picks this back up.
