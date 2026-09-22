---
status: blocked
---
# Match Audio Playback

## Description
A match currently runs and renders completely silent: no stage background music, no character hit/voice/taunt sounds. Wire up both, using each already-decoded/triggered source: `stage`'s `Music` path for background music, and `engine`'s triggered `PlaySnd` events plus `character`'s decoded sound samples for effects.

## Acceptance Criteria
- [ ] A stage's `Music` file (once loaded) plays on loop for the duration of a match, on both the web build (Web Audio API) and the native build (SDL2_mixer)
- [ ] Every `PlaySnd` event `engine` reports for a tick plays the matching decoded sample from that fighter's character, without measurably delaying or blocking the simulation/render loop
- [ ] Missing or undecodable audio (a stage with no `Music` path, a character with no matching sound sample for a triggered group/sample index) degrades to silence for that one sound, never a crash or a stalled match
- [ ] A background/foreground tab switch (web) or window focus loss (native) doesn't desync or pile up queued sound triggers on return

## Notes
Cross-repo: blocked on `stage#013` (Music path), `engine#020` (PlaySnd events), and `character#057` (decoded character sounds) — the last two depend transitively on the not-yet-created `snd` repo. See roadmap `.vibe/decisions/026`. No local `depends_on` entry — all three blockers are in other repos, none in this repo's own numbering; re-check all three sources before picking this up.
