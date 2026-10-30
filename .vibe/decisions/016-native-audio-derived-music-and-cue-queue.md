---
date: 2026-10-30
status: accepted
---
# Native audio: music derived from game state, sound effects as a drained cue queue

**Context:** Backlog item 020 adds SDL2_mixer audio to the native game, while `native/internal/game` must stay free of cgo (decision 014).
**Decision:** `game` only describes what should be heard: `Flow.Music()` returns the stage music path while a match is shown (match or result screen), and `Match` queues the engine's `PlaySnd` events as cues drained once per frame. A new cgo package `internal/audio` turns that into SDL2_mixer calls, restarting the music when the match owner changes. PCM samples become chunks through an in-memory WAV header; 16 mixer channels cap simultaneous effects.
**Reason:** Music is state, effects are events; deriving music from `Flow` means no screen transition has to remember to start or stop it, and the rules (loop across rounds, keep on result, stop on back-to-select, restart on rematch) are unit-tested without cgo.
**Rejected alternatives:** A function-field audio port injected into `Flow` (every exit from a match must remember to stop the music, and it touches every `NewMatch` call site); a command outbox sum type (same coordination risk plus a new type); `Mix_QuickLoadRAW` (keeps a Go-owned pointer in C).
