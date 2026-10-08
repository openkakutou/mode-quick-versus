---
status: todo
depends_on: [008]
---
# Native game: audio playback (SDL2_mixer)

## Description
Native half of former item 013: stage `Music` loops during a match and `engine` `PlaySnd` events play the matching decoded character sample, via SDL2_mixer. See decision 013 and the web implementation for reference.

## Acceptance Criteria
- [ ] Stage Music plays on loop during a native match
- [ ] Every PlaySnd event plays the matching sample without delaying the simulation/render loop
- [ ] Missing/undecodable audio degrades to silence; window focus loss does not desync or pile up triggers
- [ ] Headless check with `SDL_AUDIODRIVER=dummy` in Docker
