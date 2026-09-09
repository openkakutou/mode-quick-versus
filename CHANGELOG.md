# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-09-09

### Added

- Localization (i18n): the character/roster selection, stage selection, and match setup screens are now available in English and French, with a language switcher in the toolbar that changes the displayed language instantly, without a page reload. The chosen language is detected from the browser by default and remembered the next time the app loads. Switching language never loses an in-progress pick (character, stage, round count, time limit). The in-match HUD and the not-yet-built round/match result screen are not covered by this change.

## [0.6.1] - 2026-09-08

### Fixed

- Fixed the production build failing at its type-checking step because of a test file's overly loose callback typing, unrelated to any actual app behavior.

## [0.6.0] - 2026-09-07

### Added

- Player input: both players' actions during a match are now read live and actually drive it. Each player has their own default keyboard controls (Player 1: WASD + F/G/H/R/T/Y, Player 2: arrow keys + J/K/L/I/O/P), shown on the match setup screen's new Controls section. A connected gamepad is detected and used automatically for whichever player it's assigned to, without requiring one to be present; if it disconnects mid-match, that player falls back to their keyboard controls, shown live via an in-match status line. Each character's own command file is now read and used, so recognized moves actually resolve during a match.

## [0.5.0] - 2026-09-07

### Added

- Match rendering: once both players' characters, a stage, and the match setup are all confirmed, the match now actually starts and renders — both characters' live sprites (correct position and current animation frame, driven by the combat engine) composited over the chosen stage's background, kept in sync with the simulation as it runs. A sprite that can't be resolved shows a clear placeholder instead of a blank gap or a crash.

## [0.4.0] - 2026-08-29

### Added

- The match setup screen: after picking characters and a stage, players choose the round count (1, 3, or 5 rounds) and the per-round time limit (60s, 99s, or unlimited) before starting the match. Both choices are required before continuing, and switching one choice never resets the other.

## [0.3.0] - 2026-08-29

### Added

- The stage selection screen: after both players pick a character, stages configured in a deployable stage list are validated and displayed with their name and a preview; a stage that fails to load shows a clear error card instead of crashing or being silently dropped. Players pick one shared stage together and can't continue until a stage is chosen.

## [0.2.0] - 2026-08-16

### Added

- The character roster discovery/selection screen: characters configured in a deployable roster manifest are validated and displayed with their name and a portrait; a character that fails to load shows a clear error card instead of crashing or being silently dropped. Player 1 and Player 2 each pick a character independently, including picking the same character for a mirror match, and can't continue until both have picked.

[Unreleased]: https://github.com/openkakutou/mode-quick-versus/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/openkakutou/mode-quick-versus/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/openkakutou/mode-quick-versus/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/openkakutou/mode-quick-versus/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/openkakutou/mode-quick-versus/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/openkakutou/mode-quick-versus/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/openkakutou/mode-quick-versus/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/openkakutou/mode-quick-versus/releases/tag/v0.2.0
