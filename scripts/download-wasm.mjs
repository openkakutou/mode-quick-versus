#!/usr/bin/env node
// Downloads the character.wasm and wasm_exec.js release assets published by
// openkakutou/character for a pinned version tag, into public/wasm/. Same
// script design as character-viewer-web's scripts/download-wasm.mjs — see
// that repo's .vibe/decisions/001-wasm-download-script-design.md for the
// rationale (not re-derived here).

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXIT_CODES = Object.freeze({
  USAGE: 2,
  NOT_FOUND: 3,
  NETWORK: 5,
});

const DEFAULT_REPO = "openkakutou/character";
const DEFAULT_ASSETS = Object.freeze(["character.wasm", "wasm_exec.js"]);
const DEFAULT_OUT_DIR = "public/wasm";
const DEFAULT_TIMEOUT_MS = 20_000;

// Every WASM dependency this app can download release assets for. `stage`'s
// wasm_exec.js is written to disk under a different name than character's —
// the two modules are independently released and are not guaranteed to ship
// from the exact same Go toolchain version, so downloading a second one
// under the plain "wasm_exec.js" name would silently overwrite (and risk
// mismatching) the first the next time either target is downloaded.
const DEFAULT_TARGET = "character";
const TARGETS = Object.freeze({
  character: Object.freeze({
    repo: "openkakutou/character",
    assets: Object.freeze(["character.wasm", "wasm_exec.js"]),
  }),
  stage: Object.freeze({
    repo: "openkakutou/stage",
    assets: Object.freeze([
      "stage.wasm",
      Object.freeze({ name: "wasm_exec.js", localName: "stage-wasm_exec.js" }),
    ]),
  }),
  // `engine` has no published release with build assets attached yet (see
  // .vibe/decisions/004-match-rendering-architecture.md) -- this target is
  // wired up ready for when one exists, mirroring `stage`'s own shape.
  engine: Object.freeze({
    repo: "openkakutou/engine",
    assets: Object.freeze([
      "engine.wasm",
      Object.freeze({ name: "wasm_exec.js", localName: "engine-wasm_exec.js" }),
    ]),
  }),
});

export class DownloadError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.name = "DownloadError";
    this.exitCode = exitCode;
  }
}

/**
 * Downloads every asset of a `character` release tag into `outDir`.
 *
 * All assets either land together or none do: if any asset fails, every
 * asset already written during this same call is removed again, and each
 * asset is written atomically (temp file + rename) so a failure mid-write
 * never leaves a truncated file behind.
 */
export async function downloadWasmRelease({
  version,
  repo = DEFAULT_REPO,
  assets = DEFAULT_ASSETS,
  outDir = DEFAULT_OUT_DIR,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  log = console,
} = {}) {
  if (!version) {
    throw new DownloadError(
      "Missing version argument. Usage: download-wasm <version> (e.g. v0.1.0)",
      EXIT_CODES.USAGE,
    );
  }

  await mkdir(outDir, { recursive: true });

  const downloaded = [];

  for (const asset of assets) {
    // An asset is either a plain remote file name (local name matches), or
    // `{ name, localName }` when the file should land under a different
    // name on disk than the one published in the release.
    const remoteName = typeof asset === "string" ? asset : asset.name;
    const localName =
      typeof asset === "string" ? asset : (asset.localName ?? asset.name);

    const finalPath = path.join(outDir, localName);
    const tempPath = path.join(outDir, `.${localName}.tmp-${process.pid}`);

    try {
      const buffer = await fetchAsset({
        url: `https://github.com/${repo}/releases/download/${version}/${remoteName}`,
        asset: remoteName,
        version,
        repo,
        fetchImpl,
        timeoutMs,
      });
      await writeFile(tempPath, buffer);
      await rename(tempPath, finalPath);
      downloaded.push(finalPath);
      log.log(`✓ ${localName}`);
    } catch (error) {
      await rm(tempPath, { force: true });
      await Promise.all(
        downloaded.map((filePath) => rm(filePath, { force: true })),
      );
      throw error;
    }
  }

  log.log(`Downloaded ${version} to ${outDir}/`);
  return downloaded;
}

async function fetchAsset({ url, asset, version, repo, fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } catch (error) {
    throw new DownloadError(
      `Network error while downloading ${asset} for ${repo}@${version}: ${error.message} (${url})`,
      EXIT_CODES.NETWORK,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new DownloadError(
        `Could not find ${asset} for ${repo}@${version} (HTTP 404). The tag may not exist, or this release may not include this asset. Check https://github.com/${repo}/releases`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    throw new DownloadError(
      `Failed to download ${asset} for ${repo}@${version}: HTTP ${response.status} (${url})`,
      EXIT_CODES.NETWORK,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new DownloadError(
      `Downloaded ${asset} for ${repo}@${version} is empty (0 bytes) — treating this as a failed download (${url})`,
      EXIT_CODES.NETWORK,
    );
  }

  return Buffer.from(arrayBuffer);
}

function printUsage(stream) {
  stream.write(
    `${[
      "Usage: download-wasm [target] <version>",
      "",
      `Downloads a target's release assets into ${DEFAULT_OUT_DIR}/.`,
      `target defaults to "${DEFAULT_TARGET}" when omitted. Known targets: ${Object.keys(TARGETS).join(", ")}.`,
      "",
      "Examples:",
      "  npm run wasm:download -- v0.1.0",
      "  npm run wasm:download -- stage v0.10.0",
      "",
      "Options:",
      "  -h, --help     show this help",
      "  -v, --version  show this script's own version",
      "",
      "Exit codes:",
      "  0  success",
      `  ${EXIT_CODES.USAGE}  usage error (missing/invalid arguments)`,
      `  ${EXIT_CODES.NOT_FOUND}  release tag or asset not found`,
      `  ${EXIT_CODES.NETWORK}  network error or unexpected failure`,
    ].join("\n")}\n`,
  );
}

/**
 * CLI entry point. Returns the process exit code rather than calling
 * `process.exit` directly, so it stays callable from tests.
 */
export async function main(argv = process.argv.slice(2), overrides = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage(process.stdout);
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    const packageJsonUrl = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
    process.stdout.write(`${packageJson.version}\n`);
    return 0;
  }

  let target = DEFAULT_TARGET;
  let version;
  if (Object.hasOwn(TARGETS, argv[0])) {
    target = argv[0];
    [, version] = argv;
  } else if (argv.length <= 1) {
    [version] = argv;
  } else {
    process.stderr.write(
      `Unknown target "${argv[0]}". Known targets: ${Object.keys(TARGETS).join(", ")}.\n`,
    );
    printUsage(process.stderr);
    return EXIT_CODES.USAGE;
  }

  try {
    await downloadWasmRelease({
      version,
      repo: TARGETS[target].repo,
      assets: TARGETS[target].assets,
      ...overrides,
    });
    return 0;
  } catch (error) {
    if (error instanceof DownloadError) {
      process.stderr.write(`${error.message}\n`);
      if (error.exitCode === EXIT_CODES.USAGE) printUsage(process.stderr);
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
