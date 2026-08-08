---
status: todo
depends_on: [001, 002]
---
# Match Setup

## Description
After both characters and the stage are chosen, a setup screen lets the players configure the match's round count (e.g. best of 1/3/5) and per-round time limit before the match actually starts. This is the last screen before handing off to the in-match HUD, rendering, and input systems.

## Acceptance Criteria
- [ ] Round count can be configured from a sensible set of options (e.g. 1, 3, 5 rounds)
- [ ] Time limit can be configured, including an "unlimited/no timer" option
- [ ] Configured values are validated (e.g. round count must be a positive odd number) with a clear error state on invalid input, not a silently-clamped or ignored value
- [ ] Starting the match carries forward the selected characters, stage, and configured rounds/timer into the match flow

## Notes
None.
