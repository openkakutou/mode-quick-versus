import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

export default defineConfig({
  base: "./",
  test: {
    environment: "jsdom",
    // Without this, Vitest's own default include glob (`*.spec.ts`) also
    // picks up the Playwright visual spec files under `tests/visual/` and
    // fails them under jsdom, where the `@playwright/test` `page` fixture
    // doesn't exist — same gap `web-ui-kit`'s own `vite.config.ts` documents.
    exclude: [...configDefaults.exclude, "tests/visual/**"],
  },
});
