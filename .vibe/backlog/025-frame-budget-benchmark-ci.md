---
status: todo
---
# Frame-budget benchmark gate in CI

## Description
CLAUDE.md mandates 16.6 ms per frame, yet nothing fails when a change regresses it. Turn the existing benchmarks into a CI check with a threshold for native and web builds.

## Acceptance Criteria
- [ ] A benchmark run on every PR reports ms per frame
- [ ] CI fails when the budget is exceeded by a defined margin
- [ ] Baselines documented
