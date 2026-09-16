#!/usr/bin/env node
// Copies the already-downloaded `character`/`stage` WASM release assets
// (`public/wasm/`, gitignored, fetched via `npm run wasm:download` /
// `wasm:download:stage`) into `tests/visual/fixtures/wasm/` — the visual
// test suite's own dedicated Vite config (`vite.visual.config.ts`) points
// its `publicDir` at `tests/visual/fixtures/` instead of the app's real
// `public/`, since Vite only supports one `publicDir` per config, and the
// committed fixture manifests there must never point at the real,
// deploy-specific (currently empty) roster/stage manifests. See
// `.vibe/decisions/008-visual-regression-fixture-serving-strategy.md`.
//
// Deliberately fails fast with a named, actionable error (not a silent
// skip or a stale copy left in place) when a source asset is missing —
// this app has no `engine` WASM asset published at all yet, so the same
// silent-passthrough mistake there must not be repeated here.

import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXIT_CODES = Object.freeze({
  MISSING_SOURCE: 3,
});

const DEFAULT_SOURCE_DIR = "public/wasm";
const DEFAULT_TARGET_DIR = "tests/visual/fixtures/wasm";
const DEFAULT_FILES = Object.freeze([
  "wasm_exec.js",
  "character.wasm",
  "stage-wasm_exec.js",
  "stage.wasm",
]);

export class PrepareVisualFixturesError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.name = "PrepareVisualFixturesError";
    this.exitCode = exitCode;
  }
}

/**
 * Copies every file in `files` from `sourceDir` to `targetDir`, clearing
 * `targetDir` first so a stale file from a previously-downloaded WASM
 * version can never linger and be served instead of the current one. Every
 * source file is checked to exist before any copy starts — a missing asset
 * fails the whole call with no partial copy left behind, naming exactly
 * which file is missing and how to fetch it.
 */
export async function prepareVisualFixtures({
  sourceDir = DEFAULT_SOURCE_DIR,
  targetDir = DEFAULT_TARGET_DIR,
  files = DEFAULT_FILES,
  log = console,
} = {}) {
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    try {
      await stat(sourcePath);
    } catch {
      throw new PrepareVisualFixturesError(
        `Missing ${sourcePath} — run "npm run wasm:download" and "npm run wasm:download:stage" first.`,
        EXIT_CODES.MISSING_SOURCE,
      );
    }
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const copied = [];
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    await copyFile(sourcePath, targetPath);
    copied.push(targetPath);
    log.log(`✓ ${file}`);
  }

  log.log(`Copied ${copied.length} file(s) to ${targetDir}/`);
  return copied;
}

/**
 * CLI entry point. Returns the process exit code rather than calling
 * `process.exit` directly, so it stays callable from tests — same shape as
 * `scripts/download-wasm.mjs`'s own `main`.
 */
export async function main(overrides = {}) {
  try {
    await prepareVisualFixtures(overrides);
    return 0;
  } catch (error) {
    if (error instanceof PrepareVisualFixturesError) {
      process.stderr.write(`${error.message}\n`);
      return error.exitCode;
    }
    process.stderr.write(`Unexpected error: ${error.message}\n`);
    return 1;
  }
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
