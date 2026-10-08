---
status: todo
depends_on: [008]
---
# Native game: stage background layers

## Description
The native match renders fighters and HUD but not the stage's background layers (web build does, item 005).

## Acceptance Criteria
- [ ] Stage background layers (incl. parallax/scroll) render in the native match, matching the web build
- [ ] Verified by Xvfb screenshots in Docker, not blank and matching the web reference
