---
status: done
depends_on: [008]
---
# Native game: audio playback (SDL2_mixer)

## Description
Native half of former item 013: stage `Music` loops during a match and `engine` `PlaySnd` events play the matching decoded character sample, via SDL2_mixer. See decision 013 and the web implementation for reference.

## Acceptance Criteria
- [x] Stage Music plays on loop during a native match
- [x] Every PlaySnd event plays the matching sample without delaying the simulation/render loop
- [x] Missing/undecodable audio degrades to silence; window focus loss does not desync or pile up triggers
- [x] Headless check with `SDL_AUDIODRIVER=dummy` in Docker

## Notes (done)
Shipped on Linux (verified in Docker with `SDL_AUDIODRIVER=dummy` and an Xvfb run). The Windows build ships `SDL2_mixer.dll`, and the macOS CI job installs `sdl2_mixer`; neither has been executed (backlog 015 and 016). See `.vibe/decisions/016`.
