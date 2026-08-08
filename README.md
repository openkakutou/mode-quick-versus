# mode-quick-versus

The first complete, standalone, playable [OpenKakutou](https://github.com/openkakutou) game: a standard two-player, one-character-each versus match. It consumes the WebAssembly builds of the `character`, `stage`, `sff`, and `engine` libraries, plus its own lifebar-rendering logic (mirroring `lifebar-viewer-web`'s in-app parsing approach), and owns its own character-selection, match, and result flow. Not a component meant to be embedded — a finished game on its own.

<!-- vibe:begin:features -->
This project is in early-stage development — only the project scaffold exists so far, no functionality yet.

Planned:

- Character roster discovery and selection screen (one character per player)
- Stage selection screen
- Match setup (round count, time limit)
- In-match HUD: lifebar, power bar, and round display driven by live `engine` match state
- Match rendering: character sprites and stage composition driven by `engine`'s live state
- Keyboard and gamepad input handling routed into `engine`
- Round/match result screen with rematch and back-to-select
- A minimal first-pass CPU opponent for single-player
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
<!-- vibe:end:usage -->

<!-- vibe:begin:docs-index -->
No additional documentation yet.
<!-- vibe:end:docs-index -->
