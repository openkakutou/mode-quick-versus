# mode-quick-versus

The first complete, standalone, playable [OpenKakutou](https://github.com/openkakutou) game: a standard two-player, one-character-each versus match. It consumes the WebAssembly builds of the `character`, `stage`, `sff`, and `engine` libraries, plus its own lifebar-rendering logic (mirroring `lifebar-viewer-web`'s in-app parsing approach), and owns its own character-selection, match, and result flow. Not a component meant to be embedded — a finished game on its own.

<!-- vibe:begin:features -->
This project is in early-stage development. Available now:

- Character roster discovery and selection: each player picks their character independently from the available roster, including picking the same character as their opponent. A character that fails to load is shown with a clear error instead of breaking the screen.
- Stage selection: once both players have picked a character, they choose one shared stage to fight on from the available stage list. A stage that fails to load is shown with a clear error instead of breaking the screen.
- Match setup: once a stage is chosen, players pick the round count (1, 3, or 5) and the per-round time limit (60s, 99s, or unlimited) before the match starts. Both choices are required to continue, and changing one never resets the other.
- Match rendering: once setup is confirmed, the match actually starts — both characters appear at their live position, playing their current animation, composited over the chosen stage's background, kept in sync as the match runs. A character or stage sprite that can't be shown falls back to a clear placeholder rather than a gap or a crash.
- Player input: each player has their own default keyboard controls (shown on the match setup screen), and a connected gamepad is used automatically for whichever player it's assigned to — no setup required. If a gamepad disconnects mid-match, that player falls back to their keyboard controls instead of freezing.
- Localization: the character selection, stage selection, and match setup screens are available in English and French, with a language switcher that changes the displayed language instantly. The chosen language is remembered the next time the app loads.
- In-match HUD: both players' lifebar and power/meter bar update live throughout the match, alongside the current round number, each player's round wins, and the configured best-of. If the match's underlying data ever becomes unreadable, the HUD shows a clear message instead of freezing or crashing the match.
- Round and match results: when a round ends, a clear result appears showing the round winner (or a draw) and automatically continues to the next round after a short countdown — no click needed. When the match itself ends, a result screen shows the overall winner (or a draw) with two choices: instantly rematch with the same characters, stage, and settings, or return to character selection.
- Single-player mode: a "Player 2 Control" choice on the match setup screen lets one player face a computer-controlled opponent instead of a second human — a minimal first pass, not a full AI, that moves toward its opponent and attacks on its own.

Planned:

- Release packaging as a static, deployable build
<!-- vibe:end:features -->

<!-- vibe:begin:install -->
Requires [Node.js](https://nodejs.org/) `^20.19.0` or `>=22.12.0`.

```sh
npm install
```

Verify the install worked by running the test suite:

```sh
npm test
```

To update dependencies to their latest allowed versions:

```sh
npm update
```

Download a specific version of the `character` library's WebAssembly build (needed to load a character):

```sh
npm run wasm:download -- v0.7.1
```

Download a specific version of the `stage` library's WebAssembly build (needed to load a stage):

```sh
npm run wasm:download:stage -- v0.11.1
```

Download a specific version of the `engine` library's WebAssembly build (needed to run a match):

```sh
npm run wasm:download:engine -- v2.4.0
```
<!-- vibe:end:install -->

<!-- vibe:begin:usage -->
Start a local dev server with hot reload:

```sh
npm run dev
```

Build the static site for production (output in `dist/`):

```sh
npm run build
```

Preview a production build locally:

```sh
npm run preview
```

Run the test suite:

```sh
npm test
```

Run the linter/formatter (auto-fixes issues in place):

```sh
npm run lint
```

Run the visual regression suite (requires the `character`/`stage` WASM builds already downloaded — see Installation above):

```sh
npm run test:visual
```
<!-- vibe:end:usage -->

<!-- vibe:begin:docs-index -->
- [docs/architecture.md](docs/architecture.md) — how the app is put together: modules, data flow, and the roster/stage manifests.
- [docs/testing.md](docs/testing.md) — what the test suite covers and how to run it.
<!-- vibe:end:docs-index -->
