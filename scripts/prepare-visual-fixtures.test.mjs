import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EXIT_CODES,
  PrepareVisualFixturesError,
  main,
  prepareVisualFixtures,
} from "./prepare-visual-fixtures.mjs";

let sourceDir;
let targetDir;

beforeEach(async () => {
  const root = await mkdtemp(path.join(tmpdir(), "prepare-visual-fixtures-"));
  sourceDir = path.join(root, "source");
  targetDir = path.join(root, "target");
  await mkdir(sourceDir, { recursive: true });
});

afterEach(async () => {
  await rm(path.dirname(sourceDir), { recursive: true, force: true });
});

describe("prepareVisualFixtures", () => {
  it("copies every listed file from sourceDir to targetDir", async () => {
    await writeFile(path.join(sourceDir, "a.wasm"), "wasm-bytes");
    await writeFile(path.join(sourceDir, "b.js"), "js-source");

    const result = await prepareVisualFixtures({
      sourceDir,
      targetDir,
      files: ["a.wasm", "b.js"],
      log: { log() {} },
    });

    expect(await readFile(path.join(targetDir, "a.wasm"), "utf8")).toBe(
      "wasm-bytes",
    );
    expect(await readFile(path.join(targetDir, "b.js"), "utf8")).toBe(
      "js-source",
    );
    expect(result.sort()).toEqual(
      [path.join(targetDir, "a.wasm"), path.join(targetDir, "b.js")].sort(),
    );
  });

  it("clears a stale file already present in targetDir before copying", async () => {
    await writeFile(path.join(sourceDir, "a.wasm"), "new-bytes");
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "stale.wasm"), "old-bytes");

    await prepareVisualFixtures({
      sourceDir,
      targetDir,
      files: ["a.wasm"],
      log: { log() {} },
    });

    expect((await readdir(targetDir)).sort()).toEqual(["a.wasm"]);
  });

  it("rejects with a named, actionable error and copies nothing when a source file is missing", async () => {
    await writeFile(path.join(sourceDir, "a.wasm"), "present");
    // "b.js" is deliberately never created.

    await expect(
      prepareVisualFixtures({
        sourceDir,
        targetDir,
        files: ["a.wasm", "b.js"],
        log: { log() {} },
      }),
    ).rejects.toMatchObject({
      exitCode: EXIT_CODES.MISSING_SOURCE,
      message: expect.stringContaining("b.js"),
    });

    await expect(readdir(targetDir)).rejects.toThrow();
  });

  it("rejects with a PrepareVisualFixturesError instance (not a generic Error) on a missing source file", async () => {
    await expect(
      prepareVisualFixtures({
        sourceDir,
        targetDir,
        files: ["missing.wasm"],
        log: { log() {} },
      }),
    ).rejects.toBeInstanceOf(PrepareVisualFixturesError);
  });
});

describe("main (CLI wrapper)", () => {
  it("returns exit code 0 on success", async () => {
    await writeFile(path.join(sourceDir, "a.wasm"), "bytes");

    const exitCode = await main({
      sourceDir,
      targetDir,
      files: ["a.wasm"],
      log: { log() {} },
    });

    expect(exitCode).toBe(0);
  });

  it("returns the missing-source exit code and writes a message to stderr, without throwing", async () => {
    const stderr = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk) => {
      stderr.push(chunk);
      return true;
    };

    let exitCode;
    try {
      exitCode = await main({
        sourceDir,
        targetDir,
        files: ["missing.wasm"],
      });
    } finally {
      process.stderr.write = originalWrite;
    }

    expect(exitCode).toBe(EXIT_CODES.MISSING_SOURCE);
    expect(stderr.join("")).toContain("missing.wasm");
  });
});
