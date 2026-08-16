---
status: in_progress
---
# Character Roster Discovery/Selection Screen

## Description
The first screen a player sees: discover which characters are available (their `.def`/`.air`/`.sff`/`.cns` sets, loaded via the `character` WASM build) and let each of the two players pick one, independently, before moving on to stage selection and match setup. Since this app has no backend, "discovery" means working from whatever character sources the static build is configured with (e.g. a bundled roster manifest or user-supplied files), not a server-side catalog.

## Acceptance Criteria
- [ ] The roster of available characters is discovered and displayed with enough identifying info (name, preview) for each player to choose
- [ ] Each of the two players can independently select a character before proceeding
- [ ] A player cannot proceed to the next screen without having selected a character
- [ ] A character that fails to load (corrupt or incomplete file set) shows a clear error state in the roster instead of crashing the screen or silently omitting the entry
- [ ] Both players can select the same character (mirror match) without error

## Notes
None.
