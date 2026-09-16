import { createVisualProjectConfig } from "@openkakutou/web-ui-kit/testing/visual-preset";
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  ...createVisualProjectConfig({
    testDir: "./tests/visual",
    outputDir: "./test-results",
    use: { baseURL: "http://localhost:4173" },
    // Stricter than the shared default (`maxDiffPixelRatio: 0.02`):
    // confirmed for real (while proving this suite's own deliberate-
    // regression requirement) that a single pick button's color changing
    // — a small but real rendering regression — sits at ~1.7% of even a
    // single card's own screenshot, under the shared default and so not
    // caught by it. See `.vibe/decisions/008`.
    expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.005 } },
  }),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Self-contained: prepares the fixture WASM copy and rebuilds the
    // dedicated `vite.visual.config.ts` bundle before serving, so
    // `npm run test:visual` is runnable on its own (given `public/wasm/`
    // already downloaded via `npm run wasm:download` /
    // `wasm:download:stage`, the same precondition this repo's own real-WASM
    // smoke tests already have).
    command:
      "npm run prepare-visual-fixtures && vite build --config vite.visual.config.ts && vite preview --config vite.visual.config.ts --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
