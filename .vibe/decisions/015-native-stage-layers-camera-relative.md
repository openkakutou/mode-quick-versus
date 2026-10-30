---
date: 2026-10-30
status: accepted
---
# Native stage layers: camera-relative parallax, web placement rules otherwise

**Context:** Backlog 019 adds the stage's background layers to the native match. The web build keeps a fixed camera (decision 004), so its parallax deltas have no visible effect; the native renderer already scrolls fighters against the midpoint of both fighters.
**Decision:** Native layers follow web rules (split behind/front at `layerNo` 1, stable on file order, top-left placement with the sprite axis ignored, a 32 px placeholder tile for an unloadable sprite, nothing for a blank or missing animation, no tiling or blend modes). Their position is `stage.ResolveParallaxPosition` against the negated native camera, so delta 1 shifts like a fighter and delta 0 stays fixed. A stage with no elements keeps the flat sky/floor backdrop.
**Reason:** Reusing the stage library's own parallax function keeps one formula; scrolling against the existing camera keeps layers and fighters coherent. With the camera at the origin the picture is identical to the web build.
**Rejected alternatives:** Fixed camera for layers (fighters would slide over a static backdrop); drawing the flat backdrop under layers always (hides transparency and differs from web).
