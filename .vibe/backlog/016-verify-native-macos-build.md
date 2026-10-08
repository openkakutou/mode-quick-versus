---
status: blocked
---
# Verify the native macOS build on a real Mac

## Description
Split from item 008. The `macos` job in `.github/workflows/native.yml` only compiles, vets and tests; the game is never launched on macOS.

## Acceptance Criteria
- [ ] The CI-built macOS artifact runs the full game (selection through result) on a real Mac
- [ ] Any macOS-only defect is fixed
- [ ] macOS pill on `openkakutou.github.io` flipped to live once verified

## Blocked
Needs a real Mac (human).
