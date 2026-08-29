import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadStage, resetStageWasmBridgeForTests } from "./stage-bridge.ts";

// The real WASM assets (public/wasm/, gitignored) are fetched via
// `npm run wasm:download:stage` before tests run in this environment. There
// is no running dev server under jsdom, so the fetch effects are injected as
// Node-backed stubs instead — same approach as wasm/bridge.test.ts.
const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const testOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "stage-wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "stage.wasm"))),
};

// Wrapped in `new Uint8Array(...)`: under Vitest's jsdom environment,
// TextEncoder is a Node-realm polyfill, so its output otherwise fails
// jsdom-realm `instanceof Uint8Array` checks (including the WASM module's
// own argument validation) despite being a genuine byte buffer.
function textBytes(text: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(text));
}

beforeEach(() => {
  resetStageWasmBridgeForTests();
});

describe("loadStage", () => {
  it("loads the WASM module and returns the stage's name for valid input", async () => {
    const defBytes = textBytes(
      "[Info]\nname = Stage Selection Test Stage\n\n[BGDef]\nspr = stage0.sff\n",
    );

    const result = await loadStage(defBytes, testOptions);

    expect(result).toEqual({
      ok: true,
      stage: { name: "Stage Selection Test Stage" },
    });
  });

  it("returns a typed error instead of throwing when the .def bytes are malformed", async () => {
    // A section header missing its closing bracket is the one `.def` shape
    // the `stage` parser actually rejects (everything else it either
    // recognizes or tolerantly skips) — see `stage`'s own parser tests.
    const malformedDefBytes = textBytes(
      "[Info\nname = Stage Selection Test Stage\n",
    );

    const result = await loadStage(malformedDefBytes, testOptions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("returns a typed error instead of throwing when the .def bytes are empty", async () => {
    const result = await loadStage(new Uint8Array(), testOptions);

    // An empty file has no [Info] section at all — the stage parses with
    // an empty name rather than erroring, mirroring `stage`'s own tolerant
    // parsing of missing/unrecognized sections. Documented here so this
    // boundary is explicit rather than assumed.
    expect(result).toEqual({ ok: true, stage: { name: "" } });
  });

  it("reuses the same instantiated module across repeated calls", async () => {
    const first = await loadStage(
      textBytes("[Info]\nname = First Stage\n"),
      testOptions,
    );
    const second = await loadStage(
      textBytes("[Info]\nname = Second Stage\n"),
      testOptions,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected ok results");
    expect(first.stage.name).toBe("First Stage");
    expect(second.stage.name).toBe("Second Stage");
  });
});
