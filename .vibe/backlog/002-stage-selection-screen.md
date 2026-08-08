---
status: todo
---
# Stage Selection Screen

## Description
A screen, independent of character selection, that discovers which stages are available (via the `stage` WASM build) and lets the players pick one to fight on. Like character discovery, "available" means whatever stage sources the static build is configured with, since there is no backend catalog.

## Acceptance Criteria
- [ ] The list of available stages is discovered and displayed with enough identifying info (name, preview) to choose from
- [ ] A stage can be selected and the choice is carried forward into match setup
- [ ] Players cannot proceed to match setup without a stage selected
- [ ] A stage that fails to load (corrupt or incomplete `.def`) shows a clear error state instead of crashing the screen or silently omitting the entry

## Notes
None.
