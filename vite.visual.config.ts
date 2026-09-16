// Dedicated Vite config for the visual-regression suite (backlog item 011).
// Reuses the exact same `index.html`/`src/main.ts` entry point as the real
// app — no test-only branching in app source — but points `publicDir` at
// `tests/visual/fixtures/` (committed fixture roster/stage manifests,
// character/stage files, and a `wasm/` copy prepared by
// `scripts/prepare-visual-fixtures.mjs`) instead of the real `public/`,
// since the app's roster/stage screens are driven by a deploy-time JSON
// manifest fetched at a fixed relative URL, and the real, committed
// manifests are intentionally empty (deploy-specific data). See
// `.vibe/decisions/008-visual-regression-fixture-serving-strategy.md`.
//
// `mergeConfig` extends the real `vite.config.ts` rather than duplicating
// it, so a future change there (base path, plugins) is picked up here
// automatically instead of silently drifting out of sync.
import { mergeConfig } from "vite";
import baseConfig from "./vite.config.ts";

export default mergeConfig(baseConfig, {
  publicDir: "tests/visual/fixtures",
  build: {
    outDir: "dist-visual",
  },
});
