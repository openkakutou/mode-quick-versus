---
status: done
---
# Adopt Localization (i18n) — Web UI

## Description
Extract this app's non-match screens (roster/character selection, stage selection, match setup, round/match result) hardcoded English UI strings into namespaced message catalogs (`src/i18n/en.json`, `src/i18n/fr.json`) and wire up `web-ui-kit`'s shared i18next integration layer, adding a `<wuik-locale-switcher>` to those screens so the user can switch language. Scoped to the `web-ui-kit`-based non-match UI only — the in-match HUD and rendering are custom real-time game UI, not design-system panels/forms, and are out of scope here. The native (Go/SDL2) desktop build is a separate stack and tracked by its own scoping item, `010-scope-native-desktop-localization-approach`. See roadmap decision `023-localization-approach-for-web-ui.md` for the shared approach.

## Acceptance Criteria
- [x] All user-facing UI strings on the roster/character selection, stage selection, and match setup screens are moved out of source code into `src/i18n/en.json` and `src/i18n/fr.json` — the round/match result screen does not exist in this codebase yet (backlog item `007`, still `todo`); its strings will move into the catalogs when that item builds the screen (see `.vibe/decisions/006-i18n-integration-approach.md`)
- [x] The app initializes `web-ui-kit`'s shared i18next configuration under its own namespace
- [x] A `<wuik-locale-switcher>` is present on these non-match screens and switches the displayed language live, without a page reload
- [x] The selected locale persists across page reloads
- [x] The in-match HUD is explicitly left untranslated by this item — no strings are extracted from it here

## Notes
Depended on `web-ui-kit` backlog item `011-i18n-core-primitive-and-locale-switcher`, which had already landed. Implemented in `feat: localize the roster/stage/setup screens and add a live language switcher` (commit `7007406`). Also bumped `@openkakutou/web-ui-kit` from `^0.5.0` to `^0.13.0` since the installed `0.5.0` predates the i18n layer.
