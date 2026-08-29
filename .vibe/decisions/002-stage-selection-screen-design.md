---
date: 2026-08-29
status: accepted
---
# Stage selection screen: single-select radio-group grid, own WASM bridge + download target

**Context:** Backlog item 002 needs to discover which stages are available (via the `stage` WASM build) and let the two local players pick ONE shared stage to fight on — unlike character selection (item 001), where each player picks independently.

**Decision:**
1. Reuses item 001's overall shape (runtime-fetched JSON manifest with static portrait paths, a typed WASM bridge, per-entry error cards, a distinct empty state) but with a single-select grid instead of item 001's two-button-per-card (Player 1 / Player 2) pattern: each stage card carries one "Select this stage" control. The grid carries `role="radiogroup"`, each selectable control `role="radio"` + `aria-checked`, so assistive tech announces mutual exclusivity instead of the independent-toggle semantics item 001's two buttons have. Consulted `vibe:expert-ui-ux` on this point specifically.
2. Selecting a stage never deselects back to "none" by re-clicking the same card — there is no valid empty-selection state to toggle into once one stage is picked (unlike a per-player slot, which can legitimately be empty pre-pick). Continue is disabled (not hidden) until exactly one stage is selected.
3. Same scope boundary as item 001's decision (point 4): no custom arrow-key/roving-tabindex grid navigation. Native Tab/Enter/Space on focusable elements is sufficient for the acceptance criteria; full radiogroup keyboard semantics (arrow-key roaming, skipping error cards) is out of scope here for the same reason it was out of scope for the character grid.
4. `stage` is a second, independent WASM module (its own `stage.wasm` + a matching `wasm_exec.js`), loaded through its own bridge file rather than generalizing item 001's character bridge into a shared loader — matches the org-wide convention of one bridge file per WASM dependency (see `stage-viewer-web`'s own `wasm/bridge.ts` + `wasm/sff-bridge.ts` as two separate files for the same reason). The download tooling (`scripts/download-wasm.mjs`) gains a `stage` target downloading `stage.wasm` and its own `wasm_exec.js` renamed to `stage-wasm_exec.js` on disk, so it can never silently overwrite character's own `wasm_exec.js` — the two modules may not always ship from the exact same Go toolchain version.

**Reason:** Keeps the screen's behavior correctly scoped to a single shared choice (not two independent ones) without inventing UI patterns beyond what item 001 already established and beyond what the acceptance criteria ask for.

**Rejected alternatives:**
- Reusing item 001's two-button-per-card pattern with both buttons wired to the same shared selection — rejected: reads as "pick for player 1 AND player 2 separately" to a returning player, and doesn't communicate mutual exclusivity to assistive tech the way a radio group does.
- A plain toggle button per card (`aria-pressed`) instead of `role="radio"`/`aria-checked` — rejected per the UX consult: a screen reader announces each card's pressed/unpressed state independently, never communicating that picking one clears the others.
- Full custom arrow-key roving-tabindex radiogroup navigation — rejected per point 3, matching item 001's own scope boundary; not required by the acceptance criteria.
- A single shared `wasm/bridge.ts` generalized to load either WASM module by parameter — rejected per point 4: duplicates the org's own established one-file-per-bridge convention and would couple two independently-released, independently-versioned modules' loading logic together for no behavioral gain.
- Downloading `stage`'s `wasm_exec.js` over the existing `public/wasm/wasm_exec.js` (character's own copy) — rejected per point 4: silently risks pairing a WASM binary with a `wasm_exec.js` built by a different Go toolchain version if the two repos ever drift.
