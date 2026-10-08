---
status: blocked
---
# Verify the native Windows build on a real Windows machine

## Description
Split from item 008. The `.exe` cross-compiles in Docker (`native/`) but has never been executed: Go crashes at startup under Wine in the container, so only a real Windows host can validate it.

## Acceptance Criteria
- [ ] The CI-built Windows artifact runs the full game (selection through result) on real Windows
- [ ] Any Windows-only defect found is fixed and covered by a test where feasible
- [ ] Windows pill on `openkakutou.github.io` flipped to live once verified

## Blocked
Needs a real Windows machine (human). Download the artifact from the `Native` workflow run and report back.
