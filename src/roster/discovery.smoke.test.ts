import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadCharacter, resetWasmBridgeForTests } from "../wasm/bridge.ts";
import { discoverRoster } from "./discovery.ts";
import type { RosterManifestEntry } from "./manifest.ts";

// End-to-end sanity check: discoverRoster wired to the *real* WASM bridge
// (not a mock) against real fixture bytes, for both a valid and a broken
// character. discovery.test.ts already covers the aggregation logic itself
// in isolation with fakes; this file is the "does it actually work against
// the real module" runtime smoke check for this sub-task.
const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const wasmOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "character.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "..", "wasm", "testdata");
const files: Record<string, Uint8Array> = {
  "valid.def": new TextEncoder().encode(
    "[Info]\nname = Smoke Test Character\n",
  ),
  "broken.def": new TextEncoder().encode("[Info\nname = Broken\n"),
  "sample.air": new Uint8Array(
    readFileSync(path.join(testdataDir, "sample.air")),
  ),
  "sample.sff": new Uint8Array(
    readFileSync(path.join(testdataDir, "v1-basic.sff")),
  ),
  "sample.cns": new Uint8Array(
    readFileSync(path.join(testdataDir, "sample.cns")),
  ),
};

const validEntry: RosterManifestEntry = {
  id: "valid",
  portrait: "roster/valid/portrait.png",
  files: {
    def: "valid.def",
    air: "sample.air",
    sff: "sample.sff",
    cns: "sample.cns",
  },
};
const brokenEntry: RosterManifestEntry = {
  id: "broken",
  portrait: "roster/broken/portrait.png",
  files: {
    def: "broken.def",
    air: "sample.air",
    sff: "sample.sff",
    cns: "sample.cns",
  },
};

beforeEach(() => {
  resetWasmBridgeForTests();
});

describe("discoverRoster (real WASM smoke check)", () => {
  it("discovers a valid character and reports a broken one as an error, in the same run", async () => {
    const result = await discoverRoster([validEntry, brokenEntry], {
      fetchBytes: async (filePath) => new Uint8Array(files[filePath]),
      loadCharacter: (defBytes, airBytes, sffBytes, cnsBytes) =>
        loadCharacter(defBytes, airBytes, sffBytes, cnsBytes, wasmOptions),
    });

    expect(result).toEqual([
      {
        id: "valid",
        portrait: "roster/valid/portrait.png",
        status: "ok",
        name: "Smoke Test Character",
      },
      {
        id: "broken",
        portrait: "roster/broken/portrait.png",
        status: "error",
        message: expect.stringContaining("malformed section header"),
      },
    ]);
  });
});
