---
status: todo
---
# Render projectiles and hit reactions

## Description
Once engine reports projectiles, hit pause and guard states, draw them in both builds: projectile sprites and animations, hit sparks, guard feedback, and screen shake.

## Acceptance Criteria
- [ ] Projectiles are drawn from the engine's response with correct facing
- [ ] Hit pause visibly freezes both fighters
- [ ] Missing projectile sprites fall back to a clear placeholder, not a crash

## Notes
Cross-repo: waits for engine#022 and #024.
