---
date: 2026-08-16
status: accepted
---
# Roster selection screen: runtime-fetched manifest, static portraits, per-card P1/P2 buttons

**Context:** Backlog item 001 needs to discover which characters are available (validated via the `character` WASM build) and let two local players independently pick one, including a mirror match (both picking the same character), with a clear per-entry error state for characters that fail to load.

**Decision:**
1. The roster source is a runtime-fetched JSON manifest (`public/roster-manifest.json`, listing each entry's `.def`/`.air`/`.sff`/`.cns` paths and a static portrait image path) rather than a manifest compiled into the JS bundle. This matches the backlog item's own framing ("whatever character sources the static build is *configured with*") — a deployer can swap the roster without a rebuild. The committed default ships as an empty array; a real deployment overwrites it at deploy time.
2. Each roster card's "preview" is the manifest's static portrait image, not a WASM-rendered sprite frame. Decoding and compositing an actual sprite (palette resolution, frame selection) is the concern `character-viewer-web`'s sprite browser already owns; re-deriving it here for a static preview image would duplicate that work for no behavioral gain at this stage.
3. Each roster card carries two independent, always-visible controls — "Select for Player 1" and "Select for Player 2" — instead of a single shared cursor with an active-player toggle. Clicking either button assigns/reassigns that player's pick; both can be active on the same card at once for a mirror match, each rendered as its own labeled corner badge (text + position, not color-only, since `web-ui-kit`'s token set has no dedicated "player 2" color to encode this with instead).
4. Full custom keyboard-arrow/gamepad navigation of the grid is out of scope for this item — the two buttons are native, focusable, keyboard-operable (Tab/Enter/Space) elements, which is sufficient for the acceptance criteria as written. Dedicated in-match keyboard/gamepad input routing is backlog item 006's explicit scope, not this screen's.

**Reason:** Keeps the screen's behavior fully determined by the fixed acceptance criteria (roster display, independent per-player selection incl. mirror match, non-interactive error cards, continue gated on both picks) without speculative scope (real-time sprite rendering, custom input arbitration) that belongs to other, already-identified backlog items.

**Rejected alternatives:**
- Compiling the roster into the JS bundle as a static TS array — rejected per point 1, contradicts "static build is configured with" and would require a rebuild to change the roster.
- Rendering each portrait from the WASM-decoded sprite pixels — rejected per point 2, duplicates `character-viewer-web`'s sprite-browser work for a preview thumbnail.
- A single shared selection cursor with an "active player" toggle — rejected per point 3: makes the mirror-match case (both players on one card) awkward to represent and adds a state machine (whose turn is it) the acceptance criteria don't ask for.
- Custom arrow-key/gamepad grid navigation for this screen — rejected per point 4 as premature: not required by this item's acceptance criteria, and in-match input routing is already scoped to a separate backlog item (006).
