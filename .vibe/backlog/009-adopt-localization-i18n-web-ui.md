---
status: todo
---
# Adopt Localization (i18n) — Web UI

## Description
Extract this app's non-match screens (roster/character selection, stage selection, match setup, round/match result) hardcoded English UI strings into namespaced message catalogs (`src/i18n/en.json`, `src/i18n/fr.json`) and wire up `web-ui-kit`'s shared i18next integration layer, adding a `<wuik-locale-switcher>` to those screens so the user can switch language. Scoped to the `web-ui-kit`-based non-match UI only — the in-match HUD and rendering are custom real-time game UI, not design-system panels/forms, and are out of scope here. The native (Go/SDL2) desktop build is a separate stack and tracked by its own scoping item, `010-scope-native-desktop-localization-approach`. See roadmap decision `023-localization-approach-for-web-ui.md` for the shared approach.

## Acceptance Criteria
- [ ] All user-facing UI strings on the roster/character selection, stage selection, match setup, and round/match result screens are moved out of source code into `src/i18n/en.json` and `src/i18n/fr.json`
- [ ] The app initializes `web-ui-kit`'s shared i18next configuration under its own namespace
- [ ] A `<wuik-locale-switcher>` is present on these non-match screens and switches the displayed language live, without a page reload
- [ ] The selected locale persists across page reloads
- [ ] The in-match HUD is explicitly left untranslated by this item — no strings are extracted from it here

## Notes
Depends on `web-ui-kit` backlog item `011-i18n-core-primitive-and-locale-switcher` landing first.
