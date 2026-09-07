# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/openkakutou/mode-quick-versus/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/openkakutou/mode-quick-versus/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/openkakutou/mode-quick-versus/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/openkakutou/mode-quick-versus/releases/tag/v0.2.0
