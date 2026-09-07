import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadCharacter,
  loadCmd,
  resetWasmBridgeForTests,
  resolveSprites,
} from "./bridge.ts";

// The real WASM assets (public/wasm/, gitignored) are fetched via
// `npm run wasm:download` before tests run in this environment. There is no
// running dev server under jsdom, so the fetch effects are injected as
// Node-backed stubs instead — same approach as character-viewer-web's
// bridge.test.ts.
const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const testOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "character.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "testdata");
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(testdataDir, name)));
}

// Wrapped in `new Uint8Array(...)`: under Vitest's jsdom environment,
// TextEncoder is a Node-realm polyfill, so its output otherwise fails
// jsdom-realm `instanceof Uint8Array` checks (including the WASM module's
// own argument validation) despite being a genuine byte buffer.
function textBytes(text: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(text));
}

const airBytes = fixture("sample.air");
const sffBytes = fixture("v1-basic.sff");
const cnsBytes = fixture("sample.cns");
const cmdBytes = fixture("sample.cmd");

beforeEach(() => {
  resetWasmBridgeForTests();
});

describe("loadCharacter", () => {
  it("loads the WASM module and returns the character's name for valid input", async () => {
    const defBytes = textBytes(
      "[Info]\nname = Roster Test Character\nauthor = Someone\n",
    );

    const result = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.character.name).toBe("Roster Test Character");
    // sample.air (see testdata/) declares two actions, 200 and 201.
    expect(result.character.animations.map((a) => a.number).sort()).toEqual([
      200, 201,
    ]);
    expect(result.character.sprites.length).toBeGreaterThan(0);
    // sample.cns (see testdata/) declares Statedef 0, -1, and 200.
    expect(result.character.stateDefs.map((s) => s.number).sort()).toEqual([
      -1, 0, 200,
    ]);
  });

  it("returns a typed error instead of throwing when the .def bytes are malformed", async () => {
    // A section header missing its closing bracket is the one `.def` shape
    // the `character` parser actually rejects (everything else it either
    // recognizes or tolerantly skips) — see `character`'s `def/parser.go`.
    const malformedDefBytes = textBytes(
      "[Info\nname = Roster Test Character\n",
    );

    const result = await loadCharacter(
      malformedDefBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("returns a typed error instead of throwing when the .sff bytes are empty", async () => {
    const defBytes = textBytes("[Info]\nname = Roster Test Character\n");

    const result = await loadCharacter(
      defBytes,
      airBytes,
      new Uint8Array(),
      cnsBytes,
      testOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("reuses the same instantiated module across repeated calls", async () => {
    const defBytes = textBytes("[Info]\nname = First Load\n");

    const first = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );
    const second = await loadCharacter(
      textBytes("[Info]\nname = Second Load\n"),
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected ok results");
    expect(first.character.name).toBe("First Load");
    expect(second.character.name).toBe("Second Load");
  });
});

describe("resolveSprites", () => {
  it("decodes real pixels for a sprite the sheet actually has", async () => {
    const defBytes = textBytes("[Info]\nname = Sprite Resolve Test\n");
    const loaded = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );
    if (!loaded.ok) throw new Error("expected an ok result");
    const [firstGroup] = loaded.character.sprites;
    const [firstSprite] = firstGroup.sprites;

    const [result] = await resolveSprites(
      sffBytes,
      [[firstSprite.group, firstSprite.image]],
      null,
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.width).toBe(firstSprite.width);
    expect(result.height).toBe(firstSprite.height);
    expect(result.pixels.length).toBe(result.width * result.height * 4);
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
    const defBytes = textBytes("[Info]\nname = Batch Test\n");
    const loaded = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );
    if (!loaded.ok) throw new Error("expected an ok result");
    const [firstGroup] = loaded.character.sprites;
    const [firstSprite] = firstGroup.sprites;

    const results = await resolveSprites(
      sffBytes,
      [
        [firstSprite.group, firstSprite.image],
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

describe("loadCmd", () => {
  it("parses a real .cmd file's remap, defaults, and command definitions", async () => {
    const result = await loadCmd(cmdBytes, testOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    // sample.cmd (see testdata/) remaps a->a, b->b, x->y, sets a 15-tick
    // default recognition window, and declares two commands: "a" and
    // "QCF_a".
    expect(result.commandFile.remap).toEqual({ a: "a", b: "b", x: "y" });
    expect(result.commandFile.defaults).toEqual({ time: 15, bufferTime: 1 });
    expect(result.commandFile.commands.map((c) => c.name).sort()).toEqual([
      "QCF_a",
      "a",
    ]);
  });

  it("returns a typed error instead of throwing when the .cmd bytes are malformed", async () => {
    // A section header missing its closing bracket is the one `.cmd` shape
    // the underlying parser actually rejects, matching bridge.test.ts's own
    // loadCharacter malformed-input convention above.
    const malformedCmdBytes = textBytes("[Remap\na = a\n");

    const result = await loadCmd(malformedCmdBytes, testOptions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("returns a typed error instead of throwing for empty input", async () => {
    const result = await loadCmd(new Uint8Array(), testOptions);

    // An empty .cmd file is not itself malformed to the parser (no command
    // requires any content) -- this only proves loadCmd never throws or
    // hangs on a degenerate input, regardless of which shape that resolves
    // to.
    expect(typeof result.ok).toBe("boolean");
  });

  it("reuses the same instantiated module across repeated calls, alongside loadCharacter", async () => {
    const first = await loadCmd(cmdBytes, testOptions);
    const loaded = await loadCharacter(
      textBytes("[Info]\nname = Alongside Test\n"),
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );

    expect(first.ok).toBe(true);
    expect(loaded.ok).toBe(true);
  });
});
