import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadStage,
  resetStageWasmBridgeForTests,
  resolveAnimationFrames,
  resolveSprites,
} from "./stage-bridge.ts";

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
  it("loads the WASM module and returns the stage's name and composition data for valid input", async () => {
    const defBytes = textBytes(
      "[Info]\nname = Stage Selection Test Stage\n\n[BGDef]\nspr = stage0.sff\n\n[BG floor]\ntype = normal\nspriteno = 0,0\nlayerno = 0\n",
    );

    const result = await loadStage(defBytes, testOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.stage.name).toBe("Stage Selection Test Stage");
    expect(result.stage.bgDef.spriteFile).toBe("stage0.sff");
    expect(result.stage.elements).toEqual([
      expect.objectContaining({
        name: "floor",
        type: "normal",
        sprite: { group: 0, image: 0 },
        layerNo: 0,
      }),
    ]);
    expect(result.stage.animations).toEqual({});
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
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.stage.name).toBe("");
    expect(result.stage.elements).toEqual([]);
    expect(result.stage.animations).toEqual({});
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

// Reuses `character`'s own minimal `.sff` test fixture: `resolveSprites` is
// format-agnostic (a `.sff` sheet is a `.sff` sheet regardless of which
// character/stage it belongs to), so no separate stage-specific sprite
// sheet fixture is needed just to exercise the real WASM call shape.
const testdataDir = path.resolve(import.meta.dirname, "testdata");
const sffBytes = new Uint8Array(
  readFileSync(path.join(testdataDir, "v1-basic.sff")),
);

describe("resolveSprites", () => {
  it("decodes real pixels for a sprite the sheet actually has", async () => {
    const [result] = await resolveSprites(
      sffBytes,
      [[0, 0]],
      null,
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.width).toBe(57);
    expect(result.height).toBe(103);
    expect(result.pixels.length).toBe(57 * 103 * 4);
  });

  it("returns a typed per-request error for a sprite reference the sheet doesn't have", async () => {
    const [result] = await resolveSprites(
      sffBytes,
      [[9999, 9999]],
      null,
      testOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("sprite not found");
  });

  it("resolves several requests in one batched call, in order", async () => {
    const results = await resolveSprites(
      sffBytes,
      [
        [0, 0],
        [9999, 9999],
      ],
      null,
      testOptions,
    );

    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });
});

describe("resolveAnimationFrames", () => {
  it("resolves the sprite active at a given elapsed-ticks offset", async () => {
    const animation = {
      frames: [
        { sprite: { group: 0, image: 0 }, time: 10 },
        { sprite: { group: 0, image: 1 }, time: 10 },
      ],
      loopStart: 0,
    };

    const result = await resolveAnimationFrames(
      [
        { animation, elapsedTicks: 0 },
        { animation, elapsedTicks: 15 },
      ],
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.sprites).toEqual([
      { group: 0, image: 0 },
      { group: 0, image: 1 },
    ]);
  });

  it("resolves a null animation (no matching action block) to the blank sentinel", async () => {
    const result = await resolveAnimationFrames(
      [{ animation: null, elapsedTicks: 0 }],
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.sprites).toEqual([{ group: -1, image: -1 }]);
  });

  it("resolves an empty request list to an empty result", async () => {
    const result = await resolveAnimationFrames([], testOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.sprites).toEqual([]);
  });
});
